import React from 'react';
import { Badge } from "@/components/ui/badge";

const CONFIG = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Submitted to Advisor', className: 'bg-blue-100 text-blue-700' },
  reviewed: { label: 'Reviewed', className: 'bg-emerald-100 text-emerald-700' },
};

export default function InspectionStatusBadge({ status }) {
  const config = CONFIG[status] || CONFIG.draft;
  return <Badge className={config.className}>{config.label}</Badge>;
}