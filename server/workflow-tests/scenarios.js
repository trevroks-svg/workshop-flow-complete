// Workflow test scenarios — modelled on the real 24–25 Nov 2026 Base44 trial
// jobs (Parker tyres, Sickadick/Davis batteries, Deere filters, Neale two-option
// tyres, Dixon tyres, Waite side skirt, Brunt wipers, Harford spare tyre).
// All customer names are synthetic ("Test ...") — no real customer data.
// Quote texts use the two formats the rules parser supports (labelled table,
// Tune numbered rows) plus the unlabelled dealer layout from the trial.

// --- quote text builders ---------------------------------------------------
function money(n) {
  return `$${n.toFixed(2)}`;
}

// Labelled table format (the parser's primary format).
export function tableQuote(rows, subEx, gst, total) {
  return [
    'PARTS QUOTATION',
    'Description Part Number Qty Unit Price (ex GST) GST Total (inc GST)',
    ...rows,
    `Subtotal (ex GST): ${money(subEx)}`,
    `GST (10%): ${money(gst)}`,
    `TOTAL (inc GST): ${money(total)}`,
  ].join(' ');
}

export const NOW = '2026-11-25T00:00:00.000Z'; // Wed 25 Nov 2026, 10:30 ACDT
export const LATE_NOW = '2026-11-25T08:00:00.000Z'; // 18:30 ACDT — outside workshop hours
export const STALE_UPDATED_AT = '2026-11-22T00:00:00.000Z'; // 3 days before NOW

function scheduleRow(jobCard, owner, model, rego, mobile) {
  return { jobCard, owner, modelDescription: model, rego, mobile, inDate: '25/11/26' };
}

