/**
 * Shared repair analysis logic used by SMSDraftGenerator, RecommendationTextGenerator,
 * and FollowUpReport.
 *
 * Pricing analysis now runs through the secure backend route. If the backend or AI
 * provider fails, callers still receive editable fallback groups.
 */

import { entities } from '@/api/entities';
import { extractPdfTextFromUrl } from '@/lib/extractPdfText';
import { createSignedFileUrl } from '@/api/storage';
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
    const quotePdfUrl = await createSignedFileUrl(hydratedRequest.quote_pdf_url);
    const quotePdfText = await extractPdfTextFromUrl(quotePdfUrl);
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

function getSelectedLabourHours(request) {
  if (!request.labour_time_selection) return null;
  if (request.labour_time_selection === 'other') {
    return request.labour_time_custom_hours != null ? Number(request.labour_time_custom_hours) : null;
  }
  return Number(request.labour_time_selection);
}

function normaliseLabourLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[x×]\s*\d+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function labelsMatch(lineLabel, groupLabels) {
  const line = normaliseLabourLabel(lineLabel);
  if (!line) return false;

  return groupLabels.some(label => {
    const group = normaliseLabourLabel(label);
    return group && (line === group || line.includes(group) || group.includes(line));
  });
}

function groupTextMatchesPartType(partType, groupLabels) {
  const text = normaliseLabourLabel(groupLabels.join(' '));
  if (!partType || !text) return false;

  const groupAxle = /\b(front|fr)\b/.test(text)
    ? 'front'
    : /\b(rear|rr)\b/.test(text)
      ? 'rear'
      : null;
  const partAxle = partType.startsWith('front_')
    ? 'front'
    : partType.startsWith('rear_')
      ? 'rear'
      : null;
  if (groupAxle && partAxle && groupAxle !== partAxle) {
    return false;
  }

  switch (partType) {
    case 'air_filter':
      return /\b(air|element|refiner)\b/.test(text) ||
        (/\bfilter\b/.test(text) && !/\b(pollen|cabin|oil|fuel)\b/.test(text));
    case 'pollen_filter':
      return /\b(pollen|cabin|ac|a c)\b/.test(text);
    case 'battery':
      return /\bbattery\b/.test(text);
    case 'wiper_blades':
      return /\b(wiper|blade)\b/.test(text);
    case 'front_brake_pads':
    case 'rear_brake_pads':
      return /\bpad/.test(text);
    case 'front_brake_rotors':
    case 'rear_brake_rotors':
      return !/\bpad/.test(text) &&
        /\b(disc|rotor)\b/.test(text);
    case 'tyres':
      return /\b(tyre|tire)\b/.test(text);
    default:
      return false;
  }
}

function labourLineMatchesGroup(line, groupLabels) {
  return labelsMatch(line.part_label, groupLabels) ||
    groupTextMatchesPartType(line.part_type, groupLabels);
}

function getBrakeGroupInfo(group) {
  const text = normaliseLabourLabel([group.repair_name, ...(group.parts || [])].join(' '));
  const isPad = /\bpad/.test(text);
  const isRotor = !isPad && /\b(disc|rotor)\b/.test(text);
  if (!isPad && !isRotor) return null;

  let axle = null;
  if (/\b(front|fr)\b/.test(text)) axle = 'front';
  if (/\b(rear|rr)\b/.test(text)) axle = 'rear';

  return {
    type: isPad ? 'pad' : 'rotor',
    axle
  };
}

function getBrakeRepairName(axle) {
  if (axle === 'front') return 'Front Brake Pads and Rotors';
  if (axle === 'rear') return 'Rear Brake Pads and Rotors';
  return 'Brake Pads and Rotors';
}

function combineNumbers(values, combiner) {
  const numeric = values
    .filter(value => value != null)
    .map(value => Number(value))
    .filter(Number.isFinite);
  return numeric.length ? combiner(numeric) : null;
}

