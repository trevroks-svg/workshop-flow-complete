import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSmsDraft,
  buildRecommendationText,
  getGroupPricing,
  labourHoursForGroup,
  extractLabourHoursFromPdfText,
} from './draftText.js';
import { isPlainAscii } from './smsText.js';

const LABOUR_RATE = 190;

// Trial case, 25 Nov 2026 (J03073211, Deere Landcruiser): air filter
// $74.02 + cabin filter $80.85 ex GST, filters carry $0 labour.
const DEERE_REQUEST = {
  job_card_number: 'J03073211',
  parts: [{ part_type: 'air_filter', quantity: 1 }, { part_type: 'pollen_filter', quantity: 1 }],
  quote_pdf_text: 'Labour 0.25 hr $47.50 inc GST',
};
const DEERE_GROUPS = [
  { repair_name: 'ELEMENT SUB-ASSY', parts: ['ELEMENT SUB-ASSY 1780151020 x1'], parts_cost_ex_gst: 74.02, estimated_labour_hours: 0.5 },
  { repair_name: 'CABIN FILTER', parts: ['CABIN FILTER 87139YZZ25 x1'], parts_cost_ex_gst: 80.85, estimated_labour_hours: 0.5 },
];

// Trial case, 24 Nov 2026 (J03073174, Parker RAV4): one tyre quoted at
// $180.91 ex GST, treads LF 5 / RF 2 / LR 2 / RR 1mm — set of four.
const PARKER_REQUEST = {
  job_card_number: 'J03073174',
  parts: [{ part_type: 'tyres', quantity: 1 }],
  tyre_tread_depths: { lh_front: 5, rh_front: 2, lh_rear: 2, rh_rear: 1 },
  labour_lines: [{ part_type: 'tyres', hours: 1 }],
};
const PARKER_GROUPS = [
  {
    repair_name: 'Tyre 225/65R17 102H',
    parts: ['Tyre 225/65R17 102H TYR-22565 x1'],
    parts_cost_ex_gst: 723.64, // already repriced to a set of four
    estimated_labour_hours: 0.5,
    tyre_set_of_four: true,
    tyre_rule_applied: true,
  },
];

test('filters-only job carries $0 labour (trial rule)', () => {
  assert.equal(labourHoursForGroup(DEERE_GROUPS[0], DEERE_REQUEST, DEERE_GROUPS), 0);
  assert.equal(labourHoursForGroup(DEERE_GROUPS[1], DEERE_REQUEST, DEERE_GROUPS), 0);
});

test('SMS draft for the Deere filters job totals $170.36 inc GST', () => {
  const draft = buildSmsDraft({
    customerName: 'Mr Deere',
    vehicle: 'Landcruiser',
    groups: DEERE_GROUPS,
    request: DEERE_REQUEST,
    labourRate: LABOUR_RATE,
  });
  assert.match(draft, /Hi Mr Deere, for your Landcruiser/);
  assert.match(draft, /Total: \$170\.36 inc GST/);
  assert.match(draft, /Please reply YES to approve or NO to decline/);
  assert.equal(isPlainAscii(draft), true);
  assert.equal(draft.startsWith('"'), false);
});

test('Parker tyres job prices as a set of four at $986.00 inc GST', () => {
  const pricing = getGroupPricing(PARKER_GROUPS[0], PARKER_REQUEST, PARKER_GROUPS, LABOUR_RATE);
  assert.equal(pricing.totalIncGst.toFixed(2), '986.00');
  assert.equal(pricing.labourHours, 1);

  const draft = buildSmsDraft({
    customerName: 'Jo Parker',
    vehicle: 'RAV4 Hybrid',
    groups: PARKER_GROUPS,
    request: PARKER_REQUEST,
    labourRate: LABOUR_RATE,
  });
  assert.match(draft, /Total: \$986\.00 inc GST/);
});

test('labour hours come from the PDF labour line for a single-group quote', () => {
  assert.equal(extractLabourHoursFromPdfText('Labour 1 hr $189.99 inc GST'), 1);
  assert.equal(extractLabourHoursFromPdfText('Labour: 0.25 hrs'), 0.25);
  assert.equal(extractLabourHoursFromPdfText('Labour 1.5 hours'), 1.5);
  assert.equal(extractLabourHoursFromPdfText('TOTAL LABOUR $189.99'), null);
  assert.equal(extractLabourHoursFromPdfText(''), null);

  const request = { quote_pdf_text: 'Some quote text. Labour 1 hr $189.99 inc GST.' };
  const group = { repair_name: 'Tyres', parts: ['Tyres'], parts_cost_ex_gst: 100, estimated_labour_hours: 0.5 };
  assert.equal(labourHoursForGroup(group, request, [group]), 1);
});

