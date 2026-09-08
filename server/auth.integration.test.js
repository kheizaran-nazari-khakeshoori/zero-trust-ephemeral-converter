import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import speakeasy from 'speakeasy';
import app from './server.js';

test('registers a user and completes both login steps', async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const email = `test-${Date.now()}@example.com`;

  try {
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'correct horse battery staple' })
    });
    const registration = await registerResponse.json();
    assert.ok([200, 201].includes(registerResponse.status));
    assert.ok(registration.mfaSecret);

    const passwordResponse = await fetch(`${baseUrl}/api/auth/login-step1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'correct horse battery staple' })
    });
    const passwordStep = await passwordResponse.json();
    assert.equal(passwordResponse.status, 200);

    const totpCode = speakeasy.totp({ secret: registration.mfaSecret, encoding: 'base32' });
    const mfaResponse = await fetch(`${baseUrl}/api/auth/login-step2`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, tempToken: passwordStep.tempToken, totpCode })
    });
    const mfaResult = await mfaResponse.json();
    assert.equal(mfaResponse.status, 200);
    assert.ok(mfaResult.accessToken);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('rejects incorrect passwords', async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login-step1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'missing@example.com', password: 'wrong-password' })
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
