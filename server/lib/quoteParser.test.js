import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuoteText } from './quoteParser.js';

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

test('rules parser extracts a Tune Battery row followed by Rego/VIN metadata', () => {
  const parsed = parseQuoteText([
    'PARTS QUOTATION CASH CUSTOMER - PARTS VICTOR HARBOR',
    'Order No. Description Line Sales Rep. Unit Part Bin B/O Dispatch To Invoice To Price Ext Price Ordered',
    '3. 309.17 1 309.17 FRONT LN1MF TOYOTA BATTERY 109700 309.17',
    'Rego/VIN:',
    'PARTS TOTAL $309.17',
    'GST $30.92',
    'TOTAL $340.09',
  ].join(' '));

  assert.equal(parsed.success, true);
  assert.equal(parsed.result.parts_total_ex_gst, 309.17);
  assert.equal(parsed.result.quote_total_inc_gst, 340.09);
  assert.deepEqual(parsed.result.line_items[0], {
    description: 'TOYOTA BATTERY',
    part_number: '109700',
    quantity: 1,
    unit_price_ex_gst: 309.17,
    gst: 30.92,
    line_total_ex_gst: 309.17,
    line_total_inc_gst: 340.09,
  });
  assert.equal(parsed.result.groups[0].parts_cost_ex_gst, 309.17);
});

test('rules parser still rejects unrecognised trailing Tune row content', () => {
  const parsed = parseQuoteText([
    'PARTS QUOTATION CASH CUSTOMER - PARTS VICTOR HARBOR',
    '3. 309.17 1 309.17 FRONT LN1MF TOYOTA BATTERY 109700 309.17',
    'Unrecognised trailing content',
    'PARTS TOTAL $309.17 GST $30.92 TOTAL $340.09',
  ].join(' '));

  assert.equal(parsed.success, false);
});