test('recommendation note quotes the fitted total only', () => {
  const text = buildRecommendationText({
    groups: DEERE_GROUPS,
    request: DEERE_REQUEST,
    labourRate: LABOUR_RATE,
  });
  assert.match(text, /Recommend Air filter: \$81\.42 inc GST \(fitted\)\./);
  assert.match(text, /Recommend Cabin filter: \$88\.94 inc GST \(fitted\)\./);
  assert.doesNotMatch(text, /plus fitting/i);
  assert.doesNotMatch(text, /Labour:/);
  assert.equal(isPlainAscii(text), true);
});

test('SMS draft without a customer name opens with "Hi there," and is flagged by the caller', () => {
  const draft = buildSmsDraft({
    customerName: '',
    vehicle: '',
    groups: DEERE_GROUPS,
    request: DEERE_REQUEST,
    labourRate: LABOUR_RATE,
  });
  assert.match(draft, /^Hi there,/);
  assert.match(draft, /Total: \$170\.36 inc GST/);
});

test('unpriced groups draft as price TBC, never an invented price', () => {
  const groups = [{ repair_name: 'Battery', parts: ['Battery'], parts_cost_ex_gst: null, estimated_labour_hours: 0.5 }];
  const draft = buildSmsDraft({
    customerName: 'Test',
    vehicle: 'Hilux',
    groups,
    request: {},
    labourRate: LABOUR_RATE,
  });
  assert.match(draft, /Battery: price TBC/);
  assert.match(draft, /Total: price TBC/);
});

test('two-option SMS lists both fitted totals and never sums them', () => {
  const draft = buildSmsDraft({
    customerName: 'Ms Neale',
    vehicle: 'Tucson',
    groups: [
      { repair_name: 'KUMHO HP71 TYRE', parts: ['KUMHO HP71 TYRE x2'], parts_cost_ex_gst: 718, estimated_labour_hours: 0.5 },
      { repair_name: 'HIFLY HP801 TYRE', parts: ['HIFLY HP801 TYRE x2'], parts_cost_ex_gst: 338, estimated_labour_hours: 0.5 },
    ],
    request: { parts: [{ part_type: 'tyres', quantity: 2 }], labour_lines: [{ hours: 0.5 }] },
    labourRate: LABOUR_RATE,
  });

  assert.match(draft, /Kumho HP71 tyre: \$884\.80 inc GST/);
  assert.match(draft, /Hifly HP801 tyre: \$466\.80 inc GST/);
  assert.match(draft, /Total: \$884\.80 inc GST or \$466\.80 inc GST \(choose one option\)/);
  assert.doesNotMatch(draft, /1351\.60/);
  assert.equal(isPlainAscii(draft), true);
});

test('note-priced SMS keeps price provenance out of the draft text', () => {
  const draft = buildSmsDraft({
    customerName: 'Ms Neale',
    vehicle: 'Tucson',
    groups: [
      { repair_name: 'hifly HP801', parts: ['hifly HP801 null x2'], parts_cost_ex_gst: 358, estimated_labour_hours: 0.5, part_type: 'tyres' },
    ],
    request: { parts: [{ part_type: 'tyres', quantity: 2 }], labour_lines: [{ hours: 0.5 }] },
    labourRate: LABOUR_RATE,
  });

  assert.match(draft, /Hifly HP801 tyre: \$488\.80 inc GST/);
  assert.doesNotMatch(draft, /Advisor note/);
  assert.equal(isPlainAscii(draft), true);
});

test('SMS draft uses plain part names, never part-code jargon', () => {
  const draft = buildSmsDraft({
    customerName: 'Mr Parker',
    vehicle: 'RAV4 Hybrid GX',
    groups: PARKER_GROUPS,
    request: PARKER_REQUEST,
    labourRate: LABOUR_RATE,
  });

  assert.match(draft, /Tyre 225\/65R17: \$986\.00 inc GST/);
  assert.match(draft, /Total: \$986\.00 inc GST/);
  assert.doesNotMatch(draft, /TYR-22565/);
  assert.equal(isPlainAscii(draft), true);
  assert.doesNotMatch(draft, /"/);
});
