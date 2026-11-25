import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import RequestPhotoUploader from "../components/photos/RequestPhotoUploader";
import { createPageUrl } from "@/utils";
import PartsSelector from "../components/PartsSelector";

export default function PartsRequestForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    job_card_number: "",
    parts: [],
    notes: ""
  });
  const [tyreTreadDepths, setTyreTreadDepths] = useState({});
  const [brakePadMeasurements, setBrakePadMeasurements] = useState({});
  const [photos, setPhotos] = useState([]);

  const [jobCardError, setJobCardError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  

  const { data: business } = useQuery({
    queryKey: ['business', user?.business_id],
    queryFn: () => entities.Business.get(user.business_id),
    enabled: !!user?.business_id
  });

  const jobCardPlaceholder = business?.job_card_format_hint || business?.job_card_prefix ? `${business.job_card_prefix || ''}0001` : 'e.g. J12345678';
  const jobCardPrefix = business?.job_card_prefix || null;

  const createRequestMutation = useMutation({
    mutationFn: async (data) => {
      try {
        const now = new Date().toISOString();
        const { photos: requestPhotos = [], ...requestData } = data;
        delete requestData.tyreTreadDepths;
        delete requestData.brakePadMeasurements;
        
        const hasTyres = requestData.parts.some(p => p.part_type === "tyres");
        const hasBrakePads = requestData.parts.some(p => p.part_type === "front_brake_pads" || p.part_type === "rear_brake_pads");
        
        // Create the request
        const request = await entities.PartsRequest.create({
          ...requestData,
          business_id: user.business_id,
          status: "sent_to_parts",
          technician_email: user.email,
          technician_name: user.full_name,
          action_required: true,
          action_required_since: now,
          action_required_role: "parts_interpreter",
          ...(hasTyres && tyreTreadDepths && Object.keys(tyreTreadDepths).length > 0 ? { tyre_tread_depths: tyreTreadDepths } : {}),
          ...(hasBrakePads && brakePadMeasurements && Object.keys(brakePadMeasurements).length > 0 ? { brake_pad_measurements: brakePadMeasurements } : {}),
          audit_log: [{
            previous_status: null,
            new_status: "sent_to_parts",
            changed_by_email: user.email,
            changed_by_name: user.full_name,
            changed_at: now,
            notes: "Request created and sent to parts"
          }]
        });

        const appUrl = window.location.origin;
        const requestUrl = `${appUrl}/#/RequestDetail?id=${request.id}`;

        // Create in-app notification
        await entities.Notification.create({
          business_id: user.business_id,
          recipient_role: "parts_interpreter",
          type: "new_request",
          title: "New Parts Request - Action Required",
          message: `Job #${requestData.job_card_number} - ${requestData.parts.length} parts requested`,
          request_id: request.id,
          job_card_number: requestData.job_card_number
        });

        // Associate pre-uploaded photos with the new request
        if (requestPhotos.length > 0) {
          await Promise.all(
            requestPhotos
              .filter(p => p.url && !p.uploading)
              .map(p => entities.QuoteRequestPhoto.create({
                quote_request_id: request.id,
                business_id: user?.business_id || undefined,
                photo_url: p.url,
                caption: p.caption || undefined,
                taken_by_email: user.email,
                taken_by_name: user.full_name,
                taken_by_role: user.staff_role || 'technician',
                visibility: 'internal'
              }))
          );
        }

        return request;
      } catch (error) {
        console.error("Mutation error:", error);
        throw error;
      }
    },
    onSuccess: (request) => {
      toast.success(`Request ${formData.job_card_number} submitted successfully!`, { duration: 2500 });
      queryClient.invalidateQueries({ queryKey: ['partsRequests'] });
      navigate(createPageUrl(`RequestDetail?id=${request.id}`));
    },
    onError: (error) => {
      console.error("Submit error:", error);
      toast.error(`Failed to submit request: ${error.message || 'Unknown error'}`);
      setIsSubmitting(false);
    }
  });

  const validateJobCardNumber = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return "Job Card Number is required";
    if (jobCardPrefix && !trimmed.toUpperCase().startsWith(jobCardPrefix.toUpperCase())) {
      return `Job Card Number must start with '${jobCardPrefix}' (e.g. ${jobCardPlaceholder})`;
    }
    return "";
  };

  const handleJobCardChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, job_card_number: value });
    if (jobCardError && value) setJobCardError("");
  };

  const validateForm = () => {
    const jobCardValidation = validateJobCardNumber(formData.job_card_number);
    if (jobCardValidation) {
      setJobCardError(jobCardValidation);
      toast.error(jobCardValidation);
      return false;
    }
    
    if (formData.parts.length === 0) {
      toast.error("Please add at least one part");
      return false;
    }
    for (const part of formData.parts) {
      if (!part.part_type) {
        toast.error("Please select a part type for all items");
        return false;
      }
      if (part.part_type === "tyres" && !part.tyre_size?.trim()) {
        toast.error("Tyre size is required for tyre orders");
        return false;
      }
      if (part.part_type === "other" && !part.other_description?.trim()) {
        toast.error("Description is required for 'Other' parts");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevent double submission
    
    if (validateForm()) {
      if (!user?.business_id) {
        toast.error("Your account is not linked to a business. Please contact an administrator.");
        return;
      }
      setIsSubmitting(true);
      createRequestMutation.mutate({ ...formData, tyreTreadDepths, brakePadMeasurements, photos });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">New Parts Request</h1>
            <p className="text-slate-500">Request parts quotes for a job</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="job_card_number" className="text-sm font-semibold text-slate-700">
                  Job Card Number *
                </Label>
                <Input
                  id="job_card_number"
                  value={formData.job_card_number}
                  onChange={handleJobCardChange}
                  placeholder={jobCardPlaceholder}
                  className={`mt-1.5 ${jobCardError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {jobCardError && (
                  <p className="text-sm text-red-600 mt-1.5">{jobCardError}</p>
                )}
                {(business?.job_card_format_hint || jobCardPrefix) && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    Format: {business?.job_card_format_hint || jobCardPlaceholder}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Parts Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <PartsSelector
                parts={formData.parts}
                onChange={(parts) => setFormData({ ...formData, parts })}
                tyreTreadDepths={tyreTreadDepths}
                onTyreTreadDepthsChange={setTyreTreadDepths}
                brakePadMeasurements={brakePadMeasurements}
                onBrakePadMeasurementsChange={setBrakePadMeasurements}
              />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <RequestPhotoUploader photos={photos} onChange={setPhotos} />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional information for the parts team..."
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-slate-900 hover:bg-slate-800 gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
