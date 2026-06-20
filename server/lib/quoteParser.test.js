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
