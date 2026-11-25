import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPdfMatchesJob } from './pdfJobMatch.js';

const AIR_FILTER_PDF = [
  'PARTS QUOTATION',
  'Description Part Number Qty Unit Price (ex GST) GST Total (inc GST)',
  'Air Filter AF-1087 1 $18.50 $1.85 $20.35',
  'TOTAL (inc GST): $20.35',
].join(' ');

test('pdf check flags a battery quote attached to a tyres job', () => {
  const result = checkPdfMatchesJob(
    { job_card_number: 'J03073149', parts: [{ part_type: 'tyres', quantity: 1 }] },
    [
      'PARTS QUOTATION',
      'Description Part Number Qty Unit Price (ex GST) GST Total (inc GST)',
      'Battery BT-123 1 $200.00 $20.00 $220.00',
      'TOTAL (inc GST): $220.00',
    ].join(' '),
    [{ description: 'Battery', part_number: 'BT-123', quantity: 1, unit_price_ex_gst: 200, line_total_inc_gst: 220 }]
  );

  assert.equal(result.status, 'mismatch');
  assert.match(result.reason, /do not mention any of the requested parts/);
});

test('pdf check flags a quote showing a different job card number', () => {
  const result = checkPdfMatchesJob(
    { job_card_number: 'J03073149', parts: [{ part_type: 'air_filter', quantity: 1 }] },
    `PARTS QUOTATION Job Card: J03079999 ${AIR_FILTER_PDF}`,
    [{ description: 'Air Filter', part_number: 'AF-1087', quantity: 1, unit_price_ex_gst: 18.5, line_total_inc_gst: 20.35 }]
  );

  assert.equal(result.status, 'mismatch');
  assert.match(result.reason, /J03079999/);
  assert.match(result.reason, /J03073149/);
});

test('pdf check matches a quote showing the same job card number', () => {
  const result = checkPdfMatchesJob(
    { job_card_number: 'J03073149', parts: [{ part_type: 'air_filter', quantity: 1 }] },
    `PARTS QUOTATION Job Card: J03073149 ${AIR_FILTER_PDF}`,
    [{ description: 'Air Filter', part_number: 'AF-1087', quantity: 1, unit_price_ex_gst: 18.5, line_total_inc_gst: 20.35 }]
  );

  assert.equal(result.status, 'match');
});

test('pdf check is unverified when the PDF has no job card or part detail', () => {
  const result = checkPdfMatchesJob(
    { job_card_number: 'J03073149', parts: [{ part_type: 'air_filter', quantity: 1 }] },
    'Some quote text with no identifying detail.',
    []
  );

  assert.equal(result.status, 'unverified');
});

test('pdf check matches on vehicle when no job card is in the PDF', () => {
  const result = checkPdfMatchesJob(
    { job_card_number: 'J03073149', vehicle_type: '2021 Toyota Hilux', parts: [{ part_type: 'air_filter', quantity: 1 }] },
    'PARTS QUOTATION for 2021 Toyota Hilux. Air Filter AF-1087 1 $18.50 $1.85 $20.35',
    [{ description: 'Air Filter', part_number: 'AF-1087', quantity: 1, unit_price_ex_gst: 18.5, line_total_inc_gst: 20.35 }]
  );

  assert.equal(result.status, 'match');
});

test('pdf check matches a tyre-size line on a tyres job', () => {
  const result = checkPdfMatchesJob(
    { job_card_number: 'J03073174', parts: [{ part_type: 'tyres', quantity: 1 }] },
    'PARTS QUOTATION 225/65R17 102H SC-MS',
    [{ description: '225/65R17 102H SC-MS', part_number: '4341300', quantity: 1, unit_price_ex_gst: 180.91, line_total_inc_gst: 199 }]
  );

  assert.notEqual(result.status, 'mismatch');
});

test('pdf check matches an air-filter part-code line on an air-filter job', () => {
  const result = checkPdfMatchesJob(
    { job_card_number: 'J03073211', parts: [{ part_type: 'air_filter', quantity: 1 }] },
    'PARTS QUOTATION ELEMENT SUB-ASSY',
    [{ description: 'ELEMENT SUB-ASSY', part_number: '1780151020', quantity: 1, unit_price_ex_gst: 74.02, line_total_inc_gst: 81.42 }]
  );

  assert.notEqual(result.status, 'mismatch');
});

test('pdf check matches when the part word sits in the part-number slot (Tune layout)', () => {
  const result = checkPdfMatchesJob(
    { job_card_number: 'J03073243', parts: [{ part_type: 'battery', quantity: 1 }] },
    'PARTS QUOTATION LN1MF TOYOTA',
    [{ description: 'LN1MF TOYOTA', part_number: 'BATTERY', quantity: 1, unit_price_ex_gst: 309.17, line_total_inc_gst: 340.09 }]
  );

  assert.notEqual(result.status, 'mismatch');
});

test('pdf check still mismatches a battery quote on a tyres job', () => {
  const result = checkPdfMatchesJob(
    { job_card_number: 'J03073174', parts: [{ part_type: 'tyres', quantity: 1 }] },
    'PARTS QUOTATION LN1MF TOYOTA BATTERY',
    [{ description: 'LN1MF TOYOTA BATTERY', part_number: '109700', quantity: 1, unit_price_ex_gst: 309.17, line_total_inc_gst: 340.09 }]
  );

  assert.equal(result.status, 'mismatch');
});
