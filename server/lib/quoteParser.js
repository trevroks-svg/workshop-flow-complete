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

function parseLineItems(text) {
  const body = extractTableBody(text);
  const rowPattern = /([A-Za-z][A-Za-z0-9 /&().,+-]*?)\s+([A-Z0-9][A-Z0-9-]{2,})\s+(\d+(?:\.\d+)?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})/g;
  const rows = [];

  for (const match of body.matchAll(rowPattern)) {
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

  const extractedDescription = match[5].trim();
  const description = extractedDescription.replace(/^[A-Z]*\d[A-Z0-9-]*\s+(?=[A-Z][A-Z0-9 ,&().,+/-]*$)/i, '');

  return {
    description,
    part_number: match[6].trim(),
    quantity,
    unit_price_ex_gst: unitPriceExGst,
    gst: lineTotalExGst == null ? null : roundCurrency(lineTotalExGst * 0.1),
    line_total_ex_gst: lineTotalExGst,
    line_total_inc_gst: lineTotalExGst == null ? null : roundCurrency(lineTotalExGst * 1.1),
    mathsValid: Math.abs(expectedTotal - lineTotalExGst) <= MONEY_TOLERANCE,
  };
}

function stripTuneRowFooterMetadata(row) {
  return row.replace(/\s+(?:Rego\/VIN|Registration\/VIN|Rego|VIN)\s*:\s*.*$/i, '').trim();
}

function parseTuneLineItems(text) {
  return getTuneRows(text)
    .map(row => stripTuneRowFooterMetadata(row))
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
    return tuneResult;
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

  if (!hasTableHeader || !validLineItems.length || validLineItems.length !== rawLineItems.length) {
    if (tuneResult) return tuneResult;

    return {
      success: false,
      confidence: 0.35,
      reason: 'No complete high-confidence quote table rows found',
      line_items: rawLineItems,
    };
  }

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
      quote_total_inc_gst: quoteTotalIncGst ?? lineTotalSum,
      line_items: lineItems,
      groups: buildGroups(lineItems),
    },
  };
}

export const QUOTE_PARSER_HIGH_CONFIDENCE = HIGH_CONFIDENCE;
