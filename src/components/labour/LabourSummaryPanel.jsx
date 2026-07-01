import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

const LABOUR_LABELS = {
  "0": "0 Hours",
  "0.5": "0.5 Hours",
  "1": "1 Hour",
  "2": "2 Hours",
  "3": "3 Hours",
  "other": "Custom"
};

export default function LabourSummaryPanel({ request, labourRate: labourRateProp }) {
  const labourRateExGST = request.labour_rate_ex_gst || labourRateProp || 110;
  const gstPercent = request.gst_percent || 10;
  const validLabourLines = Array.isArray(request.labour_lines)
    ? request.labour_lines.filter(line => Number.isFinite(Number(line.hours)))
    : [];
  const hasLabourLines = validLabourLines.length > 0;

  const getFinalHours = () => {
    if (hasLabourLines) {
      return validLabourLines.reduce((sum, line) => sum + Number(line.hours), 0);
    }
    if (request.labour_time_selection === 'other') {
      return request.labour_time_custom_hours || 0;
    }
    return parseFloat(request.labour_time_selection) || 0;
  };

  const finalHours = getFinalHours();
  const labourCostExGST = finalHours * labourRateExGST;
  const labourGSTAmount = labourCostExGST * (gstPercent / 100);
  const labourCostIncGST = labourCostExGST + labourGSTAmount;

  if (!hasLabourLines && !request.labour_time_selection) {
    return null;
  }

  return (
    <Card className="border-0 shadow-sm mb-6 bg-blue-50">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
          <Clock className="h-5 w-5 text-blue-600" />
          Labour Cost Summary (GST Inclusive)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-blue-700">
              Labour Time: {hasLabourLines
                ? `${finalHours} Hours (Saved Labour Lines)`
                : request.labour_time_selection === 'other'
                  ? `${request.labour_time_custom_hours} Hours (Custom)`
                  : LABOUR_LABELS[request.labour_time_selection]}
            </span>
            <span className="font-medium text-blue-900">{finalHours} hrs</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-700">Labour Rate (Ex GST)</span>
            <span className="font-medium text-blue-900">${labourRateExGST.toFixed(2)}/hr</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-700">Labour Cost (Ex GST)</span>
            <span className="font-medium text-blue-900">${labourCostExGST.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-700">GST ({gstPercent}%)</span>
            <span className="font-medium text-blue-900">${labourGSTAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold border-t border-blue-200 pt-3">
            <span className="text-blue-900">Labour Cost (Inc GST)</span>
            <span className="text-blue-600 text-lg">${labourCostIncGST.toFixed(2)}</span>
          </div>
        </div>
        <p className="text-xs text-blue-600 mt-3">
          Use the Inc GST amount for customer quotes
        </p>
      </CardContent>
    </Card>
  );
}
