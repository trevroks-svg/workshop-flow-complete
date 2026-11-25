import React, { useState, useEffect } from 'react';
import { entities } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Save, Edit2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PART_TYPES } from '../PartsSelector';
import { resolveLabourRate } from '@/lib/labourRate';
import { apiFetch } from '@/lib/apiFetch';

const getPartLabel = (part) => {
  if (part.other_description) return part.other_description;
  if (part.tyre_size) return `Tyres (${part.tyre_size}) ×${part.quantity}`;
  const found = PART_TYPES.find(p => p.value === part.part_type);
  const label = found ? found.label : part.part_type;
  return part.quantity > 1 ? `${label} ×${part.quantity}` : label;
};

export default function LabourLineAnalyser({ request, labourRate, onUpdate }) {
  const [lines, setLines] = useState([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const hasSaved = request.labour_lines && request.labour_lines.length > 0;

  useEffect(() => {
    if (hasSaved) {
      setLines(request.labour_lines);
    }
  }, [request.id]);

  const totalHours = lines.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);
  // Labour is charged inc GST.
  const totalCost = totalHours * resolveLabourRate(labourRate);

  const buildFallbackLines = () => request.parts.map(part => ({
    part_type: part.part_type || '',
    part_label: getPartLabel(part),
    hours: 0.5,
    notes: 'Fallback estimate - please review.'
  }));

  const parseJsonObject = (value) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      const match = value.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : null;
    }
  };

  const handleAnalyse = async () => {
    setIsAnalysing(true);
    const partDescriptions = request.parts.map(p => getPartLabel(p)).join('\n');
    const prompt = `You are a workshop manager in an automotive service dealership.
Analyse the following repair job and suggest realistic labour hours for each repair item.

Parts/repairs requested:
${partDescriptions}

${request.parts_interpreter_notes ? `Parts Interpreter notes:\n${request.parts_interpreter_notes}\n` : ''}
${request.notes ? `Technician notes:\n${request.notes}\n` : ''}

Return a JSON object with a "lines" array. Each item must have:
- "part_label": the repair item name (string)
- "hours": suggested labour hours as a number (e.g. 1.5)
- "notes": brief justification (1 sentence, optional)

Be concise and practical. Use standard flat-rate times. Return ONLY the JSON.`;

    try {
      // AI analysis runs on the server (the API key lives there) — never
      // from the browser. Falls back to local lines if it fails.
      const apiResponse = await apiFetch('/api/ai/analyse-labour', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!apiResponse.ok) throw new Error(`AI labour analysis failed (${apiResponse.status})`);
      const apiData = await apiResponse.json();
      const result = parseJsonObject(apiData.text || '') || {};

      const suggested = (result.lines || []).map((l, i) => ({
        part_type: request.parts[i]?.part_type || '',
        part_label: l.part_label,
        hours: l.hours,
        notes: l.notes || ''
      }));
      setLines(suggested.length ? suggested : buildFallbackLines());
      if (!suggested.length) toast.warning('AI returned no labour lines. Created editable fallback lines.');
    } catch (error) {
      console.error('Labour analysis failed:', error);
      setLines(buildFallbackLines());
      toast.warning('AI unavailable. Created editable fallback labour lines.');
    } finally {
      setIsEditing(true);
      setIsAnalysing(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await entities.PartsRequest.update(request.id, { labour_lines: lines });
      setIsEditing(false);
      toast.success('Labour lines saved');
      onUpdate();
    } catch (error) {
      toast.error(`Failed to save labour lines: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateLine = (index, field, value) => {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  return (
    <Card className="border-0 shadow-sm mb-6 border-l-4 border-l-violet-400">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setIsExpanded(e => !e)}>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2 text-violet-900">
            <Sparkles className="h-4 w-4" />
            Labour Line Analysis
            {hasSaved && !isEditing && (
              <span className="text-xs font-normal bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Saved</span>
            )}
          </span>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Analyse the quote and suggest labour hours per repair item before approving.
          </p>

          {lines.length === 0 ? (
            <Button
              onClick={handleAnalyse}
              disabled={isAnalysing}
              className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
            >
              {isAnalysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isAnalysing ? 'Analysing…' : 'Analyse Labour with AI'}
            </Button>
          ) : (
            <>
              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div key={index} className="bg-slate-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{line.part_label}</p>
                        {line.notes && (
                          <p className="text-xs text-slate-500 mt-0.5">{line.notes}</p>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={line.hours}
                            onChange={e => updateLine(index, 'hours', parseFloat(e.target.value) || 0)}
                            className="w-20 text-center h-8 text-sm"
                          />
                          <span className="text-xs text-slate-500">hrs</span>
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-slate-700 shrink-0">
                          {line.hours} hrs
                        </span>
                      )}
                    </div>
                    {isEditing && (
                      <Input
                        value={line.notes}
                        onChange={e => updateLine(index, 'notes', e.target.value)}
                        placeholder="Notes (optional)"
                        className="h-7 text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between bg-violet-50 rounded-lg p-3 border border-violet-100">
                <span className="text-sm font-medium text-violet-900">Total Labour</span>
                <div className="text-right">
                  <p className="text-sm font-bold text-violet-900">{totalHours.toFixed(1)} hrs</p>
                  <p className="text-xs text-violet-600">${totalCost.toFixed(2)} inc GST</p>
                </div>
              </div>

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleAnalyse}
                      disabled={isAnalysing || isSaving}
                      className="gap-2"
                    >
                      {isAnalysing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Re-analyse
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 bg-violet-600 hover:bg-violet-700 gap-2"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Labour Lines
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="gap-2"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
