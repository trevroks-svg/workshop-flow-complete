/**
 * Deterministic draft text builders for the agent loop.
 *
 * These mirror the fallback builders in the frontend
 * (SMSDraftGenerator.buildFallbackSms and
 * RecommendationTextGenerator.buildFallbackRecommendation) so a draft the
 * loop writes is identical to one an advisor would generate in the app.
 *
 * Rules carried over from the 24-25 Nov 2026 trial:
 * - Labour is charged INC GST; only parts get GST added (x1.1).
 * - Air/pollen filters carry $0.00 labour (Trevor, 25 Nov 2026).
 * - Invoice recommendation notes quote the fitted total only — never
 *   "plus fitting" and never a parts/labour split.
 * - Every draft is plain ASCII, no quotation marks (see smsText.js).
 * - Never invent a customer name or vehicle: when neither the request nor
 *   today's job schedule has them, the SMS opens with "Hi there," and the
 *   draft is flagged customer_unverified for Trevor to check.
 */

import { toPlainAscii } from './smsText.js';
import { resolveLabourRate } from './labourRate.js';
import { plainPartName, groupsHaveOptions } from './plainPartName.js';

export const GST_MULTIPLIER = 1.1;
export const SMS_REPLY_LINE = 'Please reply YES to approve or NO to decline. Fleurieu Motor Group Service 08 8552 1255';

// Price provenance for a note-priced draft lives only in the draft flags
// (priceSource 'parts_note', gstBasisUnconfirmed true) — never in the draft
// text itself, so an advisor copies a customer-ready draft with nothing to
// delete (Trevor, 25 Nov 2026).

const FILTER_REPAIR_PATTERN = /\b(air|pollen|cabin)\b.*\bfilter\b|\bfilter\b.*\b(air|pollen|cabin)\b/i;

/** True when a repair group is only air/pollen/cabin filters. */
export function isFilterOnlyGroup(group) {
  const text = [group?.repair_name, ...(group?.parts || [])].join(' ').toLowerCase();
  if (!text) return false;
  // A filter-only group mentions a filter and no other repair type.
  if (!/\bfilter\b/.test(text)) return false;
  if (/\b(tyre|tire|battery|brake|wiper|pad|rotor|disc)\b/.test(text)) return false;
  return FILTER_REPAIR_PATTERN.test(text);
}

/** True when every part on the request is an air or pollen filter. */
export function requestIsFiltersOnly(request) {
  const parts = Array.isArray(request?.parts) ? request.parts : [];
  if (!parts.length) return false;
  return parts.every(part => ['air_filter', 'pollen_filter'].includes(part.part_type));
}

/**
 * Labour hours from the quote PDF's labour line ("Labour 1 hr", "Labour:
 * 0.25 hrs"). Only used for a single-group quote, where the line is
 * unambiguous. The trial's quotes carried labour on the PDF; the rules
 * parser does not read it, so without this the loop would price every
 * group at the parser's 0.5h estimate.
 */
