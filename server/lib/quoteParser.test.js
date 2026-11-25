import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuoteText, parseNotePrices } from './quoteParser.js';

function quoteText({ description, partNumber, unitPriceExGst, gst, totalIncGst }) {
  return [
    'PARTS QUOTATION',
    'Supplier: Auto Parts Supply Co.',
    'Quote No: TEST-AUDIT-001',
    'Customer: Workshop Flow Test',
    'Description Part Number Qty Unit Price (ex GST) GST Total (inc GST)',
    `${description} ${partNumber} 1 $${unitPriceExGst.toFixed(2)} $${gst.toFixed(2)} $${totalIncGst.toFixed(2)}`,
    `Subtotal (ex GST): $${unitPriceExGst.toFixed(2)}`,
    `GST (10%): $${gst.toFixed(2)}`,
    `TOTAL (inc GST): $${totalIncGst.toFixed(2)}`,
  ].join(' ');
}

const simpleQuotes = [
  {
    name: 'Air Filter',
    description: 'Air Filter',
    partNumber: 'AF-1087',
    unitPriceExGst: 18.5,
    gst: 1.85,
    totalIncGst: 20.35,
  },
  {
    name: 'Pollen Filter',
    description: 'Pollen Filter',
    partNumber: 'PF-2044',
    unitPriceExGst: 27.25,
    gst: 2.73,
    totalIncGst: 29.98,
  },
  {
    name: 'Battery',
    description: 'Battery',
    partNumber: 'BAT-650CCA',
    unitPriceExGst: 165,
    gst: 16.5,
    totalIncGst: 181.5,
  },
  {
    name: 'Wiper Blades',
    description: 'Wiper Blades',
    partNumber: 'WB-22-18',
    unitPriceExGst: 42,
    gst: 4.2,
    totalIncGst: 46.2,
  },
];

for (const quote of simpleQuotes) {
  test(`rules parser extracts ${quote.name} quote`, () => {
    const parsed = parseQuoteText(quoteText(quote));

    assert.equal(parsed.success, true);
    assert.equal(parsed.result.pdf_was_readable, true);
    assert.equal(parsed.result.notes_used_for_pricing, false);
    assert.equal(parsed.result.quote_total_inc_gst, quote.totalIncGst);
    assert.equal(parsed.result.line_items.length, 1);
    assert.equal(parsed.result.groups.length, 1);

    const line = parsed.result.line_items[0];
    assert.equal(line.description, quote.description);
    assert.equal(line.part_number, quote.partNumber);
    assert.equal(line.quantity, 1);
    assert.equal(line.unit_price_ex_gst, quote.unitPriceExGst);
    assert.equal(line.gst, quote.gst);
    assert.equal(line.line_total_inc_gst, quote.totalIncGst);

    const group = parsed.result.groups[0];
    assert.equal(group.repair_name, quote.description);
    assert.equal(group.parts_cost_ex_gst, quote.unitPriceExGst);
  });
}

test('rules parser rejects rows that fail the GST maths check', () => {
  const parsed = parseQuoteText(quoteText({
    description: 'Air Filter',
    partNumber: 'AF-1087',
    unitPriceExGst: 18.5,
    gst: 1.85,
    totalIncGst: 99.99,
  }));

  assert.equal(parsed.success, false);
});

test('rules parser extracts standard Tune quote rows', () => {
  const parsed = parseQuoteText([
    'PARTS QUOTATION',
    'Line Part Description Bin Ordered B/O Price Unit Ext Price',
    '1. MZ691099S BLADE,HYBRID REFILL,8.5x710MM NARVA 2 12.01 12.01 24.02',
    '2. 87139YZZ25 CABIN AIR FILTER R4B 1 78.88 78.88 78.88',
    'PARTS TOTAL $102.90',
    'GST $10.29',
    'TOTAL $113.19',
  ].join(' '));

  assert.equal(parsed.success, true);
  assert.equal(parsed.result.pdf_was_readable, true);
  assert.equal(parsed.result.notes_used_for_pricing, false);
  assert.equal(parsed.result.parts_total_ex_gst, 102.90);
  assert.equal(parsed.result.gst, 10.29);
  assert.equal(parsed.result.quote_total_inc_gst, 113.19);
  assert.equal(parsed.result.line_items.length, 2);

  assert.deepEqual(parsed.result.line_items[0], {
    description: 'BLADE,HYBRID REFILL,8.5x710MM',
    part_number: 'MZ691099S',
    quantity: 2,
    unit_price_ex_gst: 12.01,
    gst: 2.4,
    line_total_ex_gst: 24.02,
    line_total_inc_gst: 26.42,
  });

  assert.deepEqual(parsed.result.line_items[1], {
    description: 'CABIN AIR FILTER',
    part_number: '87139YZZ25',
    quantity: 1,
    unit_price_ex_gst: 78.88,
    gst: 7.89,
    line_total_ex_gst: 78.88,
    line_total_inc_gst: 86.77,
  });

  assert.equal(parsed.result.groups[0].parts_cost_ex_gst, 24.02);
  assert.equal(parsed.result.groups[1].parts_cost_ex_gst, 78.88);
});

