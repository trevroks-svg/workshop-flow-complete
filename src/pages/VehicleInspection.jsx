import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Save, Send, Loader2, ClipboardList, CheckCircle, Printer } from "lucide-react";
import { createPageUrl } from "@/utils";
import InspectionStatusBadge from "../components/inspection/InspectionStatusBadge";
import BrakeMeasurementsSection from "../components/inspection/BrakeMeasurementsSection";
import TyreMeasurementsSection from "../components/inspection/TyreMeasurementsSection";
import MultiPointSection from "../components/inspection/MultiPointSection";
import InspectionSummaryBanner from "../components/inspection/InspectionSummaryBanner";
import InspectionPhotoUploader from "../components/inspection/InspectionPhotoUploader";
import InspectionPrintReport from "../components/inspection/InspectionPrintReport";
import MeasurementsCopyPanel from "../components/inspection/MeasurementsCopyPanel";

const formatDT = (v) => {
  if (!v) return '';
  const s = String(v);
  const hasZone = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s);
  const d = new Date(hasZone ? s : `${s}Z`);
  return d.toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

export default function VehicleInspection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const requestId = urlParams.get('request_id');
  const inspectionId = urlParams.get('id');

  

  const { data: request } = useQuery({
    queryKey: ['partsRequest', requestId],
    queryFn: async () => {
      if (!requestId) return null;
      const results = await entities.PartsRequest.filter({ id: requestId });
      return results[0] || null;
    },
    enabled: !!requestId
  });

  const { data: existingInspection, isLoading: inspectionLoading } = useQuery({
    queryKey: ['vehicleInspection', inspectionId || requestId],
    queryFn: async () => {
      if (inspectionId) {
        const r = await entities.VehicleInspection.filter({ id: inspectionId });
        return r[0] || null;
      }
      if (requestId) {
        const r = await entities.VehicleInspection.filter({ request_id: requestId });
        return r[0] || null;
      }
      return null;
    },
    enabled: !!(inspectionId || requestId)
  });

  const staffRole = user?.staff_role || 'technician';
  const isTechnician = staffRole === 'technician';
  const isAdmin = staffRole === 'admin';

  const [form, setForm] = useState({
    job_card_number: '',
    customer_name: '',
    vehicle_registration: '',
    vehicle_make_model: '',
    odometer: '',
    technician_name: '',
    brake_measurements: {},
    tyre_measurements: {},
    multipoint_inspection: {},
    technician_notes: '',
    diagnostic_concern: '',
    diagnostic_cause: '',
    diagnostic_correction: '',
    photo_urls: [],
  });

  // Pre-fill from request and existing inspection
  useEffect(() => {
    if (existingInspection) {
      setForm({
        job_card_number: existingInspection.job_card_number || '',
        customer_name: existingInspection.customer_name || '',
        vehicle_registration: existingInspection.vehicle_registration || '',
        vehicle_make_model: existingInspection.vehicle_make_model || '',
        odometer: existingInspection.odometer || '',
        technician_name: existingInspection.technician_name || '',
        brake_measurements: existingInspection.brake_measurements || {},
        tyre_measurements: existingInspection.tyre_measurements || {},
        multipoint_inspection: existingInspection.multipoint_inspection || {},
        technician_notes: existingInspection.technician_notes || '',
        diagnostic_concern: existingInspection.diagnostic_concern || '',
        diagnostic_cause: existingInspection.diagnostic_cause || '',
        diagnostic_correction: existingInspection.diagnostic_correction || '',
        photo_urls: existingInspection.photo_urls || [],
      });
    } else if (request) {
      setForm(prev => ({
        ...prev,
        job_card_number: request.job_card_number || '',
        customer_name: request.customer_name || '',
        vehicle_make_model: request.vehicle_type || '',
        technician_name: user?.full_name || '',
      }));
    } else if (user && !existingInspection) {
      setForm(prev => ({ ...prev, technician_name: user.full_name || '' }));
    }
  }, [existingInspection, request, user]);

  const inspection = existingInspection;
  const isReadonly = inspection?.status === 'submitted' && isTechnician && !isAdmin;
  const canReview = ['service_advisor', 'service_manager', 'workshop_controller', 'admin'].includes(staffRole) && inspection?.status === 'submitted';

  const saveMutation = useMutation({
    mutationFn: async (status) => {
      const data = {
        ...form,
        request_id: requestId || inspection?.request_id || null,
        technician_email: user.email,
        business_id: user.business_id,
        status: status || 'draft',
        ...(status === 'submitted' ? { submitted_at: new Date().toISOString(), service_advisor_email: request?.service_advisor_email } : {})
      };
console.log('Saving inspection data:', JSON.stringify(data));
      if (inspection) {
        await entities.VehicleInspection.update(inspection.id, data);
        return inspection.id;
      } else {
        const created = await entities.VehicleInspection.create(data);
        return created.id;
      }
    },
    onError: (error) => {
      console.error('Save failed:', error);
      toast.error('Failed to save inspection: ' + error.message);
    },
    onSuccess: async (id, status) => {
      queryClient.invalidateQueries(['vehicleInspection']);
      queryClient.invalidateQueries(['vehicleInspections']);
      if (status === 'submitted') {
        // Notify service advisor
        if (request?.service_advisor_email) {
          // Email notification handled server-side
        }
        toast.success('Inspection submitted to Service Advisor');
        navigate(createPageUrl('Dashboard'));
      } else {
        toast.success('Inspection saved as draft');
        if (!inspection) {
          navigate(`${createPageUrl('VehicleInspection')}?id=${id}&request_id=${requestId || ''}`);
        }
      }
    }
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      await entities.VehicleInspection.update(inspection.id, {
        status: 'reviewed',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vehicleInspection']);
      queryClient.invalidateQueries(['vehicleInspections']);
      toast.success('Inspection marked as reviewed');
    }
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const JOB_CARD_REGEX = /^J[0-9]{8}$/;
  const jobCardValid = JOB_CARD_REGEX.test(form.job_card_number.trim());
  const [jobCardTouched, setJobCardTouched] = useState(false);
  const showJobCardError = jobCardTouched && !jobCardValid && !isReadonly;

  const REQUIRED_FIELDS = ['customer_name', 'vehicle_registration', 'vehicle_make_model', 'odometer', 'technician_name'];
  const [touchedFields, setTouchedFields] = useState({});
  const fieldValid = (key) => !!form[key]?.trim();
  const showFieldError = (key) => touchedFields[key] && !fieldValid(key) && !isReadonly;

  const canPrint = ['service_advisor', 'service_manager', 'workshop_controller', 'admin'].includes(staffRole) && inspection?.status !== 'draft';
  const [isPrintPreview, setIsPrintPreview] = useState(false);

  const handlePrint = () => {
    const report = document.getElementById('inspection-print-root');

    if (!report) {
      toast.error('Inspection report is not ready to print yet.');
      return;
    }

    setIsPrintPreview(true);
    window.setTimeout(() => window.print(), 150);
  };

  const handlePrintDialog = () => {
    toast.info('Opening print dialog...');
    window.print();
  };

  if (inspectionLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isPrintPreview) {
    return (
      <div className="min-h-screen bg-white">
        <div className="no-print sticky top-0 z-10 border-b bg-white/95 backdrop-blur px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPrintPreview(false)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              onClick={handlePrintDialog}
              className="gap-2 bg-slate-900 hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
        <div className="inspection-print-preview">
          <InspectionPrintReport form={form} inspection={inspection} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">Vehicle Inspection</h1>
              {inspection && <InspectionStatusBadge status={inspection.status} />}
            </div>
            {inspection?.submitted_at && (
              <p className="text-xs text-slate-500 mt-0.5">
                Submitted {formatDT(inspection.submitted_at)} by {inspection.technician_name}
              </p>
            )}
          </div>
        </div>

        {/* Summary Banner (read-only view for advisors) */}
        {inspection?.status !== 'draft' && (
          <InspectionSummaryBanner multipoint={form.multipoint_inspection} />
        )}

        {/* Mark Reviewed button for advisor */}
        {canReview && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium text-blue-800">This inspection is ready for your review.</p>
            <Button
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {reviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Mark as Reviewed
            </Button>
          </div>
        )}

        {/* 1. Vehicle Details */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate-500" />
              Vehicle & Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Job Card Number - special validation */}
            <div>
              <Label className="text-xs text-slate-500">Job Card Number *</Label>
              {isReadonly ? (
                <p className="text-sm font-medium mt-1">{form.job_card_number || '—'}</p>
              ) : (
                <>
                  <Input
                    value={form.job_card_number}
                    onChange={e => {
                      let val = e.target.value.toUpperCase();
                      set('job_card_number', val);
                    }}
                    onBlur={() => setJobCardTouched(true)}
                    className={`mt-1 ${showJobCardError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    placeholder="J12345678"
                    maxLength={9}
                  />
                  {showJobCardError && (
                    <p className="text-xs text-red-600 mt-1">Must be J followed by 8 digits (e.g. J12345678)</p>
                  )}
                  {!showJobCardError && (
                    <p className="text-xs text-slate-400 mt-1">Format: J followed by 8 digits</p>
                  )}
                </>
              )}
            </div>

            {/* Remaining fields */}
            {[
              { key: 'customer_name', label: 'Customer Name' },
              { key: 'vehicle_registration', label: 'Vehicle Registration' },
              { key: 'vehicle_make_model', label: 'Vehicle Make / Model' },
              { key: 'odometer', label: 'Odometer Reading' },
              { key: 'technician_name', label: 'Technician Name' },
            ].map(({ key, label }) => (
              <div key={key}>
                <Label className="text-xs text-slate-500">{label} *</Label>
                {isReadonly ? (
                  <p className="text-sm font-medium mt-1">{form[key] || '—'}</p>
                ) : (
                  <>
                    <Input
                      value={form[key]}
                      onChange={e => set(key, e.target.value)}
                      onBlur={() => setTouchedFields(prev => ({ ...prev, [key]: true }))}
                      className={`mt-1 ${showFieldError(key) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      placeholder={label}
                    />
                    {showFieldError(key) && (
                      <p className="text-xs text-red-600 mt-1">{label} is required</p>
                    )}
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 2. Brake Measurements */}
        <BrakeMeasurementsSection
          values={form.brake_measurements}
          onChange={v => set('brake_measurements', v)}
          readonly={isReadonly}
        />

        {/* 3. Tyre Measurements */}
        <TyreMeasurementsSection
          values={form.tyre_measurements}
          onChange={v => set('tyre_measurements', v)}
          readonly={isReadonly}
        />

        {/* 4. Multipoint Inspection */}
        <MultiPointSection
          values={form.multipoint_inspection}
          onChange={v => set('multipoint_inspection', v)}
          readonly={isReadonly}
        />

        {/* 5. Technician Notes */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Technician Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {isReadonly ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{form.technician_notes || '—'}</p>
            ) : (
              <Textarea
                value={form.technician_notes}
                onChange={e => set('technician_notes', e.target.value)}
                placeholder="General observations, recommended repairs, follow-up items..."
                rows={4}
              />
            )}
          </CardContent>
        </Card>

        {/* 6. Diagnostic Notes */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Diagnostic Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'diagnostic_concern', label: 'Concern', placeholder: 'What is the customer concern or symptom?' },
              { key: 'diagnostic_cause', label: 'Cause', placeholder: 'What is the root cause of the concern?' },
              { key: 'diagnostic_correction', label: 'Correction', placeholder: 'What action was taken or is recommended?' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <Label className="text-sm font-semibold text-slate-700">{label}</Label>
                {isReadonly ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1 p-3 bg-slate-50 rounded-lg min-h-[60px]">{form[key] || '—'}</p>
                ) : (
                  <Textarea
                    value={form[key]}
                    onChange={e => set(key, e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="mt-1.5"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 7. Photos */}
        <InspectionPhotoUploader
          photos={form.photo_urls}
          onChange={v => set('photo_urls', v)}
          readonly={isReadonly}
        />

        {/* Action Buttons */}
        {!isReadonly && (
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                setJobCardTouched(true);
                const allTouched = Object.fromEntries(REQUIRED_FIELDS.map(k => [k, true]));
                setTouchedFields(allTouched);
                if (!jobCardValid) { toast.error('Enter a valid job card number (e.g. J12345678)'); return; }
                const missingField = REQUIRED_FIELDS.find(k => !fieldValid(k));
                if (missingField) { toast.error('Please fill in all required fields'); return; }
                saveMutation.mutate('draft');
              }}
              disabled={saveMutation.isPending}
              className="flex-1 gap-2"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </Button>
            <Button
              onClick={() => {
                setJobCardTouched(true);
                const allTouched = Object.fromEntries(REQUIRED_FIELDS.map(k => [k, true]));
                setTouchedFields(allTouched);
                if (!jobCardValid) { toast.error('Enter a valid job card number (e.g. J12345678)'); return; }
                const missingField = REQUIRED_FIELDS.find(k => !fieldValid(k));
                if (missingField) { toast.error('Please fill in all required fields'); return; }
                saveMutation.mutate('submitted');
              }}
              disabled={saveMutation.isPending}
              className="flex-1 bg-slate-900 hover:bg-slate-800 gap-2"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit to Service Advisor
            </Button>
          </div>
        )}

        {/* Copy measurements for advisors */}
        {canPrint && (
          <MeasurementsCopyPanel
            brakes={form.brake_measurements}
            tyres={form.tyre_measurements}
          />
        )}

        {/* Print button for advisors */}
        {canPrint && (
          <div className="mt-4">
            <Button
              type="button"
              onClick={handlePrint}
              variant="outline"
              className="w-full gap-2"
            >
              <Printer className="h-4 w-4" />
              Print Inspection Report
            </Button>
          </div>
        )}

        {/* Reviewed info */}
        {inspection?.status === 'reviewed' && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-sm text-emerald-700 font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Reviewed by {inspection.reviewed_by} on {formatDT(inspection.reviewed_at)}
            </p>
          </div>
        )}

        {/* Hidden print template */}
        <div className="inspection-print-container">
          <InspectionPrintReport form={form} inspection={inspection} />
        </div>
      </div>
    </div>
  );
}
