// Plain-language part classification, shared with the draft builders so a
// quote line, a note price and a draft all name the same part the same way.
import { classifyPart, TYRE_SIZE_RE } from './plainPartName.js';

const HIGH_CONFIDENCE = 0.85;
const MONEY_TOLERANCE = 0.03;

function toNumber(value) {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normaliseText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractTableBody(text) {
  const headerMatch = text.match(/Description\s+Part\s+Number\s+Qty\s+Unit\s+Price\s+\(ex\s+GST\)\s+GST\s+Total\s+\(inc\s+GST\)/i);
  const start = headerMatch ? headerMatch.index + headerMatch[0].length : 0;
  const afterHeader = text.slice(start).trim();
  const footerMatch = afterHeader.match(/\s+(Subtotal\s+\(ex\s+GST\)|GST\s+\(\d+%?\)|TOTAL\s+\(inc\s+GST\))/i);
  return footerMatch ? afterHeader.slice(0, footerMatch.index).trim() : afterHeader;
}

function extractQuoteTotal(text) {
  const matches = [...text.matchAll(/TOTAL\s+\(inc\s+GST\)\s*:?\s*\$?([\d,]+\.\d{2})/gi)];
  if (!matches.length) return null;
  return toNumber(matches[matches.length - 1][1]);
}

function extractTuneTotals(text) {
  const partsTotalMatch = text.match(/PARTS\s+TOTAL\s+\$?([\d,]+\.\d{2})/i);
  const gstMatch = text.match(/\bGST\s+\$?([\d,]+\.\d{2})/i);
  const totalMatches = [...text.matchAll(/\bTOTAL\s+\$?([\d,]+\.\d{2})/gi)];

  return {
    parts_total_ex_gst: toNumber(partsTotalMatch?.[1]),
    gst: toNumber(gstMatch?.[1]),
    quote_total_inc_gst: toNumber(totalMatches.at(-1)?.[1]),
  };
}

// A quote table row: description, part number, quantity, unit price,
// GST amount, line total. The description may start with a tyre size
// (225/65R17 102H SC-MS) - the description pattern must allow that leading
// size, otherwise the 225/65 prefix is dropped and the line is left as
// "R17 102H SC-MS" (break B4) and no longer reads as a tyre at all (B0).
function tableRowPattern() {
  return /((?:\d{2,3}\/\d{2}\s*R\d{2}\s+)?[A-Za-z0-9][A-Za-z0-9 /&().,+-]*?)\s+([A-Z0-9][A-Z0-9-]{2,})\s+(\d+(?:\.\d+)?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})/g;
}

function parseTableRows(body) {
  const rows = [];
  for (const match of body.matchAll(tableRowPattern())) {
    const quantity = toNumber(match[3]);
    const unitPriceExGst = toNumber(match[4]);
    const gst = toNumber(match[5]);
    const lineTotalIncGst = toNumber(match[6]);
    const expectedTotal = roundCurrency((unitPriceExGst || 0) * (quantity || 0) + (gst || 0));
    const mathsValid = Math.abs(expectedTotal - lineTotalIncGst) <= MONEY_TOLERANCE;

    rows.push({
      description: match[1].trim(),
      part_number: match[2].trim(),
      quantity,
      unit_price_ex_gst: unitPriceExGst,
      gst,
      line_total_inc_gst: lineTotalIncGst,
      mathsValid,
    });
  }
  return rows;
}