function mergeBrakeGroups(padEntry, rotorEntry) {
  const pad = padEntry.group;
  const rotor = rotorEntry.group;
  const axle = padEntry.brake.axle || rotorEntry.brake.axle;
  const priceValues = [pad.parts_cost_ex_gst, rotor.parts_cost_ex_gst];
  const prices = priceValues.map(value => Number(value));
  const allPricesKnown = priceValues.every(value => value != null) && prices.every(Number.isFinite);
  const estimatedLabour = combineNumbers(
    [pad.estimated_labour_hours, rotor.estimated_labour_hours],
    values => Math.max(...values)
  );
  const labourHours = combineNumbers(
    [pad.labour_hours, rotor.labour_hours],
    values => Math.max(...values)
  );

  return {
    ...pad,
    repair_name: getBrakeRepairName(axle),
    parts: [...(pad.parts || []), ...(rotor.parts || [])],
    parts_cost_ex_gst: allPricesKnown ? prices[0] + prices[1] : null,
    estimated_labour_hours: estimatedLabour,
    labour_hours: labourHours,
    labour_overridden: pad.labour_overridden || rotor.labour_overridden || false
  };
}

function findBrakePairIndex(entries, currentIndex, usedIndexes) {
  const current = entries[currentIndex];
  const wantedType = current.brake.type === 'pad' ? 'rotor' : 'pad';
  const candidates = entries.filter((entry, index) =>
    index !== currentIndex &&
    !usedIndexes.has(index) &&
    entry.brake?.type === wantedType
  );
  const sameAxle = candidates.filter(entry =>
    current.brake.axle && entry.brake.axle === current.brake.axle
  );

  if (sameAxle.length === 1) {
    return entries.indexOf(sameAxle[0]);
  }

  const unknownSafeCandidates = candidates.filter(entry =>
    !current.brake.axle || !entry.brake.axle
  );
  const unpairedRotors = entries.filter((entry, index) =>
    !usedIndexes.has(index) &&
    entry.brake?.type === 'rotor'
  );

  if (unknownSafeCandidates.length === 1 && unpairedRotors.length === 1) {
    return entries.indexOf(unknownSafeCandidates[0]);
  }

  return -1;
}

export function mergeRelatedRepairGroups(groups) {
  const entries = groups.map(group => ({
    group,
    brake: getBrakeGroupInfo(group)
  }));
  const usedIndexes = new Set();
  const mergedGroups = [];

  entries.forEach((entry, index) => {
    if (usedIndexes.has(index)) return;
    if (!entry.brake) {
      mergedGroups.push(entry.group);
      return;
    }

    const pairIndex = findBrakePairIndex(entries, index, usedIndexes);
    if (pairIndex === -1) {
      mergedGroups.push(entry.group);
      return;
    }

    const pair = entries[pairIndex];
    const padEntry = entry.brake.type === 'pad' ? entry : pair;
    const rotorEntry = entry.brake.type === 'rotor' ? entry : pair;

    usedIndexes.add(index);
    usedIndexes.add(pairIndex);
    mergedGroups.push(mergeBrakeGroups(padEntry, rotorEntry));
  });

  return mergedGroups;
}

function isCombinedBrakeGroup(group) {
  const text = normaliseLabourLabel([group.repair_name, ...(group.parts || [])].join(' '));
  return /\bpad/.test(text) && /\b(disc|rotor)\b/.test(text);
}

export function applyWorkshopControllerLabour(groups, request) {
  const labourLines = Array.isArray(request.labour_lines) ? request.labour_lines : [];
  const usedLineIndexes = new Set();
  let matchedLabourLines = 0;

  const groupsWithLabourLines = groups.map(group => {
    const groupLabels = [group.repair_name, ...(group.parts || [])];
    const matchingLineIndexes = labourLines.reduce((matches, line, index) => {
      const hours = Number(line.hours);
      if (!usedLineIndexes.has(index) &&
        Number.isFinite(hours) &&
        labourLineMatchesGroup(line, groupLabels)) {
        matches.push(index);
      }
      return matches;
    }, []);
    const lineIndexes = isCombinedBrakeGroup(group)
      ? matchingLineIndexes
      : matchingLineIndexes.slice(0, 1);

    if (!lineIndexes.length) return group;

    lineIndexes.forEach(index => usedLineIndexes.add(index));
    matchedLabourLines += lineIndexes.length;
    const labourHours = Math.max(...lineIndexes.map(index => Number(labourLines[index].hours)));
    return {
      ...group,
      labour_hours: labourHours,
      labour_overridden: true
    };
  });

  if (matchedLabourLines > 0 || groupsWithLabourLines.length !== 1) {
    return groupsWithLabourLines;
  }

  const selectedHours = getSelectedLabourHours(request);
  if (selectedHours == null || Number.isNaN(selectedHours)) {
    return groupsWithLabourLines;
  }

  return groupsWithLabourLines.map(group => ({
    ...group,
    labour_hours: selectedHours,
    labour_overridden: true
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
