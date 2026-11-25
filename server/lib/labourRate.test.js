import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LABOUR_RATE_INC_GST, resolveLabourRate, labourCostIncGst } from './labourRate.js';

test('labour rate defaults to $190 inc GST', () => {
  assert.equal(DEFAULT_LABOUR_RATE_INC_GST, 190);
  assert.equal(resolveLabourRate(), 190);
  assert.equal(resolveLabourRate(undefined, null, 0), 190);
});

test('labour rate resolves the first usable value', () => {
  assert.equal(resolveLabourRate(190), 190);
  assert.equal(resolveLabourRate(null, 175), 175);
  assert.equal(resolveLabourRate(undefined, 110), 110);
});

test('labour cost inc GST: 1 hr is $190, 0.5 hr is $95, 0.25 hr is $47.50', () => {
  assert.equal(labourCostIncGst(1, 190), 190);
  assert.equal(labourCostIncGst(0.5, 190), 95);
  assert.equal(labourCostIncGst(0.25, 190), 47.5);
  assert.equal(labourCostIncGst(1), 190);
  assert.equal(labourCostIncGst(0, 190), null);
  assert.equal(labourCostIncGst(null, 190), null);
});

test('labour is charged at the rate as-is — no GST added on top', () => {
  // The old code multiplied by 1.1, so 190 would have been charged as 209.
  assert.equal(labourCostIncGst(1, 190), 190);
  assert.notEqual(labourCostIncGst(1, 190), 209);
});
