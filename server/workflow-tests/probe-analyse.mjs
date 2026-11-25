// One-off probe: full analyse-repairs response for the Tyre-prefixed line.
import { createFakeSupabase } from './fakeSupabase.js';
import { createHarnessServer, newMemoryStore } from './workflowHarness.js';

const { server, baseUrl } = await createHarnessServer({
  fake: createFakeSupabase(), store: newMemoryStore(), now: new Date('2026-11-25T00:00:00Z'), businessId: 'biz-1',
});
const res = await fetch(`${baseUrl}/api/ai/analyse-repairs`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    request: {
      job_card_number: 'J03074001', vehicle_type: 'RAV4 Hybrid GX',
      parts: [{ part_type: 'tyres', description: '225/65R17 102H SC-MS' }],
      tyre_tread_depths: { lh_front: 5, rh_front: 2, lh_rear: 2, rh_rear: 1 },
      labour_lines: [{ hours: 1 }],
      quote_pdf_text: 'PARTS QUOTATION Description Part Number Qty Unit Price (ex GST) GST Total (inc GST) Tyre 225/65R17 102H TYR-22565 1 $180.91 $18.09 $199.00 Subtotal (ex GST): $180.91 GST (10%): $18.09 TOTAL (inc GST): $199.00',
    },
  }),
});
const j = await res.json();
console.log('status:', res.status);
console.log(JSON.stringify(j, null, 1).slice(0, 1500));
server.close();
