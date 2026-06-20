import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TYRE_MM = ['10','9','8','7','6','5','4','3','2','1','Below 1 mm'];
const WEAR_PATTERNS = ['Normal', 'Inner edge wear', 'Outer edge wear', 'Uneven wear', 'Cracking', 'Damage present'];

const SAFE_THRESHOLD = 2;

function mmColor(val) {
  if (!val || val === '') return '';
  if (val === 'Below 1 mm') return 'text-red-600 font-bold';
  const n = parseInt(val);
  if (n <= SAFE_THRESHOLD) return 'text-red-600 font-bold';
  if (n <= 3) return 'text-amber-600 font-semibold';
  return 'text-emerald-600';
}

function TyreDrop({ label, value, onChange, readonly }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      {readonly ? (
        <div className={cn("text-sm font-semibold p-2 bg-slate-50 rounded-lg", mmColor(value))}>
          {value ? (value.includes('mm') ? value : `${value} mm`) : '—'}
        </div>
      ) : (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger className={cn("h-9", mmColor(value))}>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {TYRE_MM.map(mm => (
              <SelectItem key={mm} value={mm} className={mmColor(mm)}>
                {mm.includes('mm') ? mm : `${mm} mm`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export default function TyreMeasurementsSection({ values = {}, onChange, readonly = false }) {
  const set = (key, val) => onChange({ ...values, [key]: val });

  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Tyre Measurements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Tread Depth</p>
          <div className="grid grid-cols-2 gap-3">
            <TyreDrop label="Front Left" value={values.front_left} onChange={v => set('front_left', v)} readonly={readonly} />
            <TyreDrop label="Front Right" value={values.front_right} onChange={v => set('front_right', v)} readonly={readonly} />
            <TyreDrop label="Rear Left" value={values.rear_left} onChange={v => set('rear_left', v)} readonly={readonly} />
            <TyreDrop label="Rear Right" value={values.rear_right} onChange={v => set('rear_right', v)} readonly={readonly} />
            <TyreDrop label="Spare (optional)" value={values.spare} onChange={v => set('spare', v)} readonly={readonly} />
          </div>
          {!readonly && (
            <p className="text-xs text-slate-400 mt-2">⚠️ Values of 2mm or below are highlighted red</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Tyre Wear Pattern</p>
          {readonly ? (
            <div className="text-sm font-medium p-2 bg-slate-50 rounded-lg">{values.wear_pattern || '—'}</div>
          ) : (
            <Select value={values.wear_pattern || ''} onValueChange={v => set('wear_pattern', v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select wear pattern" />
              </SelectTrigger>
              <SelectContent>
                {WEAR_PATTERNS.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
    </Card>
  );
}