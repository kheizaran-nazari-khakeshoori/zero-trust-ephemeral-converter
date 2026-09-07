import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMagicBytes } from './fileValidator.js';

test('recognizes PNG files by their signature', () => {
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  assert.equal(validateMagicBytes(png), 'png');
});

test('recognizes valid JSON objects', () => {
  assert.equal(validateMagicBytes(Buffer.from('{"ok":true}')), 'json');
});

test('rejects malformed JSON and binary content', () => {
  assert.equal(validateMagicBytes(Buffer.from('{"ok":')), null);
  assert.equal(validateMagicBytes(Buffer.from([0, 1, 2, 3])), null);
});