// A two-money row: description, part number, quantity, unit price, line
// total - no separate GST column. The GST basis is determined from the
// maths: total == unit x qty x 1.1 means the unit price is ex GST, total ==
// unit x qty means it is inc GST. Anything else is not a valid row.
function parseTwoMoneyRows(body) {
  const rowPattern = /((?:\d{2,3}\/\d{2}\s*R\d{2}\s+)?[A-Za-z0-9][A-Za-z0-9 /&().,+-]*?)\s+([A-Z0-9][A-Z0-9-]{2,})\s+(\d+(?:\.\d+)?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})/g;
  const rows = [];
  for (const match of body.matchAll(rowPattern)) {
    const quantity = toNumber(match[3]);
    const unitPrice = toNumber(match[4]);
    const lineTotal = toNumber(match[5]);
    const exTotal = roundCurrency((unitPrice || 0) * (quantity || 0) * 1.1);
    const incTotal = roundCurrency((unitPrice || 0) * (quantity || 0));
    let unitPriceExGst = null;
    let gst = null;
    let mathsValid = false;
    if (Math.abs(exTotal - lineTotal) <= MONEY_TOLERANCE) {
      unitPriceExGst = unitPrice;
      gst = roundCurrency(lineTotal - (unitPrice || 0) * (quantity || 0));
      mathsValid = true;
    } else if (Math.abs(incTotal - lineTotal) <= MONEY_TOLERANCE) {
      const exLineTotal = roundCurrency(lineTotal / 1.1);
      unitPriceExGst = roundCurrency(exLineTotal / (quantity || 1));
      gst = roundCurrency(lineTotal - exLineTotal);
      mathsValid = true;
    }
    rows.push({
      description: match[1].trim(),
      part_number: match[2].trim(),
      quantity,
      unit_price_ex_gst: unitPriceExGst,
      gst,
      line_total_inc_gst: lineTotal,
      mathsValid,
    });
  }
  return rows;
}

function parseLineItems(text) {
  const body = extractTableBody(text);
  return parseTableRows(body);
}

function getTuneRows(text) {
  const rows = [];
  const rowPattern = /(?:^|\s)(\d+)\.\s+(.+?)(?=\s+\d+\.\s+|\s+PARTS\s+TOTAL\b|$)/gi;

  for (const match of text.matchAll(rowPattern)) {
    rows.push(match[2].trim());
  }

  return rows;
}

function parseTuneStandardRow(row) {
  const match = row.match(/^([A-Z0-9][A-Z0-9-]{2,})\s+(.+?)\s+([A-Z0-9][A-Z0-9-]{1,})\s+(\d+(?:\.\d+)?)\s+(?:\d+(?:\.\d+)?\s+)?\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})$/i);
  if (!match) return null;

  const quantity = toNumber(match[4]);
  const unitPriceExGst = toNumber(match[5]);
  const lineTotalExGst = toNumber(match[7]);
  const expectedTotal = roundCurrency((unitPriceExGst || 0) * (quantity || 0));

  return {
    description: match[2].trim(),
    part_number: match[1].trim(),
    quantity,
    unit_price_ex_gst: unitPriceExGst,
    gst: lineTotalExGst == null ? null : roundCurrency(lineTotalExGst * 0.1),
    line_total_ex_gst: lineTotalExGst,
    line_total_inc_gst: lineTotalExGst == null ? null : roundCurrency(lineTotalExGst * 1.1),
    mathsValid: Math.abs(expectedTotal - lineTotalExGst) <= MONEY_TOLERANCE,
  };
}

function parseTuneExtractedRow(row) {
  const match = row.match(/^\$?([\d,]+\.\d{2})\s+(\d+(?:\.\d+)?)\s+\$?([\d,]+\.\d{2})\s+([A-Z0-9][A-Z0-9-]{1,})\s+(.+?)\s+([A-Z0-9][A-Z0-9-]{2,})\s+\$?([\d,]+\.\d{2})$/i);
  if (!match) return null;

  const leadingUnitPrice = toNumber(match[1]);
  const quantity = toNumber(match[2]);
  const lineTotalExGst = toNumber(match[3]);
  const trailingUnitPrice = toNumber(match[7]);
  const unitPriceExGst = trailingUnitPrice ?? leadingUnitPrice;
  const expectedTotal = roundCurrency((unitPriceExGst || 0) * (quantity || 0));

  return {
    description: match[5].trim(),
    part_number: match[6].trim(),
    quantity,
    unit_price_ex_gst: unitPriceExGst,
    gst: lineTotalExGst == null ? null : roundCurrency(lineTotalExGst * 0.1),
    line_total_ex_gst: lineTotalExGst,
    line_total_inc_gst: lineTotalExGst == null ? null : roundCurrency(lineTotalExGst * 1.1),
    mathsValid: Math.abs(expectedTotal - lineTotalExGst) <= MONEY_TOLERANCE,
  };
}

function parseTuneLineItems(text) {
  return getTuneRows(text)
    .map(row => parseTuneStandardRow(row) || parseTuneExtractedRow(row))
    .filter(Boolean);
}

