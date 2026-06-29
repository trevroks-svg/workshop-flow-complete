import test from 'node:test';
import assert from 'node:assert/strict';
import analyseRepairs from './analyseRepairs.js';

function callRoute(body) {
  return new Promise(resolve => {
    const req = { body };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: this.statusCode, data });
      },
    };

    analyseRepairs(req, res);
  });
}

test('analyse-repairs returns high-confidence rules result before OpenAI fallback', async () => {
  const response = await callRoute({
    request: {
      quote_pdf_text: [
        'PARTS QUOTATION',
        'Description Part Number Qty Unit Price (ex GST) GST Total (inc GST)',
        'Air Filter AF-1087 1 $18.50 $1.85 $20.35',
        'Subtotal (ex GST): $18.50',
        'GST (10%): $1.85',
        'TOTAL (inc GST): $20.35',
      ].join(' '),
      parts: [{ part_type: 'air_filter', quantity: 1 }],
    },
    partsText: 'Air Filter',
  });

  assert.equal(response.status, 200);
  assert.equal(response.data.success, true);
  assert.equal(response.data.source, 'rules');
  assert.equal(response.data.result.line_items[0].line_total_inc_gst, 20.35);
  assert.equal(response.data.result.groups[0].parts_cost_ex_gst, 18.5);
});

test('analyse-repairs returns rules result for Tune parts quotation format', async () => {
  const response = await callRoute({
    request: {
      quote_pdf_text: [
        'PARTS QUOTATION',
        'Line Part Description Bin Ordered B/O Price Unit Ext Price',
        '1. MZ691099S BLADE,HYBRID REFILL,8.5x710MM NARVA 2 12.01 12.01 24.02',
        '2. 87139YZZ25 CABIN AIR FILTER R4B 1 78.88 78.88 78.88',
        'PARTS TOTAL $102.90',
        'GST $10.29',
        'TOTAL $113.19',
      ].join(' '),
      parts: [
        { part_type: 'wiper_blades', quantity: 2 },
        { part_type: 'pollen_filter', quantity: 1 },
      ],
    },
    partsText: 'Wiper Blades, Pollen Filter',
  });

  assert.equal(response.status, 200);
  assert.equal(response.data.success, true);
  assert.equal(response.data.source, 'rules');
  assert.equal(response.data.result.quote_total_inc_gst, 113.19);
  assert.equal(response.data.result.line_items.length, 2);
  assert.equal(response.data.result.line_items[0].part_number, 'MZ691099S');
  assert.equal(response.data.result.line_items[0].line_total_ex_gst, 24.02);
  assert.equal(response.data.result.groups[1].parts_cost_ex_gst, 78.88);
});
