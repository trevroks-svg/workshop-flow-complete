import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTyreSetOfFourRule,
  tyresNeedReplacement,
  getMinRoadTreadMm,
  TYRE_REPLACEMENT_TREAD_MM,
  TYRE_SET_SIZE,
} from './tyreRule.js';
import { labourCostIncGst } from './labourRate.js';

const SINGLE_TYRE_GROUP = {
  repair_name: 'Tyres',
  parts: ['Tyres 225/65R17'],
  parts_cost_ex_gst: 180.91,
  estimated_labour_hours: 1,
  labour_hours: 1,
};
const SINGLE_TYRE_LINE = [
  { description: 'Tyre 225/65R17', quantity: 1, unit_price_ex_gst: 180.91 },
];
// Trial case, 24 Nov 2026: treads LF 5 / RF 2 / LR 2 / RR 1mm.
const WORN_TREADS = { lh_front: 5, rh_front: 2, lh_rear: 2, rh_rear: 1 };

test('tyre rule triggers at 2mm and prices a set of four', () => {
  assert.equal(TYRE_REPLACEMENT_TREAD_MM, 2);
  assert.equal(TYRE_SET_SIZE, 4);
  assert.equal(getMinRoadTreadMm(WORN_TREADS), 1);
  assert.equal(tyresNeedReplacement(WORN_TREADS), true);

  const [group] = applyTyreSetOfFourRule([SINGLE_TYRE_GROUP], SINGLE_TYRE_LINE, { tyre_tread_depths: WORN_TREADS });
  assert.equal(group.parts_cost_ex_gst, 723.64); // 4 x $180.91
  assert.equal(group.tyre_set_of_four, true);
  assert.equal(group.tyre_rule_applied, true);
  assert.match(group.tyre_rule_note, /set of four/);

  // Fitted total: 4 tyres inc GST + 1 hr labour inc GST = $986.00 (trial figure).
  const fittedTotal = group.parts_cost_ex_gst * 1.1 + labourCostIncGst(group.labour_hours, 190);
  assert.equal(fittedTotal.toFixed(2), '986.00');
});

test('tyre rule is idempotent', () => {
  const once = applyTyreSetOfFourRule([SINGLE_TYRE_GROUP], SINGLE_TYRE_LINE, { tyre_tread_depths: WORN_TREADS });
  const twice = applyTyreSetOfFourRule(once, SINGLE_TYRE_LINE, { tyre_tread_depths: WORN_TREADS });
  assert.deepEqual(twice, once);
});

test('tyre rule does not reprice when road treads are above 2mm (spare tyre case)', () => {
  const [group] = applyTyreSetOfFourRule(
    [{ repair_name: 'Tyres', parts: ['Tyres 265/65R17'], parts_cost_ex_gst: 163.64, labour_hours: 0.25 }],
    [{ description: 'Tyre 265/65R17', quantity: 1, unit_price_ex_gst: 163.64 }],
    { tyre_tread_depths: { lh_front: 3, rh_front: 4, lh_rear: 4, rh_rear: 6 } }
  );
  assert.equal(group.parts_cost_ex_gst, 163.64);
  assert.equal(group.tyre_set_of_four, false);
});

test('tyre rule leaves pricing alone when no tread depths were recorded', () => {
  const [group] = applyTyreSetOfFourRule(
    [{ repair_name: 'Tyres', parts: ['Tyres'], parts_cost_ex_gst: 100, labour_hours: 1 }],
    [{ description: 'Tyre', quantity: 1, unit_price_ex_gst: 100 }],
    {}
  );
  assert.equal(group.parts_cost_ex_gst, 100);
  assert.equal(group.tyre_tread_data_missing, true);
});

test('tyre rule boundary: 2mm triggers, above 2mm does not', () => {
  assert.equal(tyresNeedReplacement({ lh_front: 2, rh_front: 5, lh_rear: 5, rh_rear: 5 }), true);
  assert.equal(tyresNeedReplacement({ lh_front: 2.1, rh_front: 5, lh_rear: 5, rh_rear: 5 }), false);
  assert.equal(tyresNeedReplacement({ lh_front: 'Below 1 mm', rh_front: 5, lh_rear: 5, rh_rear: 5 }), true);
});

test('tyre rule ignores the spare and non-tyre groups', () => {
  assert.equal(
    tyresNeedReplacement({ lh_front: 5, rh_front: 5, lh_rear: 5, rh_rear: 5, spare: 'Below 1 mm' }),
    false
  );
  const [group] = applyTyreSetOfFourRule(
    [{ repair_name: 'Air Filter', parts: ['Air Filter'], parts_cost_ex_gst: 18.5, labour_hours: 0.5 }],
    [{ description: 'Air Filter', quantity: 1, unit_price_ex_gst: 18.5 }],
    { tyre_tread_depths: WORN_TREADS }
  );
  assert.equal(group.parts_cost_ex_gst, 18.5);
  assert.equal(group.tyre_set_of_four, undefined);
});
