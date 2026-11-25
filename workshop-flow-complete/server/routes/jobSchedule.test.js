import test from 'node:test';
import assert from 'node:assert/strict';
import {
  importJobSchedule,
  matchJobSchedule,
  jobScheduleStatus,
  resetStoredSchedule,
} from './jobSchedule.js';

const SAMPLE_CSV = [
  '"Job Card","In Date","Rego","Model Description","Owner","Mobile"',
  '"J03071742","25/11/26","S833CJG","Mitsubishi ASX","Mr David Maddern","0438710026"',
  '"J03073149","25/11/26","S515DCK","Toyota RAV4 Hybrid GX","Jo Parker","0400000000"',
].join('\n');

function callRoute(handler, { body, query } = {}) {
  return new Promise(resolve => {
    const req = { body, query };
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
    handler(req, res);
  });
}

test('job-schedule import stores rows and match finds them by Job Card', async () => {
  resetStoredSchedule();

  const imported = await callRoute(importJobSchedule, { body: { csvText: SAMPLE_CSV } });
  assert.equal(imported.status, 200);
  assert.equal(imported.data.success, true);
  assert.equal(imported.data.rowCount, 2);
  assert.deepEqual(imported.data.inDates, ['25/11/26']);

  const matched = await callRoute(matchJobSchedule, { query: { jobCard: 'J03071742' } });
  assert.equal(matched.status, 200);
  assert.equal(matched.data.matched, true);
  assert.equal(matched.data.row.owner, 'Mr David Maddern');
  assert.equal(matched.data.row.modelDescription, 'Mitsubishi ASX');

  const missing = await callRoute(matchJobSchedule, { query: { jobCard: 'J99999999' } });
  assert.equal(missing.data.matched, false);
  assert.equal(missing.data.row, null);

  const status = await callRoute(jobScheduleStatus, {});
  assert.equal(status.data.loaded, true);
  assert.equal(status.data.rowCount, 2);
});

test('job-schedule import rejects an empty CSV and a CSV without a Job Card column', async () => {
  resetStoredSchedule();

  const empty = await callRoute(importJobSchedule, { body: { csvText: '' } });
  assert.equal(empty.status, 400);

  const noCard = await callRoute(importJobSchedule, { body: { csvText: '"Rego","Owner"\n"S1","X"\n' } });
  assert.equal(noCard.status, 400);
  assert.match(noCard.data.error, /Job Card/);
});

test('job-schedule match requires a jobCard query param', async () => {
  const response = await callRoute(matchJobSchedule, { query: {} });
  assert.equal(response.status, 400);
});
