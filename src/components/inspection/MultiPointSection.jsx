import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import RAGSelector from "./RAGSelector";

export const INSPECTION_ITEMS = [
  { id: 'engine_oil', label: 'Engine Oil Level/Condition', category: 'Fluids & Under Bonnet' },
  { id: 'coolant', label: 'Coolant Level/Condition', category: 'Fluids & Under Bonnet' },
  { id: 'brake_fluid', label: 'Brake Fluid Condition', category: 'Fluids & Under Bonnet' },
  { id: 'battery', label: 'Battery Condition', category: 'Fluids & Under Bonnet' },
  { id: 'belts', label: 'Belts', category: 'Fluids & Under Bonnet' },
  { id: 'hoses', label: 'Hoses', category: 'Fluids & Under Bonnet' },
  { id: 'drive_belts', label: 'Drive Belts', category: 'Fluids & Under Bonnet' },
  { id: 'air_filter', label: 'Air Filter', category: 'Filters' },
  { id: 'cabin_filter', label: 'Cabin Filter', category: 'Filters' },
  { id: 'wiper_blades', label: 'Wiper Blades', category: 'Electrical & Lights' },
  { id: 'washer_operation', label: 'Washer Operation', category: 'Electrical & Lights' },
  { id: 'exterior_lights', label: 'Exterior Lights', category: 'Electrical & Lights' },
  { id: 'front_brakes', label: 'Front Brakes', category: 'Brakes & Tyres' },
  { id: 'rear_brakes', label: 'Rear Brakes', category: 'Brakes & Tyres' },
  { id: 'front_tyres', label: 'Front Tyres', category: 'Brakes & Tyres' },
  { id: 'rear_tyres', label: 'Rear Tyres', category: 'Brakes & Tyres' },
  { id: 'suspension', label: 'Suspension', category: 'Chassis & Driveline' },
  { id: 'steering', label: 'Steering', category: 'Chassis & Driveline' },
  { id: 'cv_boots', label: 'CV Boots', category: 'Chassis & Driveline' },
  { id: 'underbody_leaks', label: 'Underbody Leaks', category: 'Chassis & Driveline' },
  { id: 'exhaust', label: 'Exhaust Condition', category: 'Chassis & Driveline' },
  { id: 'road_test', label: 'Road Test Result', category: 'Road Test' },
];

const CATEGORIES = [...new Set(INSPECTION_ITEMS.map(i => i.category))];

export default function MultiPointSection({ values = {}, onChange, readonly = false }) {
  const [expandedNotes, setExpandedNotes] = useState({});

  const handleStatus = (id, status) => {
    onChange({ ...values, [id]: { ...values[id], status } });
  };

  const handleNotes = (id, notes) => {
    onChange({ ...values, [id]: { ...values[id], notes } });
  };

  const toggleNotes = (id) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-slate-500" />
          Multipoint Inspection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {CATEGORIES.map(category => (
          <div key={category}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{category}</h4>
            <div className="space-y-2">
              {INSPECTION_ITEMS.filter(i => i.category === category).map(item => {
                const val = values[item.id] || {};
                const notesOpen = expandedNotes[item.id] || !!val.notes;
                return (
                  <div key={item.id} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 leading-tight">{item.label}</p>
                      </div>
                      <div className="w-48 shrink-0">
                        <RAGSelector
                          value={val.status || null}
                          onChange={(s) => handleStatus(item.id, s)}
                          readonly={readonly}
                        />
                      </div>
                      {!readonly && (
                        <button
                          type="button"
                          onClick={() => toggleNotes(item.id)}
                          className="text-slate-400 hover:text-slate-600 shrink-0"
                          title="Add note"
                        >
                          {notesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                    {(notesOpen || val.notes) && (
                      <div className="mt-2">
                        {readonly ? (
                          val.notes ? <p className="text-sm text-slate-600 italic">{val.notes}</p> : null
                        ) : (
                          <Input
                            value={val.notes || ''}
                            onChange={(e) => handleNotes(item.id, e.target.value)}
                            placeholder="Add note..."
                            className="text-sm h-8 bg-white"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}