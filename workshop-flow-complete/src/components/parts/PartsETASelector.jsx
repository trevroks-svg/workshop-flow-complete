import React, { useState } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const ETA_OPTIONS = [
{ value: "stock", label: "Stock" },
{ value: "ex_vh", label: "Ex VH" },
{ value: "ex_melb", label: "Ex Melb" },
{ value: "ex_syd", label: "Ex Syd" },
{ value: "other", label: "Other" }];


export default function PartsETASelector({ request, user, onUpdate }) {
  const queryClient = useQueryClient();

  const [selection, setSelection] = useState(request.parts_eta_selection || "");
  const [customText, setCustomText] = useState(request.parts_eta_custom_text || "");
  const [changeNote, setChangeNote] = useState("");

  const isEditable = ['parts_interpreter', 'service_manager'].includes(user?.staff_role);
  const canEdit = isEditable && ['sent_to_parts', 'quoted'].includes(request.status);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const logEntry = {
        old_selection: request.parts_eta_selection || 'none',
        new_selection: data.parts_eta_selection,
        old_custom_text: request.parts_eta_custom_text || '',
        new_custom_text: data.parts_eta_custom_text || '',
        changed_by_email: user.email,
        changed_by_name: user.full_name,
        changed_at: new Date().toISOString(),
        notes: changeNote || ""
      };

      await entities.PartsRequest.update(request.id, {
        ...data,
        parts_eta_change_log: [...(request.parts_eta_change_log || []), logEntry]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['partsRequest', request.id]);
      setChangeNote("");
      toast.success("Parts ETA updated");
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(`Failed to update parts ETA: ${error.message || 'Unknown error'}`);
    }
  });

  const handleSelectionChange = (value) => {
    setSelection(value);

    if (value !== 'other') {
      updateMutation.mutate({
        parts_eta_selection: value,
        parts_eta_custom_text: null,
        parts_eta_set_by: user.email,
        parts_eta_set_at: new Date().toISOString()
      });
    }
  };

  const handleCustomTextBlur = () => {
    if (selection === 'other' && customText.trim()) {
      updateMutation.mutate({
        parts_eta_selection: 'other',
        parts_eta_custom_text: customText.trim(),
        parts_eta_set_by: user.email,
        parts_eta_set_at: new Date().toISOString()
      });
    }
  };

  const getDisplayLabel = () => {
    if (selection === 'other') {
      return customText || 'Other';
    }
    return ETA_OPTIONS.find((opt) => opt.value === selection)?.label || '';
  };

  if (!canEdit && !request.parts_eta_selection) {
    return null;
  }

  return (
    <Card className="bg-purple-200 text-card-foreground mb-6 rounded-xl border-0 shadow-sm border-l-4 border-l-purple-400">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5 text-purple-600" />
          Parts Availability (ETA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit ?
        <>
            <div>
              <Label>Parts ETA <span className="text-red-500">*</span></Label>
              <Select value={selection} onValueChange={handleSelectionChange}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select parts ETA" />
                </SelectTrigger>
                <SelectContent>
                  {ETA_OPTIONS.map((opt) =>
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                )}
                </SelectContent>
              </Select>
            </div>

            {selection === 'other' &&
          <div>
                <Label>ETA Details <span className="text-slate-500 text-xs">(recommended)</span></Label>
                <Input
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onBlur={handleCustomTextBlur}
              placeholder="e.g. Backorder – approx 5–7 days"
              className="mt-1.5" />

              </div>
          }

            <p className="text-xs text-slate-500">
              This information will be shown to Workshop Control and Service Advisors.
            </p>

            {!selection && request.status === 'sent_to_parts' &&
          <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                Parts ETA required before uploading quote
              </div>
          }

            <div>
              <Label className="text-xs text-slate-500">Change Note (optional)</Label>
              <Textarea
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Reason for ETA selection or change..."
              className="mt-1 h-16 text-sm" />

            </div>
          </> :

        <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-purple-700 font-medium">Parts ETA:</span>
              <span className="text-sm font-semibold text-purple-900">{getDisplayLabel()}</span>
            </div>
            {request.parts_eta_set_by &&
          <p className="text-xs text-purple-600 mt-2">
                Set by {request.parts_eta_set_by.split('@')[0]}
              </p>
          }
          </div>
        }
      </CardContent>
    </Card>);

}

export { ETA_OPTIONS };
