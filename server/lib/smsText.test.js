import test from 'node:test';
import assert from 'node:assert/strict';
import { toPlainAscii, isPlainAscii, SMS_ASCII_RULES } from './smsText.js';

test('toPlainAscii converts curly quotes and dashes to ASCII', () => {
  assert.equal(toPlainAscii('Hi — it’s a “test”'), `Hi - it's a "test"`);
  assert.equal(toPlainAscii('2×4 • done …'), '2x4 - done ...');
  assert.equal(toPlainAscii('plain text stays plain'), 'plain text stays plain');
  assert.equal(toPlainAscii(''), '');
  assert.equal(toPlainAscii(null), '');
});

test('toPlainAscii drops other non-ASCII characters instead of leaving "?"', () => {
  assert.equal(toPlainAscii('café'), 'caf');
  assert.ok(isPlainAscii(toPlainAscii('— ‘’ “” … × • é')));
});

test('isPlainAscii detects non-ASCII text', () => {
  assert.equal(isPlainAscii('Hello, world.'), true);
  assert.equal(isPlainAscii('Hello — world.'), false);
  assert.equal(isPlainAscii('it’s'), false);
});

test('SMS ASCII rules forbid non-ASCII and quotation marks', () => {
  assert.match(SMS_ASCII_RULES, /plain ASCII/);
  assert.match(SMS_ASCII_RULES, /Do not wrap the SMS in quotation marks/);
  assert.ok(isPlainAscii(SMS_ASCII_RULES));
});
