import test from 'node:test';
import assert from 'node:assert/strict';
import { plainPartName, classifyPart, groupsHaveOptions } from './plainPartName.js';

test('plainPartName keeps the full tyre size and drops the code', () => {
  assert.equal(plainPartName('225/65R17 102H SC-MS'), 'Tyre 225/65R17');
  assert.equal(plainPartName('265/65R17 HIFLY TYRE'), 'Hifly tyre 265/65R17');
  assert.equal(plainPartName('Tyre 225/65R17 102H'), 'Tyre 225/65R17');
});

test('plainPartName names tyre brands and models in plain English', () => {
  assert.equal(plainPartName('KUMHO HP71 TYRE'), 'Kumho HP71 tyre');
  assert.equal(plainPartName('HIFLY HP801 TYRE'), 'Hifly HP801 tyre');
  assert.equal(plainPartName('235/55R19 105V HIFLY HP801'), 'Hifly HP801 tyre 235/55R19');
});

test('plainPartName translates part-code jargon', () => {
  assert.equal(plainPartName('ELEMENT SUB-ASSY'), 'Air filter');
  assert.equal(plainPartName('ELEMENT AIR REFINER'), 'Air filter');
  assert.equal(plainPartName('LN1MF TOYOTA BATTERY'), 'Toyota battery');
  assert.equal(plainPartName('BLADE,HYBRID REFILL,8.5x710MM'), 'Wiper blades');
  assert.equal(plainPartName('CABIN FILTER'), 'Cabin filter');
  assert.equal(plainPartName('CABIN AIR FILTER'), 'Cabin filter');
});

test('classifyPart recognises tyre sizes and filter part codes as families', () => {
  assert.equal(classifyPart('225/65R17 102H SC-MS').family, 'tyres');
  assert.equal(classifyPart('ELEMENT SUB-ASSY').family, 'air_filter');
  assert.equal(classifyPart('LN1MF TOYOTA BATTERY').family, 'battery');
  assert.equal(classifyPart('GARNISH ASSY-FRT DR SIDE').family, 'other');
});

test('groupsHaveOptions is true only for same-family alternatives', () => {
  const kumho = { repair_name: 'KUMHO HP71 TYRE', parts_cost_ex_gst: 718 };
  const hifly = { repair_name: 'HIFLY HP801 TYRE', parts_cost_ex_gst: 338 };
  assert.equal(groupsHaveOptions([kumho, hifly]), true);
  assert.equal(groupsHaveOptions([kumho]), false);
  assert.equal(groupsHaveOptions([
    { repair_name: 'ELEMENT SUB-ASSY', parts_cost_ex_gst: 74.02 },
    { repair_name: 'CABIN FILTER', parts_cost_ex_gst: 80.85 },
  ]), false);
  assert.equal(groupsHaveOptions([
    { repair_name: 'GARNISH ASSY-FRT DR SIDE', parts_cost_ex_gst: 223.1 },
    { repair_name: 'MIRROR ASSY', parts_cost_ex_gst: 150 },
  ]), false);
});

test('plainPartName uses the request part type when the name alone is ambiguous', () => {
  assert.equal(plainPartName('hifly HP801', 'tyres'), 'Hifly HP801 tyre');
  assert.equal(plainPartName('hifly HP801'), 'Hifly hp801');
});
