import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  convertJsonToCsv,
  convertMarkdownToHtml,
  convertMarkdownToPdf,
  convertPngToWebp
} from './converter.js';

test('escapes unsafe Markdown content in HTML output', () => {
  const html = convertMarkdownToHtml('# Title\n<script>alert(1)</script>');
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('converts Markdown into a PDF buffer', async () => {
  const pdf = await convertMarkdownToPdf('# Report');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});

test('converts a PNG buffer into WebP', async () => {
  const png = await sharp({
    create: { width: 2, height: 2, channels: 4, background: 'red' }
  }).png().toBuffer();
  const webp = await convertPngToWebp(png);
  assert.equal(webp.subarray(0, 4).toString(), 'RIFF');
});

test('creates CSV columns from every JSON row', () => {
  const csv = convertJsonToCsv(Buffer.from(JSON.stringify([
    { name: 'Ada', role: 'admin' },
    { name: 'Lin', active: true }
  ])));
  assert.match(csv, /"name","role","active"/);
  assert.match(csv, /"Lin",,"true"/);
});
