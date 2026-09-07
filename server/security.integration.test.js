import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import speakeasy from 'speakeasy';
import app from './server.js';

async function createServerAndToken() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const email = `security-${Date.now()}@example.com`;
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
  return { server, baseUrl, token: (await mfaResponse.json()).accessToken };
}

async function upload(baseUrl, token, body, name = 'sample.md') {
  const form = new FormData();
  form.append('file', new Blob([body]), name);
  form.append('targetFormat', 'html');
  return fetch(`${baseUrl}/api/convert`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
}

test('rejects files larger than the upload limit', async () => {
  const { server, baseUrl, token } = await createServerAndToken();
  try {
    const response = await upload(baseUrl, token, Buffer.alloc(10 * 1024 * 1024 + 1));
    assert.equal(response.status, 413);
    assert.match(await response.text(), /file is too large/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('rejects binary data with an unverified file type', async () => {
  const { server, baseUrl, token } = await createServerAndToken();
  try {
    const response = await upload(baseUrl, token, Buffer.from([0, 1, 2, 3, 4]));
    assert.equal(response.status, 400);
    assert.match(await response.text(), /file type could not be verified/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('does not execute HTML supplied inside Markdown', async () => {
  const { server, baseUrl, token } = await createServerAndToken();
  try {
    const response = await upload(baseUrl, token, '<script>alert(1)</script>');
    assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), /<script>alert/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