function buildGroups(lineItems) {
  return lineItems.map(item => ({
    repair_name: item.description,
    parts: [`${item.description} ${item.part_number} x${item.quantity}`],
    parts_cost_ex_gst: roundCurrency(item.unit_price_ex_gst * item.quantity),
    estimated_labour_hours: 0.5,
  }));
}

function buildTuneResult(text) {
  const lineItems = parseTuneLineItems(text);
  const validLineItems = lineItems.filter(item =>
    item.description &&
    item.part_number &&
    item.quantity > 0 &&
    item.unit_price_ex_gst > 0 &&
    item.line_total_ex_gst > 0 &&
    item.mathsValid
  );

  if (!validLineItems.length || validLineItems.length !== lineItems.length) {
    return null;
  }

  const totals = extractTuneTotals(text);
  const lineExGstSum = roundCurrency(validLineItems.reduce((sum, item) => sum + item.line_total_ex_gst, 0));
  const expectedGst = roundCurrency(lineExGstSum * 0.1);
  const expectedTotal = roundCurrency(lineExGstSum + expectedGst);
  const partsTotalMatches = totals.parts_total_ex_gst == null || Math.abs(lineExGstSum - totals.parts_total_ex_gst) <= MONEY_TOLERANCE;
  const gstMatches = totals.gst == null || Math.abs(expectedGst - totals.gst) <= MONEY_TOLERANCE;
  const quoteTotalMatches = totals.quote_total_inc_gst == null || Math.abs(expectedTotal - totals.quote_total_inc_gst) <= MONEY_TOLERANCE;

  if (!partsTotalMatches || !gstMatches || !quoteTotalMatches) {
    return {
      success: false,
      confidence: 0.6,
      reason: 'Tune quote line totals do not match quote totals',
      line_items: validLineItems,
      ...totals,
    };
  }

  const parsedLineItems = validLineItems.map(({ mathsValid, ...item }) => item);
  const confidence = totals.quote_total_inc_gst == null ? 0.9 : 0.97;

  return {
    success: confidence >= HIGH_CONFIDENCE,
    confidence,
    result: {
      pdf_was_readable: true,
      notes_used_for_pricing: false,
      quote_total_inc_gst: totals.quote_total_inc_gst ?? expectedTotal,
      parts_total_ex_gst: totals.parts_total_ex_gst ?? lineExGstSum,
      gst: totals.gst ?? expectedGst,
      line_items: parsedLineItems,
      groups: buildGroups(parsedLineItems),
    },
  };
}

export function parseQuoteText(quotePdfText) {
  const text = normaliseText(quotePdfText);
  if (!text) {
    return {
      success: false,
      confidence: 0,
      reason: 'No quote text supplied',
    };
  }

  const tuneResult = buildTuneResult(text);
  if (tuneResult?.success) {
    return {
      ...tuneResult,
      result: { ...tuneResult.result, gst_basis: 'inferred' },
    };
  }

  const hasTableHeader = /Description\s+Part\s+Number\s+Qty\s+Unit\s+Price\s+\(ex\s+GST\)\s+GST\s+Total\s+\(inc\s+GST\)/i.test(text);
  const rawLineItems = parseLineItems(text);
  const validLineItems = rawLineItems.filter(item =>
    item.description &&
    item.part_number &&
    item.quantity > 0 &&
    item.unit_price_ex_gst > 0 &&
    item.gst > 0 &&
    item.line_total_inc_gst > 0 &&
    item.mathsValid
  );

  if (hasTableHeader && validLineItems.length && validLineItems.length === rawLineItems.length) {
    const quoteTotalIncGst = extractQuoteTotal(text);
    const lineTotalSum = roundCurrency(validLineItems.reduce((sum, item) => sum + item.line_total_inc_gst, 0));
    const quoteTotalMatches = quoteTotalIncGst == null || Math.abs(lineTotalSum - quoteTotalIncGst) <= MONEY_TOLERANCE;

    if (!quoteTotalMatches) {
      return {
        success: false,
        confidence: 0.6,
        reason: 'Line totals do not match quote total',
        line_items: validLineItems,
        quote_total_inc_gst: quoteTotalIncGst,
      };
    }

    const lineItems = validLineItems.map(({ mathsValid, ...item }) => item);
    const confidence = quoteTotalIncGst == null ? 0.9 : 0.97;

    return {
      success: confidence >= HIGH_CONFIDENCE,
      confidence,
      result: {
        pdf_was_readable: true,
        notes_used_for_pricing: false,
        gst_basis: 'labelled',
        quote_total_inc_gst: quoteTotalIncGst ?? lineTotalSum,
        line_items: lineItems,
        groups: buildGroups(lineItems),
      },
    };
  }

  // Unlabelled dealer quotes (break B2): no "(ex GST)" header and no Tune
  // layout, but complete table rows are present - e.g. the Toyota battery
  // quote "LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09" with a
  // "PARTS TOTAL ... GST ... TOTAL" block. Infer the GST basis from the
  // GST column / totals line instead of failing outright.
  const genericResult = buildGenericResult(text);
  if (genericResult) return genericResult;

  if (tuneResult) return tuneResult;

  return {
    success: false,
    confidence: 0.35,
    reason: 'No complete high-confidence quote table rows found',
    line_items: rawLineItems,
  };
}

