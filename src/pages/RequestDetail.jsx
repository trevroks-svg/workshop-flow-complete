import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { clearActionRequired } from "../components/notificationHelpers";
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/api/storage";
import { extractPdfText } from "@/lib/extractPdfText";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileText, Download, Send, CheckCircle, Loader2, History, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { createPageUrl } from "@/utils";

const parseIsoAssumeUtc = (value) => {
  if (!value) return null;
  const s = String(value);
  const hasZone = s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s);
  return new Date(hasZone ? s : `${s}Z`);
};

const formatAdelaideDateTime = (value) => {
  const d = parseIsoAssumeUtc(value);
  if (!d || isNaN(d)) return "";
  return d.toLocaleString("en-AU", {
    timeZone: "Australia/Adelaide",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};
import StatusBadge from "../components/StatusBadge";
import AuditLog from "../components/AuditLog";
import { PART_TYPES } from "../components/PartsSelector";
import SMSDraftGenerator from "../components/sms/SMSDraftGenerator";
import RecommendationTextGenerator from "../components/recommendations/RecommendationTextGenerator";
import LabourTimeSelector from "../components/labour/LabourTimeSelector";
import LabourLineAnalyser from "../components/labour/LabourLineAnalyser";
import LabourSummaryPanel from "../components/labour/LabourSummaryPanel";
import PartsETASelector from "../components/parts/PartsETASelector";
import PhotoGallery from "../components/photos/PhotoGallery";
import InspectionCard from "../components/inspection/InspectionCard";
import CustomerDecisionDialog from "../components/CustomerDecisionDialog";
import PartsInterpreterNotesEditor from "../components/PartsInterpreterNotesEditor";

export default function RequestDetail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const requestId = urlParams.get('id');

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDecisionDialog, setShowDecisionDialog] = useState(false);
  const [decisionType, setDecisionType] = useState(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionNote, setCompletionNote] = useState("");
  const [uploadPdfFile, setUploadPdfFile] = useState(null);
  const [actionNotes, setActionNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  

  const businessId = user?.business_id || null;
  const { data: business } = useQuery({
    queryKey: ['business', businessId],
    queryFn: () => entities.Business.filter({ id: businessId }).then(r => r[0] || null),
    enabled: !!businessId
  });

  const labourRate = business?.default_labour_rate || 110;

  const { data: request, isLoading, refetch } = useQuery({
    queryKey: ['partsRequest', requestId],
    queryFn: async () => {
      const requests = await entities.PartsRequest.filter({ id: requestId });
      return requests[0];
    },
    enabled: !!requestId,
    refetchInterval: 10000
  });

  const staffRole = user?.staff_role || 'technician';
  const isAdmin = staffRole === 'admin';

  // For admins, determine effective role based on request status
  const getAdminEffectiveRole = () => {
    if (!isAdmin || !request) return staffRole;
    const s = request.status;
    if (s === 'sent_to_parts') return 'parts_interpreter';
    if (s === 'quoted' || s === 'awaiting_workshop_approval' || s === 'customer_approved' || s === 'customer_denied') return 'workshop_controller';
    if (['sent_to_advisor', 'advisor_action_required', 'recommendation_added', 'sent_to_customer'].includes(s)) return 'service_advisor';
    return staffRole;
  };
  const effectiveRole = isAdmin ? getAdminEffectiveRole() : staffRole;

  // Clear action-required when user opens the request
  useEffect(() => {
    if (request && user && request.action_required && request.action_required_role === staffRole) {
      clearActionRequired(request.id, user.email);
    }
  }, [request?.id, user?.email, staffRole]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ newStatus, additionalData = {}, notificationType, notificationTitle, notificationMessage, targetRole, emailRecipient, emailSubject, emailBody }) => {
      const now = new Date().toISOString();
      const auditEntry = {
        previous_status: request.status,
        new_status: newStatus,
        changed_by_email: user.email,
        changed_by_name: user.full_name,
        changed_at: now,
        notes: actionNotes
      };

      await entities.PartsRequest.update(request.id, {
        status: newStatus,
        audit_log: [...(request.audit_log || []), auditEntry],
        action_required: false,
        action_cleared_at: now,
        action_cleared_by: user.email,
        ...additionalData
      });

      if (notificationType && targetRole) {
        // Create in-app notification
        await entities.Notification.create({
          business_id: request.business_id,
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          request_id: request.id,
          job_card_number: request.job_card_number,
          recipient_role: targetRole
        });
        
        // Set action-required for target role
        await entities.PartsRequest.update(request.id, {
          action_required: true,
          action_required_since: now,
          action_required_role: targetRole
        });

        // Email sending handled server-side via notify routes
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['partsRequest', requestId]);
      queryClient.invalidateQueries(['partsRequests']);
      toast.success("Status updated successfully");
      setActionNotes("");
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message || 'Unknown error'}`);
    }
  });

  const handleUploadQuote = async () => {
    if (!uploadPdfFile) {
      toast.error("Please select a PDF file to upload");
      return;
    }

    if (!request.parts_eta_selection) {
      toast.error("⚠️ Parts Availability (ETA) is required", {
        description: "Please scroll up and select the Parts Availability before uploading the quote.",
        duration: 5000,
      });
      setShowUploadDialog(false);
      return;
    }

    try {
      setIsUploading(true);
      let quotePdfText = "";
      try {
        quotePdfText = await extractPdfText(uploadPdfFile);
      } catch (error) {
        console.warn("Quote PDF text extraction failed:", error);
      }

      const file_url = await uploadFile(uploadPdfFile, 'quote-pdfs');
      const quotePdfExtractedAt = quotePdfText ? new Date().toISOString() : null;

      await updateStatusMutation.mutateAsync({
        newStatus: "quoted",
        additionalData: {
          quote_pdf_url: file_url,
          ...(quotePdfText ? {
            quote_pdf_text: quotePdfText,
            quote_pdf_extracted_at: quotePdfExtractedAt
          } : {}),
          parts_interpreter_email: user.email
        },
        notificationType: "quote_returned",
        notificationTitle: "Quote Ready - Action Required",
        notificationMessage: `Quote for Job #${request.job_card_number} is ready for Workshop Controller review`,
        targetRole: "workshop_controller"
      });

      setShowUploadDialog(false);
      setUploadPdfFile(null);
      toast.success("Quote uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload quote: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const hasValidLabourLines = Array.isArray(request?.labour_lines) &&
    request.labour_lines.length > 0 &&
    request.labour_lines.every(line => Number.isFinite(Number(line.hours)));
  const hasValidLabourTimeSelection = request?.labour_time_selection &&
    !(request.labour_time_selection === 'other' && !request.labour_time_custom_hours);
  const labourIsValid = hasValidLabourLines || hasValidLabourTimeSelection;

  const handleWorkshopApproval = async () => {
    await updateStatusMutation.mutateAsync({
      newStatus: "sent_to_advisor",
      additionalData: { 
        workshop_controller_email: user.email,
        approval_action: "immediate",
        approval_notes: actionNotes
      },
      notificationType: "approval_completed",
      notificationTitle: "Quote Approved - Action Required",
      notificationMessage: `Job #${request.job_card_number} has been approved and requires Service Advisor action`,
      targetRole: "service_advisor"
    });
  };

  const handleRecommendationApproval = async () => {
    await updateStatusMutation.mutateAsync({
      newStatus: "advisor_action_required",
      additionalData: {
        workshop_controller_email: user.email,
        approval_action: "recommendation",
        approval_notes: actionNotes,
        action_required_type: "add_to_recommendations"
      },
      notificationType: "approval_completed",
      notificationTitle: "Add to Recommendations – Action Required",
      notificationMessage: `Job #${request.job_card_number} has been approved and needs to be added to customer recommendations`,
      targetRole: "service_advisor"
    });
  };

  const handleSendToCustomer = async () => {
    await updateStatusMutation.mutateAsync({
      newStatus: "sent_to_customer",
      additionalData: { service_advisor_email: user.email },
      notificationType: "sent_to_customer",
      notificationTitle: "Sent to Customer",
      notificationMessage: `Quote for Job #${request.job_card_number} has been sent to customer`,
      targetRole: "service_advisor"
    });
  };

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      await entities.PartsRequest.update(request.id, {
        wc_completed: true,
        wc_completed_at: now,
        wc_completed_by: user.email,
        wc_completion_note: completionNote || undefined,
        audit_log: [
          ...(request.audit_log || []),
          {
            previous_status: request.status,
            new_status: request.status,
            changed_by_email: user.email,
            changed_by_name: user.full_name,
            changed_at: now,
            notes: `Marked as complete by Workshop Controller${completionNote ? `: ${completionNote}` : ''}`
          }
        ]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['partsRequest', requestId]);
      queryClient.invalidateQueries(['partsRequests']);
      setShowCompleteDialog(false);
      setCompletionNote("");
      toast.success("Request marked as complete");
      navigate(createPageUrl("Dashboard"));
    },
    onError: () => {
      toast.error("Failed to mark as complete");
    }
  });

  const reopenMutation = useMutation({
    mutationFn: async (reason) => {
      const now = new Date().toISOString();
      await entities.PartsRequest.update(request.id, {
        wc_completed: false,
        wc_completed_at: null,
        wc_completed_by: null,
        wc_completion_note: null,
        audit_log: [
          ...(request.audit_log || []),
          {
            previous_status: request.status,
            new_status: request.status,
            changed_by_email: user.email,
            changed_by_name: user.full_name,
            changed_at: now,
            notes: `Reopened by ${staffRole === 'admin' ? 'Admin' : 'Service Manager'}: ${reason}`
          }
        ]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['partsRequest', requestId]);
      queryClient.invalidateQueries(['partsRequests']);
      toast.success("Request reopened");
    },
    onError: () => {
      toast.error("Failed to reopen request");
    }
  });

  const getPartLabel = (partType) => {
    const found = PART_TYPES.find(p => p.value === partType);
    return found ? found.label : partType;
  };

  const canPerformAction = () => {
    switch (effectiveRole) {
      case 'parts_interpreter':
        return request?.status === 'sent_to_parts';
      case 'workshop_controller':
        return ['quoted', 'awaiting_workshop_approval'].includes(request?.status);
      case 'service_advisor':
      case 'service_manager':
        return ['sent_to_advisor', 'advisor_action_required', 'sent_to_customer', 'recommendation_added'].includes(request?.status);
      default:
        return false;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-slate-600 mb-4">Request not found</p>
          <Button onClick={() => navigate(createPageUrl("Dashboard"))}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
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
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">Job #{request.job_card_number}</h1>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Created {formatAdelaideDateTime(request.created_at)} by {request.technician_name || request.created_by}
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="icon" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Parts List */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Parts Requested</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {request.parts?.map((part, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                  <div>
                    <p className="font-medium text-slate-900">{getPartLabel(part.part_type)}</p>
                    {part.tyre_size && (
                      <p className="text-sm text-slate-500">Size: {part.tyre_size}</p>
                    )}
                    {part.other_description && (
                      <p className="text-sm text-slate-500">{part.other_description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-slate-700">×{part.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tyre Tread Depths */}
        {request.parts?.some(p => p.part_type === "tyres") && request.tyre_tread_depths && (
          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Tyre Tread Depths</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {request.tyre_tread_depths.lh_front != null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Left Hand Front</p>
                    <p className="text-lg font-semibold text-slate-900">{request.tyre_tread_depths.lh_front} mm</p>
                  </div>
                )}
                {request.tyre_tread_depths.rh_front != null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Right Hand Front</p>
                    <p className="text-lg font-semibold text-slate-900">{request.tyre_tread_depths.rh_front} mm</p>
                  </div>
                )}
                {request.tyre_tread_depths.lh_rear != null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Left Hand Rear</p>
                    <p className="text-lg font-semibold text-slate-900">{request.tyre_tread_depths.lh_rear} mm</p>
                  </div>
                )}
                {request.tyre_tread_depths.rh_rear != null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Right Hand Rear</p>
                    <p className="text-lg font-semibold text-slate-900">{request.tyre_tread_depths.rh_rear} mm</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Brake Pad Measurements */}
        {request.parts?.some(p => p.part_type === "front_brake_pads" || p.part_type === "rear_brake_pads") && request.brake_pad_measurements && (
          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Brake Pad Measurements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {request.brake_pad_measurements.front_brakes != null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Front Brakes</p>
                    <p className="text-lg font-semibold text-slate-900">{request.brake_pad_measurements.front_brakes} mm</p>
                  </div>
                )}
                {request.brake_pad_measurements.rear_brakes != null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Rear Brakes</p>
                    <p className="text-lg font-semibold text-slate-900">{request.brake_pad_measurements.rear_brakes} mm</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photo Gallery - All roles except restricted */}
        <PhotoGallery request={request} user={user} />

        {/* Notes */}
        {request.notes && (
          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Technician Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">{request.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Parts Interpreter Notes */}
        {(effectiveRole === 'parts_interpreter' && ['sent_to_parts', 'quoted'].includes(request.status)) ||
         (isAdmin && ['sent_to_parts', 'quoted'].includes(request.status)) ||
         request.parts_interpreter_notes ? (
          <Card className="border-0 shadow-sm mb-6 bg-purple-50 border-l-4 border-l-purple-400">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-purple-900">Parts Interpreter Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {(effectiveRole === 'parts_interpreter' || isAdmin) && ['sent_to_parts', 'quoted'].includes(request.status) ? (
                <PartsInterpreterNotesEditor request={request} user={user} onUpdate={() => refetch()} />
              ) : (
                <p className="text-purple-800 whitespace-pre-wrap">{request.parts_interpreter_notes}</p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Parts ETA Selector - editable for PI/admin-as-PI/service_manager; read-only for others if set */}
        {(effectiveRole === 'parts_interpreter' || 
          effectiveRole === 'service_manager' ||
          (isAdmin && ['sent_to_parts', 'quoted'].includes(request.status)) ||
          request.parts_eta_selection) ? (
          <PartsETASelector 
            request={request} 
            user={user} 
            onUpdate={() => refetch()} 
          />
        ) : null}

        {/* Quote Document */}
        {request.quote_pdf_url && (
          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-500" />
                Quote Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
                <div>
                  <p className="font-medium text-slate-900">Quote PDF</p>
                </div>
                <a
                  href={request.quote_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <Download className="h-5 w-5" />
                  View PDF
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Labour Line Analyser - WC on quoted status with multiple parts */}
        {(['workshop_controller', 'service_manager'].includes(effectiveRole) || isAdmin) &&
         request.status === 'quoted' &&
         request.parts?.length > 1 && (
          <LabourLineAnalyser
            request={request}
            labourRate={labourRate}
            onUpdate={() => refetch()}
          />
        )}

        {/* Labour Time Selector - fallback when no saved labour lines exist */}
        {(['workshop_controller', 'service_manager'].includes(effectiveRole) || isAdmin) &&
         request.status === 'quoted' &&
         !hasValidLabourLines && (
          <LabourTimeSelector
            request={request}
            user={user}
            labourRate={labourRate}
            onUpdate={() => refetch()}
          />
        )}

        {/* Labour Summary Panel - Service Advisor/Manager/Admin (read-only) */}
        {(['service_advisor', 'service_manager'].includes(effectiveRole) || isAdmin) && 
         ['sent_to_advisor', 'advisor_action_required', 'recommendation_added', 'sent_to_customer', 'customer_approved', 'customer_denied'].includes(request.status) && 
         labourIsValid && (
          <LabourSummaryPanel request={request} labourRate={labourRate} />
        )}

        {/* Workshop Controller Notes - visible to Service Advisors, Managers and Admin */}
        {(['service_advisor', 'service_manager'].includes(effectiveRole) || isAdmin) && request.audit_log?.some(entry => 
          entry.new_status === 'sent_to_advisor' && entry.notes
        ) && (
          <Card className="border-0 shadow-sm mb-6 bg-blue-50 border-l-4 border-l-blue-400">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-blue-900">Workshop Controller Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {request.audit_log
                .filter(entry => entry.new_status === 'sent_to_advisor' && entry.notes)
                .map((entry, idx) => (
                  <div key={idx} className="text-blue-800">
                    <p>{entry.notes}</p>
                    <p className="text-sm text-blue-600 mt-2">
                      — {entry.changed_by_name}, {formatAdelaideDateTime(entry.changed_at)}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {/* SMS Draft Generator OR Recommendation Text Generator - Service Advisor/Manager/Admin */}
        {(['service_advisor', 'service_manager'].includes(effectiveRole) || isAdmin) && 
         ['sent_to_advisor', 'advisor_action_required', 'recommendation_added', 'sent_to_customer', 'approved'].includes(request.status) && (
          request.approval_action === 'recommendation' ? (
            <RecommendationTextGenerator 
              request={request} 
              labourRate={labourRate}
              onUpdate={() => refetch()} 
            />
          ) : (
            <SMSDraftGenerator 
              request={request} 
              labourRate={labourRate}
              onUpdate={() => refetch()} 
            />
          )
        )}

        {/* WC Completion Info */}
        {request.wc_completed && (
          <Card className="border-0 shadow-sm mb-6 bg-slate-50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-slate-600" />
                Workshop Controller Completed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-slate-500">Completed By</Label>
                <p className="text-sm">{request.wc_completed_by}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Completed At</Label>
                <p className="text-sm">{formatAdelaideDateTime(request.wc_completed_at)}</p>
              </div>
              {request.wc_completion_note && (
                <div>
                  <Label className="text-xs text-slate-500">Completion Note</Label>
                  <p className="text-sm">{request.wc_completion_note}</p>
                </div>
              )}
              {(staffRole === 'admin' || staffRole === 'service_manager') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const reason = prompt("Enter reason for reopening:");
                    if (reason) reopenMutation.mutate(reason);
                  }}
                  disabled={reopenMutation.isPending}
                >
                  {reopenMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Reopen Request
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Customer Decision Info */}
        {(['customer_approved', 'customer_denied'].includes(request.status) && request.customer_decision) && (
          <Card className={`border-0 shadow-sm mb-6 ${request.customer_decision === 'approved' ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                {request.customer_decision === 'approved' ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                Customer Decision: {request.customer_decision === 'approved' ? 'Approved' : 'Denied'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-slate-500">Method</Label>
                <p className="text-sm capitalize">{request.customer_decision_method}</p>
              </div>
              {request.customer_decision_notes && (
                <div>
                  <Label className="text-xs text-slate-500">Notes</Label>
                  <p className="text-sm">{request.customer_decision_notes}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-slate-500">Recorded By</Label>
                <p className="text-sm">{request.customer_decision_recorded_by}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Recorded At</Label>
                <p className="text-sm">{formatAdelaideDateTime(request.customer_decision_recorded_at)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Workshop Controller Mark Complete */}
        {effectiveRole === 'workshop_controller' && 
         ['customer_approved', 'customer_denied'].includes(request.status) && 
         !request.wc_completed && (
          <Card className="border-0 shadow-sm mb-6 border-l-4 border-l-emerald-400">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Complete This Request</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Customer decision has been recorded. Mark this request as complete to remove it from your queue.
              </p>
              <Button
                onClick={() => setShowCompleteDialog(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Mark Complete
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {canPerformAction() && (
          <Card className="border-0 shadow-sm mb-6 border-l-4 border-l-amber-400">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Action Required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Add notes (optional)"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="mb-4"
              />

              {effectiveRole === 'parts_interpreter' && request.status === 'sent_to_parts' && (
                <Button
                  onClick={() => setShowUploadDialog(true)}
                  className="w-full bg-purple-600 hover:bg-purple-700 gap-2"
                  disabled={!request.parts_eta_selection}
                >
                  <Upload className="h-4 w-4" />
                  Upload Quote PDF
                </Button>
              )}

              {effectiveRole === 'workshop_controller' && request.status === 'quoted' && (
                <div className="space-y-3">
                  <Button
                    onClick={handleWorkshopApproval}
                    disabled={updateStatusMutation.isPending || !labourIsValid}
                    className="w-full bg-orange-600 hover:bg-orange-700 gap-2"
                  >
                    {updateStatusMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Approve Upsell
                  </Button>
                  <Button
                    onClick={handleRecommendationApproval}
                    disabled={updateStatusMutation.isPending || !labourIsValid}
                    variant="outline"
                    className="w-full border-emerald-500 text-emerald-700 hover:bg-emerald-50 gap-2"
                  >
                    {updateStatusMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Approve – Add to Recommendations
                  </Button>
                  {!labourIsValid && (
                    <p className="text-sm text-amber-600 text-center">Please save labour lines above or select labour time before approving</p>
                  )}
                </div>
              )}

              {/* Recommendation banner for advisor */}
              {['service_advisor', 'service_manager'].includes(effectiveRole) && 
               request.status === 'advisor_action_required' && 
               request.action_required_type === 'add_to_recommendations' && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3">
                  <p className="text-sm font-medium text-blue-900">
                    Action required: Add this approved service order to the customer recommendations.
                  </p>
                  <Button
                    onClick={async () => {
                      const now = new Date().toISOString();
                      await entities.PartsRequest.update(request.id, {
                        status: "recommendation_added",
                        action_required: false,
                        action_required_type: null,
                        action_cleared_at: now,
                        action_cleared_by: user.email,
                        audit_log: [
                          ...(request.audit_log || []),
                          {
                            previous_status: request.status,
                            new_status: "recommendation_added",
                            changed_by_email: user.email,
                            changed_by_name: user.full_name,
                            changed_at: now,
                            notes: "Added to customer recommendations"
                          }
                        ]
                      });
                      queryClient.invalidateQueries(['partsRequest', requestId]);
                      toast.success("Added to recommendations");
                    }}
                    disabled={updateStatusMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Add to Recommendations
                  </Button>
                </div>
              )}

              {['service_advisor', 'service_manager'].includes(effectiveRole) && request.status === 'sent_to_advisor' && (
                <Button
                  onClick={handleSendToCustomer}
                  disabled={updateStatusMutation.isPending}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 gap-2"
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Mark as Sent to Customer
                </Button>
              )}

              {['service_advisor', 'service_manager'].includes(effectiveRole) && ['sent_to_advisor', 'sent_to_customer', 'recommendation_added'].includes(request.status) && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setDecisionType('approved');
                      setShowDecisionDialog(true);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Customer Approved
                  </Button>
                  <Button
                    onClick={() => {
                      setDecisionType('denied');
                      setShowDecisionDialog(true);
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Customer Denied
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Vehicle Inspection */}
        {user && effectiveRole !== 'workshop_controller' && (
          <InspectionCard request={request} user={user} />
        )}

        {/* Audit Log */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-slate-500" />
              Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AuditLog log={request.audit_log} />
          </CardContent>
        </Card>

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Quote PDF</DialogTitle>
              <DialogDescription>
                Upload the quote PDF for this parts request
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Quote PDF File</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUploadPdfFile(e.target.files[0])}
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUploadDialog(false)} type="button">Cancel</Button>
              <Button onClick={handleUploadQuote} disabled={isUploading || !uploadPdfFile} className="bg-purple-600 hover:bg-purple-700" type="button">
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Upload & Return Quote
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Customer Decision Dialog */}
        {user && request && (
          <CustomerDecisionDialog
            open={showDecisionDialog}
            onOpenChange={setShowDecisionDialog}
            request={request}
            decision={decisionType}
            user={user}
          />
        )}

        {/* Mark Complete Dialog */}
        <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Request as Complete</DialogTitle>
              <DialogDescription>
                Remove this request from your active queue
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-sm text-slate-600">
                This will remove the request from your active queue. You can add an optional completion note.
              </p>
              <div>
                <Label htmlFor="completion-note">Completion Note (Optional)</Label>
                <Textarea
                  id="completion-note"
                  placeholder="Add any final notes..."
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => markCompleteMutation.mutate()}
                disabled={markCompleteMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {markCompleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Confirm Complete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
