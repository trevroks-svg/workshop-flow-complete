import React, { useState } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, Copy, Loader2, CheckCircle, ClipboardList, RefreshCw, Wrench, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { analyseRepairs } from "@/lib/analyseRepairs";

const PART_TYPE_LABELS = {
  air_filter: "Air Filter",
  pollen_filter: "Pollen Filter",
  battery: "Battery",
  wiper_blades: "Wiper Blades",
  front_pads: "Front Brake Pads",
  rear_pads: "Rear Brake Pads",
  front_rotors: "Front Rotors",
  rear_rotors: "Rear Rotors",
  tyres: "Tyres",
  other: "Other"
};

function getPartsText(parts = []) {
  return parts.map(p => {
    if (p.part_type === 'tyres' && p.tyre_size) return `Tyres (${p.tyre_size})`;
    if (p.part_type === 'other' && p.other_description) return p.other_description;
    return PART_TYPE_LABELS[p.part_type] || p.part_type;
  }).join(', ');
}

export default function RecommendationTextGenerator({ request, labourRate: labourRateProp, onUpdate }) {
  const queryClient = useQueryClient();
  const [recText, setRecText] = useState(request.recommendation_text || "");
  const [justCopied, setJustCopied] = useState(false);

  // Step 1: repair groups from AI analysis
  const [groups, setGroups] = useState(null); // null = not yet run
  const [analysing, setAnalysing] = useState(false);

  // Step 2: generating the final recommendation text
  const [generating, setGenerating] = useState(false);

  // Show/hide the groups panel
  const [showGroups, setShowGroups] = useState(true);

  const updateMutation = useMutation({
    mutationFn: (data) => entities.PartsRequest.update(request.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['partsRequest', request.id]);
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(`Failed to save recommendation: ${error.message || 'Unknown error'}`);
    }
  });

  const labourRate = labourRateProp || request.labour_rate_ex_gst || 110;

  const [analysisWarning, setAnalysisWarning] = useState(null);

  const analyseRepairGroups = async () => {
    setAnalysisWarning(null);
    const partsText = getPartsText(request.parts);
    const { groups: initialised, pdfReadable, notesUsed } = await analyseRepairs(request, partsText);

    if (!pdfReadable && !notesUsed) {
      setAnalysisWarning("PDF could not be read and no Parts Interpreter notes found. Parts prices are shown as TBC.");
    } else if (!pdfReadable && notesUsed) {
      setAnalysisWarning("PDF was blank — prices extracted from Parts Interpreter notes.");
    }

    setGroups(initialised);
    setShowGroups(true);
    return initialised;
  };

  // Step 1: Analyse and group repairs
  const runAnalysis = async () => {
    setAnalysing(true);
    await analyseRepairGroups();
    setAnalysing(false);
  };

  const updateLabour = (i, val) => {
    setGroups(prev => prev.map((g, idx) =>
      idx === i ? { ...g, labour_hours: val === '' ? null : parseFloat(val), labour_overridden: true } : g
    ));
  };

  // Step 2: Generate recommendation text from groups
  const buildFallbackRecommendation = (groupsToUse) => {
    const gst = 1.1;
    return groupsToUse.map(g => {
      const partsIncGst = g.parts_cost_ex_gst != null ? g.parts_cost_ex_gst * gst : null;
      const labourIncGst = g.labour_hours != null ? g.labour_hours * labourRate * gst : null;
      const totalIncGst = partsIncGst != null && labourIncGst != null ? partsIncGst + labourIncGst : null;
      if (totalIncGst != null) {
        return `Recommend ${g.repair_name}: Parts $${partsIncGst.toFixed(2)} + Labour $${labourIncGst.toFixed(2)} = Total $${totalIncGst.toFixed(2)} inc GST.`;
      }
      if (partsIncGst != null) {
        return `Recommend ${g.repair_name}: Parts $${partsIncGst.toFixed(2)} inc GST.`;
      }
      return `Recommend ${g.repair_name}: Parts price TBC.`;
    }).join('\n');
  };

  // Step 2: Generate recommendation text from groups
  const generateText = async (groupsToUse) => {
    setGenerating(true);
    const gst = 1.1;

    const repairLines = groupsToUse.map(g => {
      const partsExGst = g.parts_cost_ex_gst;
      const partsIncGst = partsExGst != null ? partsExGst * gst : null;
      const labourHours = g.labour_hours;
      const labourExGst = labourHours != null ? labourHours * labourRate : null;
      const labourIncGst = labourExGst != null ? labourExGst * gst : null;
      const totalIncGst = (partsExGst != null && labourExGst != null)
        ? ((partsExGst + labourExGst) * gst).toFixed(2)
        : null;

      return `Repair: ${g.repair_name}
  Parts: ${g.parts.join(', ')}
  Parts cost (ex GST): ${partsExGst != null ? `$${partsExGst.toFixed(2)}` : 'TBC'}
  Parts cost (inc GST): ${partsIncGst != null ? `$${partsIncGst.toFixed(2)}` : 'TBC'}
  Labour: ${labourHours != null ? `${labourHours}h @ $${labourRate}/h ex GST = $${labourIncGst?.toFixed(2)} inc GST` : 'not specified'}
  Total (inc GST): ${totalIncGst ? `$${totalIncGst}` : 'TBC'}`;
    }).join('\n\n');

    const prompt = `Generate a professional recommendation text for an Australian car dealership invoice/DMS system.
This will be copied directly into the customer's invoice.

There are ${groupsToUse.length} separate repair job(s):

${repairLines}

STRICT RULES:
1. List each repair job separately on its own line/sentence
2. For each job use format: "Recommend [repair name]: Parts $X.XX + Labour $X.XX = Total $X.XX inc GST"
3. If labour not specified for a job, just state the parts price inc GST
4. If price is TBC, write "Parts price TBC"
5. Professional, factual, neutral tone — no marketing language
6. Output ONLY the recommendation text, nothing else

Generate now:`;

    try {
      const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!apiResponse.ok) throw new Error(`AI recommendation failed (${apiResponse.status})`);
      const apiData = await apiResponse.json();
      const result = apiData.content?.[0]?.text?.trim() || buildFallbackRecommendation(groupsToUse);
      setRecText(result);
      await updateMutation.mutateAsync({ recommendation_text: result });
      toast.success("Recommendation generated");
    } catch (error) {
      console.error('Recommendation generation failed:', error);
      const fallbackText = buildFallbackRecommendation(groupsToUse);
      setRecText(fallbackText);
      await updateMutation.mutateAsync({ recommendation_text: fallbackText });
      toast.warning("AI unavailable. Created editable recommendation text instead.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateOrRegenerate = async () => {
    if (!groups) {
      setAnalysing(true);
      const initialised = await analyseRepairGroups();
      setAnalysing(false);
      await generateText(initialised);
    } else {
      await generateText(groups);
    }
  };

  const handleCopy = async () => {
    if (!recText) { toast.error("No text to copy"); return; }
    await navigator.clipboard.writeText(recText);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
    toast.success("Copied to clipboard!");
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync({ recommendation_text: recText });
    toast.success("Saved");
  };

  const hasText = !!recText;

  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-teal-600" />
          Invoice Recommendation Text
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500">
          AI analyses the quote, groups repairs, estimates labour, then generates recommendation text per job.
        </p>

        {/* Step 1: Analyse repairs button (only before groups exist) */}
        {!groups && (
          <Button
            onClick={runAnalysis}
            disabled={analysing}
            className="gap-2 bg-teal-600 hover:bg-teal-700"
          >
            {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analysing ? "Analysing repairs..." : "Analyse Repairs (AI)"}
          </Button>
        )}

        {groups && (
          <Button
            onClick={runAnalysis}
            disabled={analysing || generating}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-analyse repairs
          </Button>
        )}

        {/* Analysis warning banner */}
        {analysisWarning && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <span>{analysisWarning}</span>
          </div>
        )}

        {/* Step 2: Repair groups with editable labour */}
        {groups && groups.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              onClick={() => setShowGroups(v => !v)}
            >
              <span className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-slate-400" />
                {groups.length} repair job{groups.length !== 1 ? 's' : ''} identified — adjust labour if needed
              </span>
              {showGroups ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {showGroups && (
              <div className="divide-y divide-slate-100">
                {groups.map((g, i) => {
                  const labourExGst = g.labour_hours != null ? g.labour_hours * labourRate : null;
                  const partsIncGst = g.parts_cost_ex_gst != null ? g.parts_cost_ex_gst * 1.1 : null;
                  const totalIncGst = (g.parts_cost_ex_gst != null && labourExGst != null)
                    ? ((g.parts_cost_ex_gst + labourExGst) * 1.1) : null;

                  return (
                    <div key={i} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800 text-sm">{g.repair_name}</span>
                        {totalIncGst != null && (
                          <span className="text-sm font-semibold text-teal-700">${totalIncGst.toFixed(2)} inc GST</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{g.parts.join(' · ')}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-slate-500 whitespace-nowrap">Labour hrs</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.25"
                            value={g.labour_hours ?? ''}
                            onChange={e => updateLabour(i, e.target.value)}
                            className="w-20 h-7 text-sm"
                            placeholder="hrs"
                          />
                          {!g.labour_overridden && g.estimated_labour_hours != null && (
                            <span className="text-xs text-slate-400">AI estimate: {g.estimated_labour_hours}h</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex gap-3">
                          {partsIncGst != null && <span>Parts: ${partsIncGst.toFixed(2)}</span>}
                          {labourExGst != null && <span>Labour: ${(labourExGst * 1.1).toFixed(2)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Generate / Regenerate button */}
        {groups && (
          <Button
            onClick={() => generateText(groups)}
            disabled={generating}
            className="gap-2 bg-teal-600 hover:bg-teal-700"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating..." : hasText ? "Regenerate Recommendation" : "Generate Recommendation"}
          </Button>
        )}

        {/* One-click generate (no groups yet) shortcut — only show if no groups and no text yet */}
        {!groups && !hasText && (
          <p className="text-xs text-slate-400">Or <button className="underline" onClick={handleGenerateOrRegenerate}>skip analysis and generate directly</button></p>
        )}

        {/* Recommendation text output */}
        {(hasText || groups) && (
          <div>
            <Label>Recommendation Text</Label>
            <Textarea
              value={recText}
              onChange={(e) => setRecText(e.target.value)}
              placeholder="Click 'Generate Recommendation' to create text, or type your own..."
              className="mt-1.5 min-h-[100px]"
            />
          </div>
        )}

        {hasText && (
          <>
            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                className={`flex-1 gap-2 ${justCopied ? 'bg-green-600 hover:bg-green-700' : 'bg-teal-600 hover:bg-teal-700'}`}
              >
                {justCopied ? <><CheckCircle className="h-4 w-4" />Copied!</> : <><Copy className="h-4 w-4" />Copy to Clipboard</>}
              </Button>
              <Button onClick={handleSave} variant="outline" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button onClick={() => groups ? generateText(groups) : handleGenerateOrRegenerate()} variant="ghost" disabled={generating} title="Regenerate">
                <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Copy and paste this text into the customer's invoice in the DMS as a future service recommendation.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
