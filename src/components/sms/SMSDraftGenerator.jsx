import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Copy, Loader2, CheckCircle, MessageSquare, RefreshCw, Wrench, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { analyseRepairs, applyWorkshopControllerLabour, mergeRelatedRepairGroups } from "@/lib/analyseRepairs";
import { resolveLabourRate } from "@/lib/labourRate";
import { toPlainAscii, SMS_ASCII_RULES } from "@/lib/smsText";
import { plainPartName, groupsHaveOptions } from "@/lib/plainPartName";
import { apiFetch } from "@/lib/apiFetch";
import { scheduleRowToCustomer } from "@/lib/jobSchedule";

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

const hasKnownLabour = (group) => group.labour_hours != null;

const getNumericQuoteTotal = (request) => {
  const value = Number(request.quote_total);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const getValidPartsTotal = (value) => {
  if (value === "") return null;
  const total = Number(value);
  return Number.isFinite(total) && total > 0 ? total : null;
};

const getGroupPricing = (group, request, groups, labourRate, gst) => {
  if (!hasKnownLabour(group)) return null;

  // Labour rate is inc GST, so it is added as-is; only parts get GST added.
  const labourIncGst = group.labour_hours * labourRate;
  if (group.parts_cost_ex_gst != null) {
    const partsIncGst = group.parts_cost_ex_gst * gst;
    return {
      partsIncGst,
      labourIncGst,
      totalIncGst: partsIncGst + labourIncGst,
      source: 'parts_ex_gst'
    };
  }

  const quoteTotalIncGst = groups.length === 1 ? getNumericQuoteTotal(request) : null;
  if (quoteTotalIncGst == null) return null;

  return {
    partsIncGst: quoteTotalIncGst,
    labourIncGst,
    totalIncGst: quoteTotalIncGst + labourIncGst,
    source: 'quote_total'
  };
};

function getPartsText(parts = []) {
  return parts.map(p => {
    if (p.part_type === 'tyres' && p.tyre_size) return `Tyres (${p.tyre_size})`;
    if (p.part_type === 'other' && p.other_description) return p.other_description;
    return PART_TYPE_LABELS[p.part_type] || p.part_type;
  }).join(', ');
}

export default function SMSDraftGenerator({ request, labourRate: labourRateProp, onUpdate }) {
  const queryClient = useQueryClient();
  const [justCopied, setJustCopied] = useState(false);

  const [customerName, setCustomerName] = useState(request.customer_name || "");
  const [vehicleType, setVehicleType] = useState(request.vehicle_type || request.vehicle_details || "");
  const [partsTotalIncGst, setPartsTotalIncGst] = useState(
    request.quote_total != null ? String(request.quote_total) : ""
  );
  const [smsVariant, setSmsVariant] = useState(request.advisor_sms_variant || "standard");
  const [smsDraft, setSmsDraft] = useState(request.advisor_sms_draft || "");

  // Repair groups state (same approach as RecommendationTextGenerator)
  const [groups, setGroups] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showGroups, setShowGroups] = useState(true);
  const [analysisWarning, setAnalysisWarning] = useState(null);
  const [pdfMismatch, setPdfMismatch] = useState(null);
  const [scheduleMatch, setScheduleMatch] = useState(null); // 'matched' | 'not-found' | null

  // Labour is charged inc GST. PartsRequest.labour_rate_ex_gst is a legacy
  // column name — the value stored there is the inc-GST hourly rate.
  const labourRate = resolveLabourRate(labourRateProp, request.labour_rate_ex_gst);

  // Match the job card to the imported daily job schedule to fill in the
  // customer name and vehicle. Never invent them: if no row matches and the
  // request has no name/vehicle, the draft is flagged incomplete below.
  useEffect(() => {
    const jobCard = request.job_card_number;
    if (!jobCard || customerName.trim() || vehicleType.trim()) {
      setScheduleMatch(null);
      return;
    }
    let cancelled = false;
    apiFetch(`/api/job-schedule/match?jobCard=${encodeURIComponent(jobCard)}`)
      .then(res => res.json().catch(() => ({})))
      .then(data => {
        if (cancelled) return;
        const customer = scheduleRowToCustomer(data.row);
        if (data.matched && customer?.customerName) {
          setCustomerName(customer.customerName);
          if (customer.vehicle) setVehicleType(customer.vehicle);
          setScheduleMatch('matched');
        } else {
          setScheduleMatch('not-found');
        }
      })
      .catch(() => setScheduleMatch(null));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id]);
  const validPartsTotal = getValidPartsTotal(partsTotalIncGst);
  const pricingRequest = {
    ...request,
    quote_total: validPartsTotal ?? request.quote_total
  };

  const updateMutation = useMutation({
    mutationFn: (data) => entities.PartsRequest.update(request.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['partsRequest', request.id]);
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(`Failed to save SMS draft: ${error.message || 'Unknown error'}`);
    }
  });

  const updateLabour = (i, val) => {
    setGroups(prev => prev.map((g, idx) =>
      idx === i ? { ...g, labour_hours: val === '' ? null : parseFloat(val), labour_overridden: true } : g
    ));
  };

  // Step 1: Analyse and group repairs
  const runAnalysis = async () => {
    setAnalysing(true);
    setAnalysisWarning(null);
    setPdfMismatch(null);
    const partsText = getPartsText(request.parts);
    const { groups: initialised, pdfReadable, notesUsed, pdfJobMismatch } = await analyseRepairs(request, partsText);

    if (pdfJobMismatch) {
      setPdfMismatch(pdfJobMismatch);
      setAnalysisWarning(`Quote PDF does not match this job — ${pdfJobMismatch.reason} No quote has been built from it. Check the attached PDF.`);
      setGroups([]);
      setShowGroups(true);
      setAnalysing(false);
      return [];
    }

    const mergedGroups = mergeRelatedRepairGroups(initialised);
    const groupsWithSelectedLabour = applyWorkshopControllerLabour(mergedGroups, request);

    if (!pdfReadable && notesUsed) {
      setAnalysisWarning("PDF text was not available to the AI, so prices were taken from Parts Interpreter notes.");
    }

    setGroups(groupsWithSelectedLabour);
    setShowGroups(true);
    setAnalysing(false);
    return groupsWithSelectedLabour;
  };

  // Step 2: Generate SMS from groups with line-by-line repair breakdown
  const buildFallbackSms = (groupsToUse) => {
    const gst = 1.1;
    const custName = customerName.trim();
    const vehicle = vehicleType.trim();
    const greeting = custName ? `Hi ${custName},` : "Hi there,";
    const vehicleMention = vehicle ? `for your ${vehicle}` : "";
    const lines = groupsToUse.map(g => {
      const pricing = getGroupPricing(g, pricingRequest, groupsToUse, labourRate, gst);
      const name = plainPartName(g.repair_name, g.part_type);
      if (!pricing) return `${name}: price TBC`;
      return `${name}: $${pricing.totalIncGst.toFixed(2)} inc GST`;
    });
    const groupPrices = groupsToUse.map(g => getGroupPricing(g, pricingRequest, groupsToUse, labourRate, gst));
    const allPricesKnown = groupPrices.length > 0 && groupPrices.every(Boolean);
    // Two or more options are alternatives, never a single purchase: the
    // total lists each option's fitted total and never sums them (B1).
    let totalLine = 'Total: price TBC';
    if (allPricesKnown) {
      const totals = groupPrices.map(pricing => pricing.totalIncGst);
      if (groupsHaveOptions(groupsToUse)) {
        const formatted = totals.map(total => `$${total.toFixed(2)} inc GST`);
        const last = formatted.pop();
        totalLine = formatted.length
          ? `Total: ${formatted.join(', ')} or ${last} (choose one option)`
          : `Total: ${last} (choose one option)`;
      } else {
        totalLine = `Total: $${totals.reduce((sum, total) => sum + total, 0).toFixed(2)} inc GST`;
      }
    }
    return toPlainAscii([
      `${greeting}${vehicleMention ? ` ${vehicleMention}` : ''}`,
      'We recommend the following work:',
      ...lines,
      totalLine,
      'Please reply YES to approve or NO to decline. Fleurieu Motor Group Service 08 8552 1255'
    ].join('\n'));
  };

  // Step 2: Generate SMS from groups with line-by-line repair breakdown
  const generateSms = async (groupsToUse) => {
    // No groups means the quote could not be analysed (e.g. mismatched PDF)
    // — the warning banner already explains why.
    if (!groupsToUse || groupsToUse.length === 0) return;
    setGenerating(true);
    const gst = 1.1;
    const custName = customerName.trim();
    const vehicle = vehicleType.trim();
    const greeting = custName ? `Hi ${custName},` : "Hi there,";
    const vehicleMention = vehicle ? `for your ${vehicle}` : "";

    // Build per-repair lines for the prompt (plain part names, never
    // part-code jargon, and the full tyre size)
    const repairLines = groupsToUse.map(g => {
      const pricing = getGroupPricing(g, pricingRequest, groupsToUse, labourRate, gst);
      const name = plainPartName(g.repair_name, g.part_type);
      if (!pricing) return `- We recommend ${name}: price TBC`;

      const partsText = pricing.source === 'parts_ex_gst'
        ? `parts ex GST: $${g.parts_cost_ex_gst.toFixed(2)}`
        : `parts total: $${pricing.partsIncGst.toFixed(2)} inc GST`;
      return `- We recommend ${name}: $${pricing.totalIncGst.toFixed(2)} inc GST (${partsText}, labour ${g.labour_hours}h @ $${labourRate}/hr inc GST)`;
    }).join('\n');

    const groupPrices = groupsToUse.map(g => getGroupPricing(g, pricingRequest, groupsToUse, labourRate, gst));
    const allPricesKnown = groupPrices.length > 0 && groupPrices.every(Boolean);
    // Two or more options are alternatives: give both totals with "or"
    // between them, never a summed total.
    let grandTotalText = 'price TBC';
    if (allPricesKnown) {
      const totals = groupPrices.map(pricing => pricing.totalIncGst);
      if (groupsHaveOptions(groupsToUse)) {
        const formatted = totals.map(total => `$${total.toFixed(2)}`);
        const last = formatted.pop();
        grandTotalText = formatted.length
          ? `${formatted.join(', ')} or ${last} (choose one option)`
          : `${last} (choose one option)`;
      } else {
        grandTotalText = `$${totals.reduce((sum, total) => sum + total, 0).toFixed(2)}`;
      }
    }

    let variantInstructions = "";
    if (smsVariant === "short") {
      variantInstructions = "Keep it brief - under 160 characters total if possible. Summarise repairs concisely.";
    } else if (smsVariant === "detailed") {
      variantInstructions = "Include all repair names with individual prices. Can be up to 320 characters.";
    } else {
      variantInstructions = "Standard length - list all repairs with individual prices, one per line. Around 200-260 characters.";
    }

    const prompt = `Generate an SMS message for an Australian car dealership service advisor to send to a customer requesting approval for repairs.

CUSTOMER NAME: ${custName || "(not provided)"}
VEHICLE: ${vehicle || "(not specified)"}
REPAIRS REQUIRED (line by line):
${repairLines}
TOTAL INC GST: ${grandTotalText}

STYLE: ${smsVariant.toUpperCase()}
${variantInstructions}
TONE: Friendly and helpful. Phrase the work as a recommendation, not a demand.

STRICT RULES:
1. Start with: "${greeting}${vehicleMention ? ` ${vehicleMention}` : ''}"
2. Use friendly advisor language such as "we recommend" or "we've found".
3. List EACH repair job on its own line with its price (e.g. "We recommend Front Brake Service: $330.00")
4. Include a TOTAL line. If total is not supplied above, write exactly: "Total: price TBC". If two options are listed, the TOTAL line must give both totals with "or" between them (choose one option) - never add the two option prices together.
5. MUST end with: "Please reply YES to approve or NO to decline. Fleurieu Motor Group Service 08 8552 1255"
6. Professional, warm, clear, concise Australian dealership tone
7. Never invent or estimate missing prices. Output ONLY the SMS text, nothing else
8. If the notes or quote list two options for the same repair (for example two tyre brands or prices), include BOTH options with their prices so the customer can choose.
${SMS_ASCII_RULES}

Generate the SMS now:`;

    try {
      // AI generation runs on the server (the API key lives there) — never
      // from the browser. Falls back to a local draft if it fails.
      const apiResponse = await apiFetch('/api/ai/generate-advisor-sms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!apiResponse.ok) throw new Error(`AI SMS generation failed (${apiResponse.status})`);
      const apiData = await apiResponse.json();
      const generatedSms = toPlainAscii(apiData.smsText?.trim() || '') || buildFallbackSms(groupsToUse);
      setSmsDraft(generatedSms);

      await updateMutation.mutateAsync({
        customer_name: customerName,
        vehicle_type: vehicleType,
        ...(validPartsTotal != null ? { quote_total: validPartsTotal } : {}),
        advisor_sms_draft: generatedSms,
        advisor_sms_variant: smsVariant,
        advisor_sms_generated_at: new Date().toISOString()
      });

      toast.success("SMS draft generated");
    } catch (error) {
      console.error('SMS generation failed:', error);
      const fallbackSms = buildFallbackSms(groupsToUse);
      setSmsDraft(fallbackSms);
      await updateMutation.mutateAsync({
        customer_name: customerName,
        vehicle_type: vehicleType,
        ...(validPartsTotal != null ? { quote_total: validPartsTotal } : {}),
        advisor_sms_draft: fallbackSms,
        advisor_sms_variant: smsVariant,
        advisor_sms_generated_at: new Date().toISOString()
      });
      toast.warning("AI unavailable. Created an editable SMS draft instead.");
    } finally {
      setGenerating(false);
    }
  };

  // Main generate handler: analyse if no groups yet, then generate
  const handleGenerate = async () => {
    if (pdfMismatch) {
      toast.error("Quote PDF does not match this job — no SMS can be generated from it.");
      return;
    }
    try {
      let g = groups;
      if (!g) {
        g = await runAnalysis();
      }
      await generateSms(g);
    } catch (error) {
      setAnalysing(false);
      setGenerating(false);
      toast.error(`Failed to generate SMS: ${error.message || 'Unknown error'}`);
    }
  };

  const handleRegenerate = async () => {
    await generateSms(groups || []);
  };

  const handleCopyToClipboard = async () => {
    if (!smsDraft) { toast.error("No SMS draft to copy"); return; }
    try {
      await navigator.clipboard.writeText(smsDraft);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
      await updateMutation.mutateAsync({ advisor_sms_last_copied_at: new Date().toISOString() });
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleSaveDraft = async () => {
    await updateMutation.mutateAsync({
      customer_name: customerName,
      vehicle_type: vehicleType,
      ...(validPartsTotal != null ? { quote_total: validPartsTotal } : {}),
      advisor_sms_draft: smsDraft
    });
    toast.success("Draft saved");
  };

  const isLoading = analysing || generating;
  const hasGroups = groups && groups.length > 0;
  const hasDraft = !!smsDraft;

  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-cyan-600" />
          Customer SMS Draft (Copy into DMS)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500">
          AI groups repairs line by line with individual prices — same format as the invoice recommendation.
        </p>

        {/* Customer Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Customer Name <span className="text-red-500">*</span></Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Vehicle Type <span className="text-red-500">*</span></Label>
            <Input
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              placeholder="e.g. 2021 Hilux, Corolla, RAV4 Hybrid"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Parts Total inc GST</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={partsTotalIncGst}
              onChange={(e) => setPartsTotalIncGst(e.target.value)}
              placeholder="e.g. 165.00"
              className="mt-1.5"
            />
          </div>
        </div>

        {/* Message Style & Generate */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label>Message Style</Label>
            <Select value={smsVariant} onValueChange={setSmsVariant}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short (~160 chars)</SelectItem>
                <SelectItem value="standard">Standard (~220 chars)</SelectItem>
                <SelectItem value="detailed">Detailed (~320 chars)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !!pdfMismatch}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analysing ? "Analysing repairs..." : generating ? "Generating..." : "Generate SMS Draft (AI)"}
            </Button>
          </div>
        </div>

        {/* Analysis warning banner */}
        {analysisWarning && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <span>{analysisWarning}</span>
          </div>
        )}

        {/* Job schedule match — customer details come from the daily schedule, never invented */}
        {scheduleMatch === 'matched' && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            <span>Customer and vehicle matched from today's job schedule.</span>
          </div>
        )}
        {scheduleMatch === 'not-found' && (!customerName.trim() || !vehicleType.trim()) && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <span>Draft incomplete: no job schedule row for job card {request.job_card_number || '(none)'} — customer name and vehicle are not verified. Check before sending.</span>
          </div>
        )}

        {/* Repair Groups (editable labour hours) */}
        {hasGroups && (
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
                  const labourHours = g.labour_hours ?? 0;
                  // Labour rate is inc GST.
                  const labourIncGst = labourHours * labourRate;
                  const partsIncGst = g.parts_cost_ex_gst != null ? g.parts_cost_ex_gst * 1.1 : null;
                  const pricing = getGroupPricing(g, pricingRequest, groups, labourRate, 1.1);
                  const totalIncGst = pricing?.totalIncGst ?? null;

                  return (
                    <div key={i} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800 text-sm">{g.repair_name}</span>
                        {totalIncGst != null && (
                          <span className="text-sm font-semibold text-cyan-700">${totalIncGst.toFixed(2)} inc GST</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{g.parts.join(' · ')}</p>
                      {g.tyre_rule_note && (
                        <p className="text-xs text-amber-700">{g.tyre_rule_note}</p>
                      )}
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
                          {(partsIncGst != null || pricing?.source === 'quote_total') && (
                            <span>Parts: ${(partsIncGst ?? pricing.partsIncGst).toFixed(2)}</span>
                          )}
                          {labourIncGst != null && <span>Labour: ${labourIncGst.toFixed(2)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Regenerate button (after groups exist) */}
        {hasGroups && hasDraft && (
          <Button
            onClick={handleRegenerate}
            disabled={isLoading}
            variant="outline"
            className="gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {generating ? "Regenerating..." : "Regenerate SMS"}
          </Button>
        )}

        {/* SMS Draft Text Area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label>SMS Draft</Label>
            <span className="text-xs text-slate-400">{smsDraft.length} characters</span>
          </div>
          <Textarea
            value={smsDraft}
            onChange={(e) => setSmsDraft(e.target.value)}
            placeholder="Click 'Generate SMS Draft' to create a message, or type your own..."
            className="min-h-[140px] font-mono text-sm"
          />
        </div>

        {/* Copy & Save */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              onClick={handleCopyToClipboard}
              disabled={!smsDraft}
              className={`flex-1 gap-2 ${justCopied ? 'bg-green-600 hover:bg-green-700' : 'bg-cyan-600 hover:bg-cyan-700'}`}
            >
              {justCopied ? (
                <><CheckCircle className="h-4 w-4" />Copied!</>
              ) : (
                <><Copy className="h-4 w-4" />Copy to Clipboard</>
              )}
            </Button>
            <Button
              onClick={handleSaveDraft}
              variant="outline"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Copy and paste into the DMS SMS screen. Customer replies are handled via the DMS email reply process.
          </p>
        </div>

        {/* Timestamps */}
        {(request.advisor_sms_generated_at || request.advisor_sms_last_copied_at) && (
          <div className="pt-2 border-t text-xs text-slate-400 space-y-1">
            {request.advisor_sms_generated_at && (
              <p>Generated: {format(new Date(request.advisor_sms_generated_at), "dd MMM yyyy, HH:mm")}</p>
            )}
            {request.advisor_sms_last_copied_at && (
              <p>Last copied: {format(new Date(request.advisor_sms_last_copied_at), "dd MMM yyyy, HH:mm")}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
