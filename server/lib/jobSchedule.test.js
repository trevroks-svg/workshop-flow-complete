import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJobScheduleCsv, matchJobCard, scheduleRowToCustomer, parseCsvText } from './jobSchedule.js';

const SAMPLE_CSV = [
  '"Company","Job Card","In Date","In Time","Rego","Model Description","Owner","Mobile","Email","Operation","Advisor Name","Status","VIN"',
  '"01","J03071742","25/11/26","09:45","S833CJG","Mitsubishi XD ASX GSR 2.4L PET CVT 2WD","Mr David Maddern and Mrs Vanessa Maddern","0438710026","vanessamaddern@westnet.com.au","BODY INTERIOR FIR - C/C AUDIO UNIT, TOUCHSCREEN INOPERATIVE","Campbell Jacobs","Job Card","JMFXTGA5WMU001578"',
  '"01","J03073149","25/11/26","11:00","S515DCK","Toyota RAV4 Hybrid GX","Jo Parker","0400000000","jo@example.com","TYRES","Sam Hastwell","Job Card","JTMBD3FV123456789"',
].join('\n');

test('job schedule parser reads quoted CSV rows', () => {
  const { rows, errors, inDates } = parseJobScheduleCsv(SAMPLE_CSV);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 2);
  assert.deepEqual(inDates, ['25/11/26']);
  assert.equal(rows[0].jobCard, 'J03071742');
  assert.equal(rows[0].owner, 'Mr David Maddern and Mrs Vanessa Maddern');
  assert.equal(rows[0].operation, 'BODY INTERIOR FIR - C/C AUDIO UNIT, TOUCHSCREEN INOPERATIVE');
  assert.equal(rows[0].mobile, '0438710026');
});

test('job schedule matches on Job Card, case-insensitive, never on rego', () => {
  const { rows } = parseJobScheduleCsv(SAMPLE_CSV);
  assert.equal(matchJobCard(rows, 'J03071742')?.owner, 'Mr David Maddern and Mrs Vanessa Maddern');
  assert.equal(matchJobCard(rows, 'j03071742')?.jobCard, 'J03071742');
  assert.equal(matchJobCard(rows, 'J99999999'), null);
  assert.equal(matchJobCard(rows, 'S833CJG'), null); // rego must not match
  assert.equal(matchJobCard(rows, ''), null);
  assert.equal(matchJobCard([], 'J03071742'), null);
});

test('schedule row maps to customer name and vehicle', () => {
  const { rows } = parseJobScheduleCsv(SAMPLE_CSV);
  assert.deepEqual(scheduleRowToCustomer(matchJobCard(rows, 'J03073149')), {
    customerName: 'Jo Parker',
    vehicle: 'Toyota RAV4 Hybrid GX',
    mobile: '0400000000',
    rego: 'S515DCK',
  });
  assert.equal(scheduleRowToCustomer(null), null);
});

test('job schedule parser reports a missing Job Card column', () => {
  const { rows, errors } = parseJobScheduleCsv('"Rego","Owner"\n"S123ABC","Someone"\n');
  assert.deepEqual(rows, []);
  assert.match(errors[0], /Job Card/);
});

test('csv parser handles embedded commas, doubled quotes and blank lines', () => {
  const grid = parseCsvText('"a","b, c","d""e"\n\n"1","2","3"\n');
  assert.deepEqual(grid, [['a', 'b, c', 'd"e'], ['1', '2', '3']]);
});
