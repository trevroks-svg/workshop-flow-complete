import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, ChevronRight, Plus } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import InspectionStatusBadge from "./InspectionStatusBadge";
import { INSPECTION_ITEMS } from "./MultiPointSection";

const formatDT = (v) => {
  if (!v) return '';
  const s = String(v);
  const hasZone = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s);
  const d = new Date(hasZone ? s : `${s}Z`);
  return d.toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

export default function InspectionCard({ request, user }) {
  const staffRole = user?.staff_role || 'technician';
  const isTechnician = staffRole === 'technician';

  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ['vehicleInspections', request.id],
    queryFn: () => entities.VehicleInspection.filter({ request_id: request.id }),
    enabled: !!request.id
  });

  const inspection = inspections[0];

  const redCount = inspection ? INSPECTION_ITEMS.filter(i => inspection.multipoint_inspection?.[i.id]?.status === 'red').length : 0;
  const amberCount = inspection ? INSPECTION_ITEMS.filter(i => inspection.multipoint_inspection?.[i.id]?.status === 'amber').length : 0;

  const canCreate = isTechnician || staffRole === 'admin';
  const canView = inspection && (
    ['service_advisor', 'service_manager', 'workshop_controller', 'admin'].includes(staffRole) ||
    isTechnician
  );

  if (isLoading) return null;

  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-400" />
            <span className="font-semibold text-slate-800">Vehicle Inspection</span>
            {inspection && <InspectionStatusBadge status={inspection.status} />}
          </div>
          {!inspection && canCreate && (
            <Link to={`${createPageUrl('VehicleInspection')}?request_id=${request.id}`}>
              <Button size="sm" className="gap-1.5 bg-slate-900 hover:bg-slate-800">
                <Plus className="h-4 w-4" />
                Start Inspection
              </Button>
            </Link>
          )}
          {inspection && canView && (
            <Link to={`${createPageUrl('VehicleInspection')}?id=${inspection.id}&request_id=${request.id}`}>
              <Button size="sm" variant="outline" className="gap-1.5">
                {isTechnician && inspection.status === 'draft' ? 'Continue' : 'View'}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        {inspection && inspection.status !== 'draft' && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {redCount > 0 && (
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded-full">
                🔴 {redCount} urgent
              </span>
            )}
            {amberCount > 0 && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                🟡 {amberCount} monitor
              </span>
            )}
            {redCount === 0 && amberCount === 0 && (
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                ✅ All clear
              </span>
            )}
            <span className="text-xs text-slate-400">
              {inspection.status === 'submitted' ? `Submitted ${formatDT(inspection.submitted_at)}` : `Reviewed ${formatDT(inspection.reviewed_at)}`}
            </span>
          </div>
        )}

        {inspection?.status === 'draft' && isTechnician && (
          <p className="mt-2 text-xs text-amber-600 font-medium">Draft — not yet submitted to Service Advisor</p>
        )}
      </CardContent>
    </Card>
  );
}