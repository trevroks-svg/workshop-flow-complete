import React from 'react';
import { Clock, User, ArrowRight } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { formatDateTime } from "@/lib/dateUtils";

export default function AuditLog({ log = [] }) {
  if (!log || log.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500">
        No status changes recorded
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {log.map((entry, index) => (
        <div key={index} className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {entry.previous_status && (
              <>
                <StatusBadge status={entry.previous_status} />
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </>
            )}
            <StatusBadge status={entry.new_status} />
          </div>
          
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {entry.changed_by_name || entry.changed_by_email}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDateTime(entry.changed_at)}
            </div>
          </div>
          
          {entry.notes && (
            <p className="text-sm text-slate-600 mt-2 italic">"{entry.notes}"</p>
          )}
        </div>
      ))}
    </div>
  );
}