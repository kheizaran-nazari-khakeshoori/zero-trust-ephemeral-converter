import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import sharp from 'sharp';
import speakeasy from 'speakeasy';
import app from './server.js';

async function runningApp() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`
  };
}

async function convert(baseUrl, token, file, targetFormat) {
  const form = new FormData();
  form.append('file', new Blob([file.buffer]), file.name);
  form.append('targetFormat', targetFormat);
  return fetch(`${baseUrl}/api/convert`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
}

async function getToken(baseUrl) {
  const email = `conversion-${Date.now()}@example.com`;
  const password = 'correct horse battery staple';
  const registrationResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const registration = await registrationResponse.json();
  const passwordResponse = await fetch(`${baseUrl}/api/auth/login-step1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const passwordStep = await passwordResponse.json();
  const mfaResponse = await fetch(`${baseUrl}/api/auth/login-step2`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      tempToken: passwordStep.tempToken,
      totpCode: speakeasy.totp({ secret: registration.mfaSecret, encoding: 'base32' })
    })
  });
  return (await mfaResponse.json()).accessToken;
}

test('requires authentication before accepting uploads', async () => {
  const { server, baseUrl } = await runningApp();
  try {
    const response = await fetch(`${baseUrl}/api/convert`, { method: 'POST' });
    assert.equal(response.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('serves every supported conversion route', async () => {
  const { server, baseUrl } = await runningApp();
  try {
    const token = await getToken(baseUrl);
    const markdown = Buffer.from('# Hello');
    const json = Buffer.from('[{"name":"Ada"}]');
    const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: 'red' } }).png().toBuffer();

    const htmlResponse = await convert(baseUrl, token, { name: 'sample.md', buffer: markdown }, 'html');
    const pdfResponse = await convert(baseUrl, token, { name: 'sample.md', buffer: markdown }, 'pdf');
    const csvResponse = await convert(baseUrl, token, { name: 'data.json', buffer: json }, 'csv');
    const webpResponse = await convert(baseUrl, token, { name: 'image.png', buffer: png }, 'webp');

    assert.equal(htmlResponse.status, 200);
    assert.equal(pdfResponse.status, 200);
    assert.equal(csvResponse.status, 200);
    assert.equal(webpResponse.status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('rejects unsupported output formats clearly', async () => {
  const { server, baseUrl } = await runningApp();
  try {
    const token = await getToken(baseUrl);
    const response = await convert(baseUrl, token, { name: 'sample.md', buffer: Buffer.from('# Hello') }, 'exe');
    assert.equal(response.status, 400);
    assert.match(await response.text(), /supported target format/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

// Additional tests can be added here to cover more edge cases, such as invalid file types, oversized files, and other input validation scenarios.
