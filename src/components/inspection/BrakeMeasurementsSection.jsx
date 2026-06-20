import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const BRAKE_MM = ['12','11','10','9','8','7','6','5','4','3','2','1','0'];
const DISC_CONDITIONS = ['OK', 'Worn', 'Scored', 'Requires Attention'];

const SAFE_THRESHOLD = 3;

function mmColor(val) {
  if (!val || val === '') return '';
  const n = parseInt(val);
  if (n <= 2) return 'text-red-600 font-bold';
  if (n <= SAFE_THRESHOLD) return 'text-amber-600 font-semibold';
  return 'text-emerald-600';
}

function BrakeDrop({ label, value, onChange, readonly }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      {readonly ? (
        <div className={cn("text-sm font-semibold p-2 bg-slate-50 rounded-lg", mmColor(value))}>
          {value ? `${value} mm` : '—'}
        </div>
      ) : (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger className={cn("h-9", mmColor(value))}>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {BRAKE_MM.map(mm => (
              <SelectItem key={mm} value={mm} className={mmColor(mm)}>
                {mm} mm
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function DiscDrop({ label, value, onChange, readonly }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      {readonly ? (
        <div className={cn("text-sm font-semibold p-2 bg-slate-50 rounded-lg", value === 'Requires Attention' ? 'text-red-600' : value === 'Worn' || value === 'Scored' ? 'text-amber-600' : 'text-emerald-600')}>
          {value || '—'}
        </div>
      ) : (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {DISC_CONDITIONS.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export default function BrakeMeasurementsSection({ values = {}, onChange, readonly = false }) {
  const set = (key, val) => onChange({ ...values, [key]: val });

  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Brake Measurements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Brake Pad Thickness</p>
          <div className="grid grid-cols-2 gap-3">
            <BrakeDrop label="Front Left Pad" value={values.front_left} onChange={v => set('front_left', v)} readonly={readonly} />
            <BrakeDrop label="Front Right Pad" value={values.front_right} onChange={v => set('front_right', v)} readonly={readonly} />
            <BrakeDrop label="Rear Left Pad" value={values.rear_left} onChange={v => set('rear_left', v)} readonly={readonly} />
            <BrakeDrop label="Rear Right Pad" value={values.rear_right} onChange={v => set('rear_right', v)} readonly={readonly} />
          </div>
          {!readonly && (
            <p className="text-xs text-slate-400 mt-2">⚠️ Values of 3mm or below are highlighted</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Disc Condition</p>
          <div className="grid grid-cols-2 gap-3">
            <DiscDrop label="Front Disc Condition" value={values.front_disc_condition} onChange={v => set('front_disc_condition', v)} readonly={readonly} />
            <DiscDrop label="Rear Disc Condition" value={values.rear_disc_condition} onChange={v => set('rear_disc_condition', v)} readonly={readonly} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}