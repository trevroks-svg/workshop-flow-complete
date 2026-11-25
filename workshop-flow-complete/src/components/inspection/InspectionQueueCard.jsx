import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, ChevronRight } from "lucide-react";
import { createPageUrl } from "@/utils";
import InspectionStatusBadge from "./InspectionStatusBadge";
import { INSPECTION_ITEMS } from "./MultiPointSection";

const formatDT = (v) => {
  if (!v) return '';
  const s = String(v);
  const hasZone = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s);
  const d = new Date(hasZone ? s : `${s}Z`);
  return d.toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
};

export default function InspectionQueueCard({ inspection }) {
  const redCount = INSPECTION_ITEMS.filter(i => inspection.multipoint_inspection?.[i.id]?.status === 'red').length;
  const amberCount = INSPECTION_ITEMS.filter(i => inspection.multipoint_inspection?.[i.id]?.status === 'amber').length;

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-100 rounded-lg shrink-0">
              <ClipboardList className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">
                  Job #{inspection.job_card_number}
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  Vehicle Inspection
                </span>
                <InspectionStatusBadge status={inspection.status} />
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {inspection.customer_name && (
                  <span className="text-sm text-slate-500">{inspection.customer_name}</span>
                )}
                {inspection.vehicle_make_model && (
                  <span className="text-sm text-slate-400">· {inspection.vehicle_make_model}</span>
                )}
                <span className="text-xs text-slate-400">
                  {inspection.status === 'submitted' ? `Submitted ${formatDT(inspection.submitted_at)}` : `Reviewed ${formatDT(inspection.reviewed_at)}`}
                  {inspection.technician_name && ` by ${inspection.technician_name}`}
                </span>
              </div>
              {(redCount > 0 || amberCount > 0) && (
                <div className="flex items-center gap-2 mt-1.5">
                  {redCount > 0 && (
                    <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      🔴 {redCount} urgent
                    </span>
                  )}
                  {amberCount > 0 && (
                    <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      🟡 {amberCount} monitor
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <Link to={`${createPageUrl('VehicleInspection')}?id=${inspection.id}${inspection.request_id ? `&request_id=${inspection.request_id}` : ''}`}>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
              View
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}