export function extractLabourHoursFromPdfText(pdfText) {
  if (!pdfText) return null;
  const matches = [...String(pdfText).matchAll(/labou?r\b[^0-9\n]{0,20}?(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\b/gi)];
  for (const match of matches) {
    const hours = Number(match[1]);
    if (Number.isFinite(hours) && hours >= 0.25 && hours <= 8) {
      return Math.round(hours * 4) / 4;
    }
  }
  return null;
}

/**
 * Labour hours for a group, applying the trial rules:
 * - Filters only: 0 hours (whole job is filters, or this group is).
 * - A single controller labour line on a single-group request wins.
 * - The quote PDF's labour line, for a single-group quote.
 * - Otherwise the analysis estimate (the rules parser estimates 0.5h).
 */
export function labourHoursForGroup(group, request, groups) {
  if (isFilterOnlyGroup(group) || requestIsFiltersOnly(request)) return 0;

  const labourLines = Array.isArray(request?.labour_lines) ? request.labour_lines : [];
  if (labourLines.length === 1 && (groups || []).length === 1) {
    const hours = Number(labourLines[0]?.hours);
    if (Number.isFinite(hours) && hours >= 0) return hours;
  }

  if ((groups || []).length === 1) {
    const pdfHours = extractLabourHoursFromPdfText(request?.quote_pdf_text);
    if (pdfHours != null) return pdfHours;
  }

  const estimated = Number(group?.labour_hours ?? group?.estimated_labour_hours);
  return Number.isFinite(estimated) && estimated >= 0 ? estimated : null;
}

/**
 * Priced line for one repair group. Returns null when the group cannot be
 * priced (no labour hours known, or no parts price and no quote total).
 * Mirrors getGroupPricing in SMSDraftGenerator.
 */
export function getGroupPricing(group, request, groups, labourRate) {
  const labourHours = labourHoursForGroup(group, request, groups);
  if (labourHours == null) return null;

  const rate = resolveLabourRate(labourRate, request?.labour_rate_ex_gst);
  const labourIncGst = labourHours * rate;

  if (group.parts_cost_ex_gst != null) {
    const partsIncGst = group.parts_cost_ex_gst * GST_MULTIPLIER;
    return {
      partsIncGst,
      labourIncGst,
      labourHours,
      totalIncGst: partsIncGst + labourIncGst,
      source: 'parts_ex_gst',
    };
  }

  // Single-group request with a quoted total on the record: parts are the
  // whole quoted total, labour is on top.
  const quoteTotal = Number(request?.quote_total);
  if (groups.length === 1 && Number.isFinite(quoteTotal) && quoteTotal > 0) {
    return {
      partsIncGst: quoteTotal,
      labourIncGst,
      labourHours,
      totalIncGst: quoteTotal + labourIncGst,
      source: 'quote_total',
    };
  }

  return null;
}

/** Groups with labour hours applied, ready for pricing. */
export function groupsWithLabour(groups, request) {
  return (groups || []).map(group => ({
    ...group,
    labour_hours: labourHoursForGroup(group, request, groups),
  }));
}

/**
 * SMS draft for a sent_to_advisor upsell. Same shape as the app's fallback
 * SMS: greeting, one line per repair with its fitted price, a TOTAL line,
 * and the YES/NO reply line. Plain ASCII, no quotation marks.
 */
export function buildSmsDraft({ customerName, vehicle, groups, request, labourRate }) {
  const pricedGroups = groupsWithLabour(groups, request);
  const custName = String(customerName || '').trim();
  const vehicleText = String(vehicle || '').trim();
  const greeting = custName ? `Hi ${custName},` : 'Hi there,';
  const vehicleMention = vehicleText ? `for your ${vehicleText}` : '';

  const lines = pricedGroups.map(group => {
    const pricing = getGroupPricing(group, request, pricedGroups, labourRate);
    const name = plainPartName(group.repair_name, group.part_type);
    if (!pricing) return `${name}: price TBC`;
    return `${name}: $${pricing.totalIncGst.toFixed(2)} inc GST`;
  });

  const groupPrices = pricedGroups.map(group =>
    getGroupPricing(group, request, pricedGroups, labourRate)
  );
  const allPricesKnown = groupPrices.length > 0 && groupPrices.every(Boolean);
  // Two or more options are alternatives, never a single purchase: the
  // total lists each option's fitted total ("$884.80 inc GST or $466.80
  // inc GST (choose one option)") and never sums them (break B1).
  let totalLine = 'Total: price TBC';
  if (allPricesKnown) {
    const totals = groupPrices.map(pricing => pricing.totalIncGst);
    if (groupsHaveOptions(pricedGroups)) {
      const formatted = totals.map(total => `$${total.toFixed(2)} inc GST`);
      const last = formatted.pop();
      totalLine = formatted.length
        ? `Total: ${formatted.join(', ')} or ${last} (choose one option)`
        : `Total: ${last} (choose one option)`;
    } else {
      totalLine = `Total: $${totals.reduce((sum, total) => sum + total, 0).toFixed(2)} inc GST`;
    }
  }

  const body = [
    `${greeting}${vehicleMention ? ` ${vehicleMention}` : ''}`,
    'We recommend the following work:',
    ...lines,
    totalLine,
    SMS_REPLY_LINE,
  ];
  return toPlainAscii(body.join('\n'));
}

/**
 * Invoice recommendation note for an advisor_action_required tile. Quotes
 * the fitted total only — never "plus fitting", never a parts/labour split.
 * Same shape as the app's fallback recommendation text.
 */
export function buildRecommendationText({ groups, request, labourRate }) {
  const pricedGroups = groupsWithLabour(groups, request);
  const lines = pricedGroups.map(group => {
    const pricing = getGroupPricing(group, request, pricedGroups, labourRate);
    const name = plainPartName(group.repair_name, group.part_type);
    if (pricing) {
      return `Recommend ${name}: $${pricing.totalIncGst.toFixed(2)} inc GST (fitted).`;
    }
    const partsIncGst = group.parts_cost_ex_gst != null
      ? group.parts_cost_ex_gst * GST_MULTIPLIER
      : null;
    if (partsIncGst != null) {
      return `Recommend ${name}: Parts $${partsIncGst.toFixed(2)} inc GST, labour TBC.`;
    }
    return `Recommend ${name}: Parts price TBC.`;
  });
  return lines.join('\n');
}