// Parse an unlabelled dealer quote: complete table rows with no GST labels.
// Returns a parseQuoteText-style result, or null when no usable rows exist.
function buildGenericResult(text) {
  // Strip the totals block so its figures are not mistaken for quote rows.
  const totalsCut = text.search(/PARTS\s+TOTAL/i);
  const withoutTotals = totalsCut >= 0 ? text.slice(0, totalsCut) : text;
  // Strip a "PARTS QUOTATION <dealer name>" header line - otherwise the
  // dealer name is absorbed into the first row's description.
  const body = withoutTotals.replace(/^.*?PARTS QUOTATION\s+(?:[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+)?/i, '');

  const validRows = (rows) => rows.filter(item =>
    item.description &&
    item.part_number &&
    item.quantity > 0 &&
    item.unit_price_ex_gst > 0 &&
    item.gst >= 0 &&
    item.line_total_inc_gst > 0 &&
    item.mathsValid
  );

  let rawRows = parseTableRows(body);
  let rows = validRows(rawRows);
  if (!rows.length || rows.length !== rawRows.length) {
    // No complete three-money rows - try two-money rows (unit + line total).
    rawRows = parseTwoMoneyRows(body);
    rows = validRows(rawRows);
  }
  if (!rows.length || rows.length !== rawRows.length) return null;

  const totals = extractTuneTotals(text);
  if (totals.parts_total_ex_gst != null && totals.gst != null && totals.quote_total_inc_gst != null) {
    const exSum = roundCurrency(rows.reduce((sum, item) => sum + item.unit_price_ex_gst * item.quantity, 0));
    const gstSum = roundCurrency(rows.reduce((sum, item) => sum + item.gst, 0));
    const totalSum = roundCurrency(rows.reduce((sum, item) => sum + item.line_total_inc_gst, 0));
    if (
      Math.abs(exSum - totals.parts_total_ex_gst) > MONEY_TOLERANCE ||
      Math.abs(gstSum - totals.gst) > MONEY_TOLERANCE ||
      Math.abs(totalSum - totals.quote_total_inc_gst) > MONEY_TOLERANCE
    ) {
      return {
        success: false,
        confidence: 0.6,
        reason: 'Unlabelled quote line totals do not match quote totals',
        line_items: rows,
      };
    }
  }

  const lineItems = rows.map(({ mathsValid, ...item }) => item);
  const lineTotalSum = roundCurrency(lineItems.reduce((sum, item) => sum + item.line_total_inc_gst, 0));
  const confidence = totals.quote_total_inc_gst == null ? 0.9 : 0.97;

  return {
    success: confidence >= HIGH_CONFIDENCE,
    confidence,
    result: {
      pdf_was_readable: true,
      notes_used_for_pricing: false,
      gst_basis: 'inferred',
      quote_total_inc_gst: totals.quote_total_inc_gst ?? lineTotalSum,
      line_items: lineItems,
      groups: buildGroups(lineItems),
    },
  };
}

// Which request part a note price belongs to, for its quantity and type.
// A note item matches a part by family (e.g. "air filter $74 each" matches
// the air_filter part); when the job has a single part, every note price
// belongs to it. Returns { quantity, part_type } - part_type null when the
// item cannot be tied to a specific part.
function noteItemPart(request, itemDescription) {
  const parts = request?.parts || [];
  if (!parts.length) return { quantity: 1, part_type: null };
  const itemFamily = classifyPart(itemDescription).family;
  const byFamily = parts.filter((p) => p.part_type === itemFamily);
  if (byFamily.length === 1) {
    return { quantity: Number(byFamily[0].quantity) || 1, part_type: byFamily[0].part_type };
  }
  if (parts.length === 1) {
    return { quantity: Number(parts[0].quantity) || 1, part_type: parts[0].part_type };
  }
  return { quantity: 1, part_type: null };
}

// Prices that only live in the parts interpreter's note (break B3), e.g.
// "hifly HP801 $179 each+fit, 3 days" on a job whose PDF is blank.
// A note price is a per-unit price; the note never states the GST basis,
// so the result is flagged gst_basis 'unconfirmed' and the draft must say
// the price came from the note. Returns null when the note holds no prices.
export function parseNotePrices(notes, request) {
  // Parenthetical asides carry no price ("(SPECIAL UNTIL END OF NOV)") -
  // drop them so they cannot be absorbed into an item description.
  const text = normaliseText(notes).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const matches = [];
  const seen = new Set();
  // The item description is a short product name - it must not span the "/"
  // that separates two options, so "/" and parentheses stay out of it.
  // It may still start with a tyre size ("225/65R17 tyre $199 each").
  const itemPattern = /((?:\d{2,3}\/\d{2}\s*R\d{2}\s+)?[A-Za-z][A-Za-z0-9 .,&-]*?)\s+\$?([\d,]+(?:\.\d{2})?)\s*(?:each|ea|per)\b/gi;
  // Per-unit prices first ("$179 each", "$359 EA"). Note prices are often
  // whole dollars with no cents, so the decimal part is optional.
  for (const match of text.matchAll(itemPattern)) {
    const description = match[1].trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    const key = `${description.toLowerCase()}|${match[2]}`;
    if (description && !seen.has(key)) {
      seen.add(key);
      matches.push({ description, price: toNumber(match[2]) });
    }
  }
  // Bare prices only when no per-unit prices were found ("$179 + FIT").
  if (!matches.length) {
    for (const match of text.matchAll(/((?:\d{2,3}\/\d{2}\s*R\d{2}\s+)?[A-Za-z][A-Za-z0-9 .,&-]*?)\s+\$?([\d,]+(?:\.\d{2})?)(?=\s*(?:\+|,|\/|$))/gi)) {
      const description = match[1].trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
      const key = `${description.toLowerCase()}|${match[2]}`;
      if (description && !seen.has(key)) {
        seen.add(key);
        matches.push({ description, price: toNumber(match[2]) });
      }
    }
  }
  if (!matches.length) return null;

  const lineItems = matches
    .map(({ description, price }) => {
      if (!price || price <= 0) return null;
      const { quantity, part_type } = noteItemPart(request, description);
      const lineTotalIncGst = roundCurrency(price * quantity * 1.1);
      return {
        description,
        part_number: null,
        quantity,
        unit_price_ex_gst: price,
        gst: roundCurrency(price * quantity * 0.1),
        line_total_inc_gst: lineTotalIncGst,
        mathsValid: true,
        part_type,
        source: 'parts_note',
      };
    })
    .filter(Boolean);
  if (!lineItems.length) return null;

  const groups = buildGroups(lineItems);
  for (const group of groups) {
    const item = lineItems.find((i) => i.description === group.repair_name);
    if (item?.part_type) group.part_type = item.part_type;
  }

  return {
    line_items: lineItems.map(({ mathsValid, ...item }) => item),
    groups,
    quote_total_inc_gst: roundCurrency(lineItems.reduce((sum, item) => sum + item.line_total_inc_gst, 0)),
    gst_basis: 'unconfirmed',
    price_source: 'parts_note',
  };
}

export const QUOTE_PARSER_HIGH_CONFIDENCE = HIGH_CONFIDENCE;
