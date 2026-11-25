// Probe: which realistic quote-text shapes does the rules parser accept?
// Run: node server/workflow-tests/probe-parser.mjs
import { parseQuoteText } from '../lib/quoteParser.js';

const table = (rows, subEx, gst, total) => [
  'PARTS QUOTATION',
  'Description Part Number Qty Unit Price (ex GST) GST Total (inc GST)',
  ...rows,
  `Subtotal (ex GST): $${subEx.toFixed(2)}`,
  `GST (10%): $${gst.toFixed(2)}`,
  `TOTAL (inc GST): $${total.toFixed(2)}`,
].join(' ');

const cases = {
  'R4 two-option tyres (table)': table([
    'KUMHO HP71 TYRE KUMHO-HP71 2 $359.00 $71.80 $789.80',
    'HIFLY HP801 TYRE HIFLY-HP801 2 $169.00 $33.80 $371.80',
  ], 1056.00, 105.60, 1161.60),
  'R7 no-label Toyota style': [
    'PARTS QUOTATION VICTOR HARBOR TOYOTA',
    'LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09',
    'PARTS TOTAL $309.17 GST $30.92 TOTAL $340.09',
  ].join(' '),
  'R8 Tune-numbered no-label': [
    'PARTS QUOTATION',
    '1. 109700 LN1MF TOYOTA BATTERY 1 $309.17 $30.92 $340.09',
    'PARTS TOTAL $309.17 GST $30.92 TOTAL $340.09',
  ].join(' '),
  'R8b Tune-extracted shape': [
    'PARTS QUOTATION',
    '1. $309.17 1 $309.17 109700 LN1MF TOYOTA BATTERY $309.17',
    'PARTS TOTAL $309.17 GST $30.92 TOTAL $340.09',
  ].join(' '),
  'R12 wipers Tune standard': [
    'PARTS QUOTATION',
    '1. MZ691099S BLADE,HYBRID REFILL,8.5x710MM NARVA 2 12.01 12.01 24.02',
    'PARTS TOTAL $24.02 GST $2.40 TOTAL $26.42',
  ].join(' '),
  'R1 Parker single tyre (table)': table([
    '225/65R17 102H SC-MS 4341300 1 $180.91 $18.09 $199.00',
  ], 180.91, 18.09, 199.00),
};

for (const [name, text] of Object.entries(cases)) {
  const r = parseQuoteText(text);
  console.log(`--- ${name}`);
  console.log('  success:', r.success, '| confidence:', r.confidence, '| reason:', r.reason || '-');
  if (r.success) {
    console.log('  groups:', JSON.stringify(r.result.groups));
    console.log('  quote_total_inc_gst:', r.result.quote_total_inc_gst);
  } else if (r.line_items) {
    console.log('  line_items:', JSON.stringify(r.line_items));
  }
}

const tuneBattery = [
  'PARTS QUOTATION',
  '1. 109700 LN1MF TOYOTA BATTERY TOYOTA 1 $309.17 $30.92 $340.09',
  'PARTS TOTAL $309.17 GST $30.92 TOTAL $340.09',
].join(' ');
const r = parseQuoteText(tuneBattery);
console.log('--- R8 revised Tune-standard battery');
console.log('  success:', r.success, '| confidence:', r.confidence, '| reason:', r.reason || '-');
if (r.success) console.log('  groups:', JSON.stringify(r.result.groups), '| total:', r.result.quote_total_inc_gst);
