import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

const PART_TYPES = [
  { value: "air_filter", label: "Air Filter" },
  { value: "pollen_filter", label: "Pollen Filter" },
  { value: "battery", label: "Battery" },
  { value: "wiper_blades", label: "Wiper Blades" },
  { value: "front_brake_pads", label: "Front Brake Pads" },
  { value: "rear_brake_pads", label: "Rear Brake Pads" },
  { value: "front_brake_rotors", label: "Front Brake Rotors" },
  { value: "rear_brake_rotors", label: "Rear Brake Rotors" },
  { value: "tyres", label: "Tyres" },
  { value: "other", label: "Other" }
];

export default function PartsSelector({ parts, onChange, tyreTreadDepths, onTyreTreadDepthsChange, brakePadMeasurements, onBrakePadMeasurementsChange }) {
  const addPart = () => {
    onChange([...parts, { part_type: "", quantity: 1, tyre_size: "", other_description: "" }]);
  };

  const removePart = (index) => {
    onChange(parts.filter((_, i) => i !== index));
  };

  const updatePart = (index, field, value) => {
    const updated = [...parts];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const updateTreadDepth = (field, value) => {
    if (onTyreTreadDepthsChange) {
      const numValue = value === "" ? null : parseFloat(value);
      onTyreTreadDepthsChange({
        ...(tyreTreadDepths || {}),
        [field]: numValue
      });
    }
  };

  const updateBrakePadMeasurement = (field, value) => {
    if (onBrakePadMeasurementsChange) {
      const numValue = value === "" ? null : parseFloat(value);
      onBrakePadMeasurementsChange({
        ...(brakePadMeasurements || {}),
        [field]: numValue
      });
    }
  };

  const hasTyres = parts.some(p => p.part_type === "tyres");
  const hasFrontBrakePads = parts.some(p => p.part_type === "front_brake_pads");
  const hasRearBrakePads = parts.some(p => p.part_type === "rear_brake_pads");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-slate-700">Parts Required</Label>
        <Button type="button" variant="outline" size="sm" onClick={addPart} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Part
        </Button>
      </div>

      {parts.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-500">No parts added yet</p>
          <Button type="button" variant="link" onClick={addPart} className="mt-2">
            Add your first part
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {parts.map((part, index) => (
          <div key={index} className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Part Type</Label>
                  <Select
                    value={part.part_type}
                    onValueChange={(value) => updatePart(index, "part_type", value)}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select part" />
                    </SelectTrigger>
                    <SelectContent>
                      {PART_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Quantity</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="1"
                    value={part.quantity || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        updatePart(index, "quantity", "");
                      } else {
                        const num = parseInt(val);
                        if (!isNaN(num) && num >= 1) {
                          updatePart(index, "quantity", num);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "" || parseInt(e.target.value) < 1) {
                        updatePart(index, "quantity", 1);
                      }
                    }}
                    placeholder="1"
                    className="bg-white"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removePart(index)}
                className="text-slate-400 hover:text-red-500 mt-5"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {part.part_type === "tyres" && (
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Tyre Size (e.g. 205/55R16) *</Label>
                <Input
                  value={part.tyre_size}
                  onChange={(e) => updatePart(index, "tyre_size", e.target.value)}
                  placeholder="Enter tyre size"
                  className="bg-white"
                />
              </div>
            )}

            {part.part_type === "other" && (
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Part Description *</Label>
                <Input
                  value={part.other_description}
                  onChange={(e) => updatePart(index, "other_description", e.target.value)}
                  placeholder="Describe the part needed"
                  className="bg-white"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {hasTyres && onTyreTreadDepthsChange && (
        <Card className="border-0 shadow-sm bg-blue-50 border-l-4 border-l-blue-400">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-900">Tyre Tread Depths</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lh_front" className="text-xs text-blue-800">Left Hand Front</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="lh_front"
                    type="number"
                    step="0.1"
                    min="0"
                    max="99.9"
                    placeholder="0.0"
                    value={tyreTreadDepths?.lh_front ?? ""}
                    onChange={(e) => updateTreadDepth("lh_front", e.target.value)}
                    className="flex-1 bg-white"
                  />
                  <span className="text-sm text-blue-700 font-medium">mm</span>
                </div>
              </div>
              <div>
                <Label htmlFor="rh_front" className="text-xs text-blue-800">Right Hand Front</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="rh_front"
                    type="number"
                    step="0.1"
                    min="0"
                    max="99.9"
                    placeholder="0.0"
                    value={tyreTreadDepths?.rh_front ?? ""}
                    onChange={(e) => updateTreadDepth("rh_front", e.target.value)}
                    className="flex-1 bg-white"
                  />
                  <span className="text-sm text-blue-700 font-medium">mm</span>
                </div>
              </div>
              <div>
                <Label htmlFor="lh_rear" className="text-xs text-blue-800">Left Hand Rear</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="lh_rear"
                    type="number"
                    step="0.1"
                    min="0"
                    max="99.9"
                    placeholder="0.0"
                    value={tyreTreadDepths?.lh_rear ?? ""}
                    onChange={(e) => updateTreadDepth("lh_rear", e.target.value)}
                    className="flex-1 bg-white"
                  />
                  <span className="text-sm text-blue-700 font-medium">mm</span>
                </div>
              </div>
              <div>
                <Label htmlFor="rh_rear" className="text-xs text-blue-800">Right Hand Rear</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="rh_rear"
                    type="number"
                    step="0.1"
                    min="0"
                    max="99.9"
                    placeholder="0.0"
                    value={tyreTreadDepths?.rh_rear ?? ""}
                    onChange={(e) => updateTreadDepth("rh_rear", e.target.value)}
                    className="flex-1 bg-white"
                  />
                  <span className="text-sm text-blue-700 font-medium">mm</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(hasFrontBrakePads || hasRearBrakePads) && onBrakePadMeasurementsChange && (
        <Card className="border-0 shadow-sm bg-orange-50 border-l-4 border-l-orange-400">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-orange-900">Brake Pad Measurements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hasFrontBrakePads && (
                <div>
                  <Label htmlFor="front_brakes" className="text-xs text-orange-800">Front Brakes</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      id="front_brakes"
                      type="number"
                      step="0.1"
                      min="0"
                      max="99.9"
                      placeholder="0.0"
                      value={brakePadMeasurements?.front_brakes ?? ""}
                      onChange={(e) => updateBrakePadMeasurement("front_brakes", e.target.value)}
                      className="flex-1 bg-white"
                    />
                    <span className="text-sm text-orange-700 font-medium">mm</span>
                  </div>
                </div>
              )}
              {hasRearBrakePads && (
                <div>
                  <Label htmlFor="rear_brakes" className="text-xs text-orange-800">Rear Brakes</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      id="rear_brakes"
                      type="number"
                      step="0.1"
                      min="0"
                      max="99.9"
                      placeholder="0.0"
                      value={brakePadMeasurements?.rear_brakes ?? ""}
                      onChange={(e) => updateBrakePadMeasurement("rear_brakes", e.target.value)}
                      className="flex-1 bg-white"
                    />
                    <span className="text-sm text-orange-700 font-medium">mm</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { PART_TYPES };