import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : `Copy ${label}`}
    </Button>
  );
}

function formatBrakeText(brakes) {
  const pad = (v) => v ? `${v}mm` : 'N/A';
  const disc = (v) => v || 'N/A';
  return [
    'BRAKE MEASUREMENTS',
    `Pad Thickness: FL ${pad(brakes.front_left)}  FR ${pad(brakes.front_right)}  RL ${pad(brakes.rear_left)}  RR ${pad(brakes.rear_right)}`,
    `Disc Condition: Front - ${disc(brakes.front_disc_condition)}  |  Rear - ${disc(brakes.rear_disc_condition)}`,
  ].join('\n');
}

function formatTyreText(tyres) {
  const depth = (v) => v ? (v.includes('mm') ? v : `${v}mm`) : 'N/A';
  return [
    'TYRE MEASUREMENTS',
    `Tread Depth: FL ${depth(tyres.front_left)}  FR ${depth(tyres.front_right)}  RL ${depth(tyres.rear_left)}  RR ${depth(tyres.rear_right)}  Spare ${depth(tyres.spare)}`,
    `Wear Pattern: ${tyres.wear_pattern || 'N/A'}`,
  ].join('\n');
}

export default function MeasurementsCopyPanel({ brakes = {}, tyres = {} }) {
  const brakeText = formatBrakeText(brakes);
  const tyreText = formatTyreText(tyres);
  const bothText = brakeText + '\n\n' + tyreText;

  return (
    <Card className="border-0 shadow-sm mb-6 bg-amber-50 border border-amber-200">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
          <Copy className="h-4 w-4" />
          Copy Measurements to Clipboard
        </CardTitle>
        <p className="text-xs text-amber-700">Copy formatted measurements to paste into the customer invoice.</p>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="space-y-3">
          {/* Preview */}
          <pre className="text-xs bg-white border border-amber-200 rounded-lg p-3 whitespace-pre-wrap text-slate-700 font-mono leading-relaxed">
            {bothText}
          </pre>
          <div className="flex gap-2 flex-wrap">
            <CopyButton text={brakeText} label="Brakes" />
            <CopyButton text={tyreText} label="Tyres" />
            <CopyButton text={bothText} label="Both" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}