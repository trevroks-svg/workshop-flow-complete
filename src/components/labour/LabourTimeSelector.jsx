import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { resolveLabourRate } from "@/lib/labourRate";

const LABOUR_OPTIONS = [
  { value: "0", label: "0 Hours" },
  { value: "0.5", label: "0.5 Hours" },
  { value: "1", label: "1 Hour" },
  { value: "2", label: "2 Hours" },
  { value: "3", label: "3 Hours" },
  { value: "other", label: "Other (Custom)" }
];

export default function LabourTimeSelector({ request, user, labourRate: labourRateProp, onUpdate }) {
  const queryClient = useQueryClient();
  
  const [selection, setSelection] = useState(request.labour_time_selection || "");
  const [customHours, setCustomHours] = useState(request.labour_time_custom_hours || "");
  const [changeNote, setChangeNote] = useState("");

  // Labour is charged inc GST. PartsRequest.labour_rate_ex_gst is a legacy
  // column name — the value stored there is the inc-GST hourly rate.
  const labourRateIncGst = resolveLabourRate(labourRateProp, request.labour_rate_ex_gst);
  const gstPercent = 10;

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      // Create labour change log entry
      const oldSelection = request.labour_time_selection;
      const oldHours = request.labour_time_selection === 'other' 
        ? request.labour_time_custom_hours 
        : parseFloat(request.labour_time_selection || 0);
      
      const newHours = data.labour_time_selection === 'other'
        ? data.labour_time_custom_hours
        : parseFloat(data.labour_time_selection || 0);

      const logEntry = {
        old_selection: oldSelection || 'none',
        new_selection: data.labour_time_selection,
        old_hours: oldHours || 0,
        new_hours: newHours,
        changed_by_email: user.email,
        changed_by_name: user.full_name,
        changed_at: new Date().toISOString(),
        notes: changeNote || ""
      };

      await entities.PartsRequest.update(request.id, {
        ...data,
        // Legacy column name; the value is the inc-GST hourly rate.
        labour_rate_ex_gst: labourRateIncGst,
        gst_percent: gstPercent,
        labour_change_log: [...(request.labour_change_log || []), logEntry]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['partsRequest', request.id]);
      setChangeNote("");
      toast.success("Labour time updated");
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(`Failed to update labour time: ${error.message || 'Unknown error'}`);
    }
  });

  const handleSelectionChange = (value) => {
    setSelection(value);
    
    if (value !== 'other') {
      updateMutation.mutate({
        labour_time_selection: value,
        labour_time_custom_hours: null,
        labour_time_selected_by: user.email,
        labour_time_selected_at: new Date().toISOString()
      });
    }
  };

  const handleCustomHoursChange = (value) => {
    setCustomHours(value);
  };

  const handleCustomHoursBlur = () => {
    if (selection === 'other' && customHours !== "" && !isNaN(parseFloat(customHours))) {
      updateMutation.mutate({
        labour_time_selection: 'other',
        labour_time_custom_hours: parseFloat(customHours),
        labour_time_selected_by: user.email,
        labour_time_selected_at: new Date().toISOString()
      });
    }
  };

  const getFinalHours = () => {
    if (selection === 'other') {
      return parseFloat(customHours) || 0;
    }
    return parseFloat(selection) || 0;
  };

  const isValid = selection && (selection !== 'other' || (customHours !== "" && !isNaN(parseFloat(customHours))));

  return (
    <Card className="border-0 shadow-sm mb-6 border-l-4 border-l-blue-400">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          Labour Time for Quote
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Labour Time</Label>
            <Select value={selection} onValueChange={handleSelectionChange}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select labour time" />
              </SelectTrigger>
              <SelectContent>
                {LABOUR_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selection === 'other' && (
            <div>
              <Label>Custom Labour Hours <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={customHours}
                onChange={(e) => handleCustomHoursChange(e.target.value)}
                onBlur={handleCustomHoursBlur}
                placeholder="e.g. 1.25"
                className="mt-1.5"
              />
            </div>
          )}
        </div>

        {selection === 'other' && !customHours && (
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            Custom hours required before approval
          </div>
        )}

        {isValid && (
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            Labour: {getFinalHours()} hrs (Inc GST will be calculated for Advisor)
          </div>
        )}

        <p className="text-xs text-slate-500">
          Labour is charged at ${labourRateIncGst.toFixed(2)} per hour (inc GST).
        </p>

        {/* Optional change note */}
        <div>
          <Label className="text-xs text-slate-500">Change Note (optional)</Label>
          <Textarea
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Reason for labour time selection..."
            className="mt-1 h-16 text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export { LABOUR_OPTIONS };
