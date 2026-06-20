import React from 'react';
import { INSPECTION_ITEMS } from './MultiPointSection';

export default function InspectionSummaryBanner({ multipoint = {} }) {
  const red = INSPECTION_ITEMS.filter(i => multipoint[i.id]?.status === 'red');
  const amber = INSPECTION_ITEMS.filter(i => multipoint[i.id]?.status === 'amber');

  if (red.length === 0 && amber.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {red.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-bold text-red-700 mb-2">🔴 Urgent — Requires Immediate Attention ({red.length})</p>
          <ul className="space-y-1">
            {red.map(item => (
              <li key={item.id} className="text-sm text-red-700 flex items-start gap-2">
                <span>•</span>
                <span>
                  {item.label}
                  {multipoint[item.id]?.notes && (
                    <span className="text-red-500 italic ml-1">— {multipoint[item.id].notes}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {amber.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-bold text-amber-700 mb-2">🟡 Monitor — Attention Required Soon ({amber.length})</p>
          <ul className="space-y-1">
            {amber.map(item => (
              <li key={item.id} className="text-sm text-amber-700 flex items-start gap-2">
                <span>•</span>
                <span>
                  {item.label}
                  {multipoint[item.id]?.notes && (
                    <span className="text-amber-600 italic ml-1">— {multipoint[item.id].notes}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}