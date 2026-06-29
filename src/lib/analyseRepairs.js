/**
 * Shared repair analysis logic used by SMSDraftGenerator, RecommendationTextGenerator,
 * and FollowUpReport.
 *
 * Pricing analysis now runs through the secure backend route. If the backend or AI
 * provider fails, callers still receive editable fallback groups.
 */

import { entities } from '@/api/entities';
import { extractPdfTextFromUrl } from '@/lib/extractPdfText';
import { parseQuoteText } from '@/lib/quoteParser';

const PART_LABELS = {
  air_filter: "Air Filter",
  pollen_filter: "Pollen Filter",
  battery: "Battery",
  wiper_blades: "Wiper Blades",
  front_brake_pads: "Front Brake Pads",
  rear_brake_pads: "Rear Brake Pads",
  front_brake_rotors: "Front Brake Rotors",
  rear_brake_rotors: "Rear Brake Rotors",
  tyres: "Tyres",
  other: "Other"
};

function getPartLabel(part) {
  if (part.part_type === 'tyres' && part.tyre_size) return `Tyres (${part.tyre_size})`;
  if (part.part_type === 'other' && part.other_description) return part.other_description;
  return PART_LABELS[part.part_type] || part.part_type || 'Repair';
}

function fallbackGroups(request) {
  return (request.parts || []).map(part => ({
    repair_name: getPartLabel(part),
    parts: [getPartLabel(part)],
    parts_cost_ex_gst: null,
    estimated_labour_hours: 0.5,
    labour_hours: 0.5,
    labour_overridden: false
  }));
}

async function hydrateRequestFromDatabase(request) {
  if ((request.quote_pdf_text || '').trim() || !request.id) {
    return request;
  }

  try {
    const latestRequest = await entities.PartsRequest.get(request.id);
    return latestRequest ? { ...request, ...latestRequest } : request;
  } catch (error) {
    console.warn('Could not refresh request before repair analysis:', error);
    return request;
  }
}

async function recoverQuotePdfText(request) {
  const hydratedRequest = await hydrateRequestFromDatabase(request);

  if ((hydratedRequest.quote_pdf_text || '').trim() || !hydratedRequest.quote_pdf_url) {
    return hydratedRequest;
  }

  try {
    const quotePdfText = await extractPdfTextFromUrl(hydratedRequest.quote_pdf_url);
    if (!quotePdfText) return hydratedRequest;

    const quotePdfExtractedAt = new Date().toISOString();
    const recoveredRequest = {
      ...hydratedRequest,
      quote_pdf_text: quotePdfText,
      quote_pdf_extracted_at: quotePdfExtractedAt
    };

    if (hydratedRequest.id) {
      entities.PartsRequest.update(hydratedRequest.id, {
        quote_pdf_text: quotePdfText,
        quote_pdf_extracted_at: quotePdfExtractedAt
      }).catch(error => {
        console.warn('Could not save recovered quote PDF text:', error);
      });
    }

    return recoveredRequest;
  } catch (error) {
    console.warn('Could not recover quote PDF text from uploaded PDF:', error);
    return hydratedRequest;
  }
}

function initialiseGroups(groups = [], request) {
  return (groups.length ? groups : fallbackGroups(request)).map(g => ({
    ...g,
    parts_cost_ex_gst: (g.parts_cost_ex_gst === 0 || g.parts_cost_ex_gst == null) ? null : g.parts_cost_ex_gst,
    labour_hours: g.estimated_labour_hours ?? null,
    labour_overridden: false
  }));
}

function buildAnalysisResult(result, request, hasPdfText) {
  return {
    groups: initialiseGroups(result.groups || [], request),
    pdfReadable: hasPdfText ? (result.pdf_was_readable ?? true) : false,
    notesUsed: result.notes_used_for_pricing ?? false,
    lineItems: result.line_items || [],
    quoteTotalIncGst: result.quote_total_inc_gst ?? null
  };
}

/**
 * Main export: run repair analysis for a PartsRequest.
 * Returns initialised group array ready for labour editing.
 * Also returns meta: { pdfReadable, notesUsed }.
 */
export async function analyseRepairs(request, partsText) {
  const requestForAnalysis = await recoverQuotePdfText(request);
  const hasPdfText = !!(requestForAnalysis.quote_pdf_text || "").trim();
  const rulesAnalysis = parseQuoteText(requestForAnalysis.quote_pdf_text);

  if (rulesAnalysis.success) {
    return buildAnalysisResult(rulesAnalysis.result, requestForAnalysis, hasPdfText);
  }

  try {
    const apiResponse = await fetch('/api/ai/analyse-repairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: requestForAnalysis, partsText })
    });
    if (!apiResponse.ok) throw new Error(`AI analysis failed (${apiResponse.status})`);

    const apiData = await apiResponse.json();
    if (!apiData.success) throw new Error(apiData.error || 'AI analysis failed');

    const result = apiData.result || {};
    return buildAnalysisResult(result, requestForAnalysis, hasPdfText);
  } catch (error) {
    console.error('AI repair analysis failed:', error);
    return {
      groups: fallbackGroups(requestForAnalysis),
      pdfReadable: hasPdfText,
      notesUsed: !!(requestForAnalysis.parts_interpreter_notes || '').trim()
    };
  }
}
