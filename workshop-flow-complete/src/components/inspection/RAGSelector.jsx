import React from 'react';
import { cn } from "@/lib/utils";

export default function RAGSelector({ value, onChange, readonly = false }) {
  const options = [
    { key: 'green', label: 'OK', bg: 'bg-emerald-500', activeBg: 'bg-emerald-500', ring: 'ring-emerald-400', text: 'text-white' },
    { key: 'amber', label: 'Monitor', bg: 'bg-amber-400', activeBg: 'bg-amber-400', ring: 'ring-amber-300', text: 'text-white' },
    { key: 'red', label: 'Urgent', bg: 'bg-red-500', activeBg: 'bg-red-500', ring: 'ring-red-400', text: 'text-white' },
  ];

  return (
    <div className="flex gap-1.5">
      {options.map(opt => (
        <button
          key={opt.key}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange(value === opt.key ? null : opt.key)}
          className={cn(
            "flex-1 py-2 px-1 rounded-lg text-xs font-semibold transition-all border-2",
            value === opt.key
              ? `${opt.activeBg} ${opt.text} border-transparent shadow-md ring-2 ${opt.ring}`
              : "bg-slate-100 text-slate-400 border-transparent hover:bg-slate-200",
            readonly && "cursor-default opacity-80"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}