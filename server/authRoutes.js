import express from 'express';
import bcrypt from 'bcryptjs';
import otplib from 'otplib';
import crypto from 'crypto';
import { UserDB } from './userDb.js';

const { authenticator } = otplib;

const router = express.Router();
// -------------------------------------------------------------
// STEP 1: Registration & Password Hashing
// -------------------------------------------------------------
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and password (min 8 chars) required.' });
  }

  if (UserDB.findByEmail(email)) {
    return res.status(400).json({ error: 'User already exists.' });
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  // Generate TOTP Secret for Step 2
  const mfaSecret = authenticator.generateSecret();

  const user = UserDB.createUser(email, passwordHash);
  UserDB.updateUser(email, { mfaSecret, mfaEnabled: true });

  const otpauthUrl = authenticator.keyuri(email, 'SecureConvert', mfaSecret);

  res.json({
    message: 'User registered successfully!',
    step2Setup: {
      totpSecret: mfaSecret,
      totpUri: otpauthUrl,
      instruction: 'Enter this secret key into Google Authenticator or Authy.'
    }
  });
});

// Step 1 Login: Password Verification
router.post('/login-step1', async (req, res) => {
  const { email, password } = req.body;

  const user = UserDB.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  res.json({
    message: 'Step 1 Passed: Password verified.',
    nextStep: 'STEP_2_TOTP_REQUIRED',
    email: user.email
  });
});

// -------------------------------------------------------------
// STEP 2: TOTP (Time-based One-Time Password) Verification
// -------------------------------------------------------------
router.post('/login-step2', (req, res) => {
  const { email, totpCode } = req.body;

  const user = UserDB.findByEmail(email);
  if (!user || !user.mfaSecret) {
    return res.status(401).json({ error: 'Session invalid or user not found.' });
  }

  // Verify TOTP token from Authenticator app
  const isValid = authenticator.check(totpCode, user.mfaSecret);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid 6-digit TOTP code.' });
  }

  // Generate ephemeral 128-bit Security Token for Step 3
  const step3Token = crypto.randomBytes(16).toString('hex');
  UserDB.updateUser(email, { step3Token });

  res.json({
    message: 'Step 2 Passed: Authenticator code verified.',
    nextStep: 'STEP_3_SECURITY_TOKEN_REQUIRED',
    securityToken: step3Token, // Sent out-of-band / security key prompt
    instruction: 'Submit your 32-character Security Key to finalize authentication.'
  });
});

// -------------------------------------------------------------
// STEP 3: Out-of-Band Security Token / Passkey Verification
// -------------------------------------------------------------
router.post('/login-step3', (req, res) => {
  const { email, securityToken } = req.body;

  const user = UserDB.findByEmail(email);
  if (!user || !user.step3Token) {
    return res.status(401).json({ error: 'Unauthorized sequence.' });
  }

  if (user.step3Token !== securityToken) {
    return res.status(401).json({ error: 'Security token verification failed.' });
  }

  // Clear single-use Step 3 token
  UserDB.updateUser(email, { step3Token: null });

  // Issue fully authenticated session response
  res.json({
    message: '🎉 Step 3 Passed! 3-Factor Authentication Complete.',
    sessionStatus: 'AUTHENTICATED_SECURE_CONVERT',
    user: user.email
  });
});

export default router;