// --- scenarios -------------------------------------------------------------
export const SCENARIOS = [
  {
    id: 'R1', name: 'Tyres set-of-four (Parker trial job)',
    schedule: scheduleRow('J03074001', 'Test Parker', 'RAV4 Hybrid GX', 'DC89DC', '0447000001'),
    request: {
      job_card_number: 'J03074001', vehicle_type: 'RAV4 Hybrid GX', rego: 'DC89DC',
      parts: [{ part_type: 'tyres', type: 'tyres', tyre_size: '225/65R17', description: '225/65R17 102H SC-MS' }],
      tyre_tread_depths: { lh_front: 5, rh_front: 2, lh_rear: 2, rh_rear: 1 },
    },
    pdfText: tableQuote(['225/65R17 102H SC-MS 4341300 1 $180.91 $18.09 $199.00'], 180.91, 18.09, 199.00),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 1 }], decision: 'immediate' },
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: 986.00,
      greeting: 'Hi Test Parker, for your RAV4 Hybrid GX',
      contains: ['986.00', 'Tyre 225/65R17'],
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: true },
      note: 'Fixed (B0/B4): the size-only tyre line is recognised as tyres and the full size is kept in the draft. The $986 set-of-four total is the trial figure.',
    },
    postLoop: 'advisor_mark_sent_then_customer_approve',
  },
  {
    id: 'R2', name: 'Battery (Sickadick trial job)',
    schedule: scheduleRow('J03074002', 'Test Sickadick', 'C-HR Hybrid Koba', 'S573CUK', '0447000002'),
    request: {
      job_card_number: 'J03074002', vehicle_type: 'C-HR Hybrid Koba', rego: 'S573CUK',
      parts: [{ part_type: 'battery', type: 'battery', description: 'LN1MF Toyota Battery' }],
    },
    pdfText: tableQuote(['LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09'], 309.17, 30.92, 340.09),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.25 }], decision: 'immediate' },
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: 387.59,
      greeting: 'Hi Test Sickadick, for your C-HR Hybrid Koba',
      contains: ['387.59', 'Toyota battery'],
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: false },
    },
    postLoop: 'advisor_mark_sent',
  },
  {
    id: 'R3', name: 'Air + pollen filters (Deere trial job)',
    schedule: scheduleRow('J03074003', 'Test Deere', 'Landcruiser Wagon GXL', 'S971CGH', '0447000003'),
    request: {
      job_card_number: 'J03074003', vehicle_type: 'Landcruiser Wagon GXL', rego: 'S971CGH',
      parts: [
        { part_type: 'air_filter', type: 'air_filter', description: 'Air Filter' },
        { part_type: 'pollen_filter', type: 'pollen_filter', description: 'Cabin Filter' },
      ],
    },
    pdfText: tableQuote([
      'ELEMENT SUB-ASSY 1780151020 1 $74.02 $7.40 $81.42',
      'CABIN FILTER 87139YZZ25 1 $80.85 $8.09 $88.94',
    ], 154.87, 15.49, 170.36),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.25 }], decision: 'immediate' },
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: 170.36,
      greeting: 'Hi Test Deere, for your Landcruiser Wagon GXL',
      contains: ['170.36', 'Cabin filter', 'Air filter'],
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: false },
    },
    postLoop: 'advisor_mark_sent',
  },
  {
    id: 'R4', name: 'Two-option tyre quote (Neale trial job, table format)',
    schedule: scheduleRow('J03074004', 'Test Neale', 'Tucson N Line', 'XD314B', '0447000004'),
    request: {
      job_card_number: 'J03074004', vehicle_type: 'Tucson N Line', rego: 'XD314B',
      parts: [{ part_type: 'tyres', type: 'tyres', tyre_size: '235/55R19', description: '235/55R19 tyres' }],
      tyre_tread_depths: { lh_front: 2.8, rh_front: 3.5, lh_rear: 5.9, rh_rear: 6.1 },
    },
    pdfText: tableQuote([
      'KUMHO HP71 TYRE KUMHO-HP71 2 $359.00 $71.80 $789.80',
      'HIFLY HP801 TYRE HIFLY-HP801 2 $169.00 $33.80 $371.80',
    ], 1056.00, 105.60, 1161.60),
    eta: '3_days',
    controller: { labourLines: [{ hours: 1 }], decision: 'immediate' },
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: null,
      greeting: 'Hi Test Neale, for your Tucson N Line',
      contains: ['Kumho HP71 tyre', 'Hifly HP801 tyre', '884.80', '466.80', 'Total: $884.80 inc GST or $466.80 inc GST (choose one option)'],
      notContains: ['1351.60'],
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: false },
      note: 'Fixed (B1): both options are listed with their own fitted totals and the Total line gives them as alternatives — no summed $1,351.60. The summary total is null because there is no single total.',
    },
    postLoop: null,
  },
  {
    id: 'R5', name: 'Two-option tyres priced only in the interpreter note (Neale, blank PDF)',
    schedule: scheduleRow('J03074005', 'Test Neale', 'Tucson N Line', 'XD314B', '0447000005'),
    request: {
      job_card_number: 'J03074005', vehicle_type: 'Tucson N Line', rego: 'XD314B',
      parts: [{ part_type: 'tyres', type: 'tyres', tyre_size: '235/55R19', description: '235/55R19 tyres', quantity: 2 }],
      tyre_tread_depths: { lh_front: 2.8, rh_front: 3.5, lh_rear: 5.9, rh_rear: 6.1 },
      parts_interpreter_notes: 'hifly HP801 $179 each+fit, 3 days',
    },
    pdfText: 'PARTS QUOTATION TOTAL $0.00',
    eta: '3_days',
    controller: { labourLines: [{ hours: 0.5 }], decision: 'immediate' },
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: 488.80,
      greeting: 'Hi Test Neale, for your Tucson N Line',
      contains: ['488.80', 'Hifly HP801 tyre', 'price from parts interpreter note'],
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: false, priceSource: 'parts_note', gstBasisUnconfirmed: true },
      note: 'Fixed (B3): the Neale trial case — blank PDF, price only in the note. The loop drafts from the note (2 x $179 + 0.5h labour = $488.80) and the draft says the price came from the note with the GST basis unconfirmed.',
    },
    postLoop: 'advisor_mark_sent',
  },
  {
    id: 'R6', name: 'Mismatched PDF — battery quote on a tyres job',
    schedule: scheduleRow('J03074006', 'Test Flouch', 'Triton GSR', 'XE071Z', '0447000006'),
    request: {
      job_card_number: 'J03074006', vehicle_type: 'Triton GSR', rego: 'XE071Z',
      parts: [{ part_type: 'tyres', type: 'tyres', tyre_size: '265/60R18', description: '265/60R18 tyres' }],
      tyre_tread_depths: { lh_front: 1.5, rh_front: 1.5, lh_rear: 0.5, rh_rear: 0.3 },
    },
    pdfText: tableQuote(['LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09'], 309.17, 30.92, 340.09),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 1 }], decision: 'immediate' },
    expect: {
      action: 'needs_attention', draftType: null,
      reasonMatch: /does not match|mismatch/i,
      note: 'The battery PDF must be rejected, not priced — the trial caught exactly this (battery PDF on job J03073149).',
    },
    postLoop: null,
  },
  {
    id: 'R7', name: 'Unlabelled dealer quote — no ex/inc GST labels, no table header (Toyota battery)',
    schedule: scheduleRow('J03074007', 'Test Davis', 'RAV4 Hybrid GX', 'S003DEG', '0447000007'),
    request: {
      job_card_number: 'J03074007', vehicle_type: 'RAV4 Hybrid GX', rego: 'S003DEG',
      parts: [{ part_type: 'battery', type: 'battery', description: 'LN1MF Toyota Battery' }],
    },
    pdfText: [
      'PARTS QUOTATION VICTOR HARBOR TOYOTA',
      'LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09',
      'PARTS TOTAL $309.17 GST $30.92 TOTAL $340.09',
    ].join(' '),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.25 }], decision: 'immediate' },
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: 387.59,
      greeting: 'Hi Test Davis, for your RAV4 Hybrid GX',
      contains: ['387.59', 'Toyota battery'],
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: false, gstBasis: 'inferred' },
      note: 'Fixed (B2): the plain dealer layout parses — the GST basis is inferred from the GST line and recorded as gstBasis inferred.',
    },
    postLoop: 'advisor_mark_sent',
  },
  {
    id: 'R8', name: 'Tune-format battery quote (numbered rows, standard layout)',
    schedule: scheduleRow('J03074008', 'Test Tune', 'Corolla Hatch', 'S111TUN', '0447000008'),
    request: {
      job_card_number: 'J03074008', vehicle_type: 'Corolla Hatch', rego: 'S111TUN',
      parts: [{ part_type: 'battery', type: 'battery', description: 'LN1MF Toyota Battery' }],
    },
    pdfText: [
      'PARTS QUOTATION',
      '1. 109700 LN1MF TOYOTA BATTERY TOYOTA 1 309.17 309.17 309.17',
      'PARTS TOTAL $309.17 GST $30.92 TOTAL $340.09',
    ].join(' '),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.25 }], decision: 'immediate' },
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: 387.59,
      greeting: 'Hi Test Tune, for your Corolla Hatch',
      contains: ['387.59'],
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: false },
      note: 'The matcher now also checks part numbers, so a Tune row with "BATTERY" in the part-number slot still matches the battery job (B0 fix).',
    },
    postLoop: 'advisor_mark_sent',
  },
  {
    id: 'R9', name: 'Job with no schedule row — draft must flag incomplete, never guess',
    schedule: null, // deliberately absent from the CSV
    request: {
      job_card_number: 'J03074009', vehicle_type: 'Camry Altise', rego: 'S999NSR',
      parts: [{ part_type: 'battery', type: 'battery', description: 'LN1MF Toyota Battery' }],
    },
    pdfText: tableQuote(['LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09'], 309.17, 30.92, 340.09),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.25 }], decision: 'immediate' },
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: 387.59,
      greeting: 'Hi there,',
      contains: ['387.59', 'Toyota battery'],
      flags: { scheduleMatched: false, customerUnverified: true, tyreRuleApplied: false },
      note: 'Draft is still produced but flagged customer_unverified — the advisor must check the name/vehicle before sending.',
    },
    postLoop: null,
  },
  {
    id: 'R10', name: 'Recommendation tile — invoice note only, NEVER an SMS (Dixon tyres)',
    schedule: scheduleRow('J03074010', 'Test Dixon', 'Outlander Aspire', 'S111CTL', '0447000010'),
    request: {
      job_card_number: 'J03074010', vehicle_type: 'Outlander Aspire', rego: 'S111CTL',
      parts: [{ part_type: 'tyres', type: 'tyres', tyre_size: '235/55R19', description: '235/55R19 tyres' }],
      tyre_tread_depths: null, // trial had no tread depths recorded for this job
    },
    pdfText: tableQuote(['HIFLY HP801 TYRE HIFLY-HP801 2 $179.00 $35.80 $393.80'], 358.00, 35.80, 393.80),
    eta: '3_days',
    controller: { labourLines: [{ hours: 1 }], decision: 'recommendation' },
    expect: {
      action: 'drafted', draftType: 'recommendation', quoteTotal: 583.80,
      contains: ['Recommend Hifly HP801 tyre: $583.80 inc GST (fitted).'],
      notContains: ['Hi ', 'reply YES'],
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: false },
      note: 'Trial total was $583.79 (old $189.99 labour line); the fixed $190 rate makes it $583.80 — the fix working as intended.',
    },
    postLoop: 'advisor_add_recommendation',
  },
  {
    id: 'R11', name: 'Blank / stale PDF (TOTAL $0.00)',
    schedule: scheduleRow('J03074011', 'Test Blank', 'Yaris Cross', 'S222BLK', '0447000011'),
    request: {
      job_card_number: 'J03074011', vehicle_type: 'Yaris Cross', rego: 'S222BLK',
      parts: [{ part_type: 'battery', type: 'battery', description: 'LN1MF Toyota Battery' }],
    },
    pdfText: 'PARTS QUOTATION TOTAL $0.00',
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.25 }], decision: 'immediate' },
    expect: {
      action: 'needs_attention', draftType: null,
      reasonMatch: /no complete|no quote|blank|parse/i,
    },
    postLoop: null,
  },
  {
    id: 'R12', name: 'Wiper blades, Tune format (Brunt trial job)',
    schedule: scheduleRow('J03074012', 'Test Brunt', 'Hiace Van', 'S515DCK', '0447000012'),
    request: {
      job_card_number: 'J03074012', vehicle_type: 'Hiace Van', rego: 'S515DCK',
      parts: [{ part_type: 'wipers', type: 'wipers', description: 'Wiper blades' }],
    },
    pdfText: [
      'PARTS QUOTATION',
      '1. MZ691099S BLADE,HYBRID REFILL,8.5x710MM NARVA 2 12.01 12.01 24.02',
      'PARTS TOTAL $24.02 GST $2.40 TOTAL $26.42',
    ].join(' '),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.2 }], decision: 'immediate' },
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: 64.42,
      greeting: 'Hi Test Brunt, for your Hiace Van',
      contains: ['64.42', 'Wiper blades'],
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: false },
    },
    postLoop: 'advisor_mark_sent',
  },
  {
    id: 'R13', name: 'Spare tyre — road treads fine, no set-of-four (Harford trial job)',
    schedule: scheduleRow('J03074013', 'Test Harford', 'Prado GXL', 'S660CVC', '0447000013'),
    request: {
      job_card_number: 'J03074013', vehicle_type: 'Prado GXL', rego: 'S660CVC',
      parts: [{ part_type: 'tyres', type: 'tyres', tyre_size: '265/65R17', description: '265/65R17 Hifly tyre' }],
      tyre_tread_depths: { lh_front: 3, rh_front: 4, lh_rear: 4, rh_rear: 6 },
    },
    pdfText: tableQuote(['265/65R17 HIFLY TYRE HIFLY-265 1 $163.64 $16.36 $180.00'], 163.64, 16.36, 180.00),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.25 }], decision: 'immediate' },
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: 227.50,
      greeting: 'Hi Test Harford, for your Prado GXL',
      contains: ['227.50', 'Hifly tyre 265/65R17'],
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: false },
      note: 'Single tyre only — the set-of-four rule must NOT fire when road treads are above 2mm.',
    },
    postLoop: null,
  },
  {
    id: 'R14', name: 'Dedup — same request, loop run twice (no duplicate draft)',
    schedule: scheduleRow('J03074014', 'Test Dedup', 'Camry Altise', 'S333DDP', '0447000014'),
    request: {
      job_card_number: 'J03074014', vehicle_type: 'Camry Altise', rego: 'S333DDP',
      parts: [{ part_type: 'battery', type: 'battery', description: 'LN1MF Toyota Battery' }],
    },
    pdfText: tableQuote(['LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09'], 309.17, 30.92, 340.09),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.25 }], decision: 'immediate' },
    runLoopTwice: true,
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: 387.59,
      secondRun: { processed: 0, skipped: 1, skipReason: 'already_drafted' },
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: false },
    },
    postLoop: null,
  },
  {
    id: 'R15', name: 'Outside workshop hours (18:30 ACDT) — loop must not run',
    now: LATE_NOW,
    schedule: scheduleRow('J03074015', 'Test Late', 'Corolla Cross', 'S444LTE', '0447000015'),
    request: {
      job_card_number: 'J03074015', vehicle_type: 'Corolla Cross', rego: 'S444LTE',
      parts: [{ part_type: 'battery', type: 'battery', description: 'LN1MF Toyota Battery' }],
    },
    pdfText: tableQuote(['LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09'], 309.17, 30.92, 340.09),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.25 }], decision: 'immediate' },
    expect: {
      loopRan: false, reason: 'outside_workshop_hours', action: null, draftType: null,
    },
    postLoop: null,
  },
  {
    id: 'R16', name: 'Stale request (updated 3 days ago) — loop must skip it',
    schedule: scheduleRow('J03074016', 'Test Stale', 'Hilux SR5', 'S555STL', '0447000016'),
    request: {
      job_card_number: 'J03074016', vehicle_type: 'Hilux SR5', rego: 'S555STL',
      parts: [{ part_type: 'battery', type: 'battery', description: 'LN1MF Toyota Battery' }],
    },
    pdfText: tableQuote(['LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09'], 309.17, 30.92, 340.09),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.25 }], decision: 'immediate' },
    updatedAtOverride: STALE_UPDATED_AT,
    expect: {
      action: 'skipped', skipReason: 'stale', draftType: null,
    },
    postLoop: null,
  },
  {
    id: 'R17', name: 'Draft already exists (advisor drafted in the app) — loop must not overwrite',
    schedule: scheduleRow('J03074017', 'Test Exists', 'Kluger GXL', 'S666EXT', '0447000017'),
    request: {
      job_card_number: 'J03074017', vehicle_type: 'Kluger GXL', rego: 'S666EXT',
      parts: [{ part_type: 'battery', type: 'battery', description: 'LN1MF Toyota Battery' }],
      advisor_sms_draft: 'Hi Test Exists, for your Kluger GXL\nWe recommend the following work:\nLN1MF TOYOTA BATTERY: $387.59 inc GST\nTotal: $387.59 inc GST\nPlease reply YES to approve or NO to decline. Fleurieu Motor Group Service 08 8552 1255',
    },
    pdfText: tableQuote(['LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09'], 309.17, 30.92, 340.09),
    eta: 'in_stock',
    controller: { labourLines: [{ hours: 0.25 }], decision: 'immediate' },
    expect: {
      action: 'skipped', skipReason: 'draft_already_exists', draftType: null,
      note: 'The pre-existing advisor draft must be left untouched.',
    },
    postLoop: null,
  },
  {
    id: 'R18', name: 'Two-option tyres priced only in the interpreter note (Neale, real note)',
    schedule: scheduleRow('J03074018', 'Test Neale', 'Tucson N Line', 'XD314B', '0447000018'),
    request: {
      job_card_number: 'J03074018', vehicle_type: 'Tucson N Line', rego: 'XD314B',
      parts: [{ part_type: 'tyres', type: 'tyres', tyre_size: '235/55R19', description: '235/55R19 tyres', quantity: 2 }],
      tyre_tread_depths: { lh_front: 2.8, rh_front: 3.5, lh_rear: 5.9, rh_rear: 6.1 },
      parts_interpreter_notes: 'KUMHO HP71 $359 EA + FIT 3 DAYS (SPECIAL UNTIL END OF NOV) / HIFLY HP801 $169 EA + FIT 3 DAYS',
    },
    pdfText: 'PARTS QUOTATION TOTAL $0.00',
    eta: '3_days',
    controller: { labourLines: [{ hours: 0.5 }], decision: 'immediate' },
    expect: {
      action: 'drafted', draftType: 'sms', quoteTotal: null,
      greeting: 'Hi Test Neale, for your Tucson N Line',
      contains: ['Kumho HP71 tyre', 'Hifly HP801 tyre', '884.80', '466.80', 'Total: $884.80 inc GST or $466.80 inc GST (choose one option)', 'price from parts interpreter note'],
      notContains: ['1351.60'],
      flags: { scheduleMatched: true, customerUnverified: false, tyreRuleApplied: false, priceSource: 'parts_note', gstBasisUnconfirmed: true },
      note: 'B1 + B3 together: the real Neale note holds two per-unit prices and the PDF is blank. Both options draft with their own fitted totals, no summed total, and the draft says the prices came from the note.',
    },
    postLoop: 'advisor_mark_sent',
  },
];

export const CRON_SECRET = 'wf-test-cron-secret-2026-11-25';