test('rules parser extracts Tune rows in pdfjs observed order', () => {
  const parsed = parseQuoteText([
    'PARTS QUOTATION CASH CUSTOMER - PARTS VICTOR HARBOR',
    'Order No. Description Line Sales Rep. Unit Part Bin B/O Dispatch To Invoice To Price Ext Price Ordered',
    '1. 12.01 2 24.02 NARVA BLADE,HYBRID REFILL,8.5x710MM MZ691099S 12.01',
    '2. 78.88 1 78.88 R4B CABIN AIR FILTER 87139YZZ25 78.88',
    'PARTS TOTAL $102.90 GST $10.29 TOTAL $113.19',
  ].join(' '));

  assert.equal(parsed.success, true);
  assert.equal(parsed.result.quote_total_inc_gst, 113.19);
  assert.equal(parsed.result.line_items.length, 2);
  assert.equal(parsed.result.line_items[0].description, 'BLADE,HYBRID REFILL,8.5x710MM');
  assert.equal(parsed.result.line_items[0].part_number, 'MZ691099S');
  assert.equal(parsed.result.line_items[0].quantity, 2);
  assert.equal(parsed.result.line_items[0].unit_price_ex_gst, 12.01);
  assert.equal(parsed.result.line_items[0].line_total_ex_gst, 24.02);
  assert.equal(parsed.result.line_items[1].description, 'CABIN AIR FILTER');
  assert.equal(parsed.result.line_items[1].part_number, '87139YZZ25');
  assert.equal(parsed.result.line_items[1].quantity, 1);
  assert.equal(parsed.result.line_items[1].unit_price_ex_gst, 78.88);
  assert.equal(parsed.result.line_items[1].line_total_ex_gst, 78.88);
});

test('table row starting with a tyre size keeps the full size in the description', () => {
  const parsed = parseQuoteText([
    'PARTS QUOTATION',
    'Description Part Number Qty Unit Price (ex GST) GST Total (inc GST)',
    '225/65R17 102H SC-MS 4341300 1 $180.91 $18.09 $199.00',
    'Subtotal (ex GST): $180.91',
    'GST (10%): $18.09',
    'TOTAL (inc GST): $199.00',
  ].join(' '));

  assert.equal(parsed.success, true);
  assert.equal(parsed.result.line_items[0].description, '225/65R17 102H SC-MS');
  assert.equal(parsed.result.line_items[0].part_number, '4341300');
  assert.equal(parsed.result.groups[0].repair_name, '225/65R17 102H SC-MS');
});

test('unlabelled dealer quote parses with the GST basis inferred from the GST line', () => {
  const parsed = parseQuoteText(
    'PARTS QUOTATION VICTOR HARBOR TOYOTA ' +
    'LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09 ' +
    'PARTS TOTAL $309.17 GST $30.92 TOTAL $340.09'
  );

  assert.equal(parsed.success, true);
  assert.equal(parsed.result.gst_basis, 'inferred');
  assert.equal(parsed.result.quote_total_inc_gst, 340.09);
  assert.equal(parsed.result.line_items[0].description, 'LN1MF TOYOTA BATTERY');
  assert.equal(parsed.result.line_items[0].unit_price_ex_gst, 309.17);
});

test('unlabelled quote whose rows do not reconcile with its totals fails cleanly', () => {
  const parsed = parseQuoteText(
    'PARTS QUOTATION VICTOR HARBOR TOYOTA ' +
    'LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09 ' +
    'PARTS TOTAL $999.99 GST $30.92 TOTAL $340.09'
  );

  assert.equal(parsed.success, false);
  assert.match(parsed.reason, /do not match quote totals/);
});

test('two-money rows parse with the GST basis determined from the maths', () => {
  const parsed = parseQuoteText(
    'PARTS QUOTATION VICTOR HARBOR TOYOTA ' +
    'LN1MF TOYOTA BATTERY 109700 1 $309.17 $340.09 ' +
    'PARTS TOTAL $309.17 GST $30.92 TOTAL $340.09'
  );

  assert.equal(parsed.success, true);
  assert.equal(parsed.result.gst_basis, 'inferred');
  assert.equal(parsed.result.quote_total_inc_gst, 340.09);
  assert.equal(parsed.result.line_items[0].unit_price_ex_gst, 309.17);
});

test('labelled table reports the GST basis as labelled', () => {
  const parsed = parseQuoteText(quoteText({
    description: 'Air Filter',
    partNumber: 'AF-1087',
    unitPriceExGst: 18.5,
    gst: 1.85,
    totalIncGst: 20.35,
  }));
  assert.equal(parsed.success, true);
  assert.equal(parsed.result.gst_basis, 'labelled');
});

test('parseNotePrices reads a per-unit price from the interpreter note', () => {
  const result = parseNotePrices('hifly HP801 $179 each+fit, 3 days', {
    parts: [{ part_type: 'tyres', quantity: 2 }],
  });

  assert.equal(result.gst_basis, 'unconfirmed');
  assert.equal(result.price_source, 'parts_note');
  assert.equal(result.line_items.length, 1);
  assert.equal(result.line_items[0].description, 'hifly HP801');
  assert.equal(result.line_items[0].quantity, 2);
  assert.equal(result.line_items[0].unit_price_ex_gst, 179);
  assert.equal(result.line_items[0].part_type, 'tyres');
  assert.equal(result.quote_total_inc_gst, 393.8);
});

test('parseNotePrices reads two options from one note', () => {
  const result = parseNotePrices(
    'KUMHO HP71 $359 EA + FIT 3 DAYS (SPECIAL UNTIL END OF NOV) / HIFLY HP801 $169 EA + FIT 3 DAYS',
    { parts: [{ part_type: 'tyres', quantity: 2 }] }
  );

  assert.equal(result.line_items.length, 2);
  assert.equal(result.line_items[0].description, 'KUMHO HP71');
  assert.equal(result.line_items[1].description, 'HIFLY HP801');
  assert.equal(result.quote_total_inc_gst, 1161.6);
});

test('parseNotePrices returns null when the note holds no price', () => {
  assert.equal(parseNotePrices('hifly HP801 in stock, 3 days', {
    parts: [{ part_type: 'tyres', quantity: 2 }],
  }), null);
  assert.equal(parseNotePrices('', { parts: [] }), null);
});
