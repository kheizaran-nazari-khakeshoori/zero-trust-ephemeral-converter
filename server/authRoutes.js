import express from 'express';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserDB } from './userDb.js';

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || 'development-only-change-this-secret';

router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await UserDB.findByEmail(normalizedEmail);
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists.' });
  }

  const secret = speakeasy.generateSecret({
    name: `SecureConvert (${normalizedEmail})`
  });
  const passwordHash = await bcrypt.hash(password, 12);

  await UserDB.createUser(normalizedEmail, passwordHash);
  await UserDB.updateUser(normalizedEmail, { mfaSecret: secret.base32 });

  return res.status(200).json({
    message: 'User registered successfully!',
    mfaSecret: secret.base32
  });
});

router.post('/login-step1', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await UserDB.findByEmail(normalizedEmail);
  const passwordMatches = user && await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const tempToken = crypto.randomBytes(32).toString('hex');
  await UserDB.updateUser(normalizedEmail, { step3Token: tempToken });

  return res.status(200).json({
    message: 'Password accepted. Proceed to Step 2.',
    tempToken
  });
});

router.post('/login-step2', async (req, res) => {
  const { email, tempToken, totpCode } = req.body;

  if (!email || !tempToken || !totpCode) {
    return res.status(400).json({ error: 'Missing required 2FA parameters.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await UserDB.findByEmail(normalizedEmail);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (user.step3Token !== tempToken) {
    return res.status(401).json({ error: 'The login step has expired. Please try again.' });
  }

  const verified = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: totpCode,
    window: 1 // Allows 30 seconds time drift grace period
  });

  if (!verified) {
    return res.status(400).json({ error: 'Invalid 6-digit TOTP code.' });
  }

  await UserDB.updateUser(normalizedEmail, { step3Token: null });

  const sessionId = crypto.randomUUID();
  const accessToken = jwt.sign(
    { userId: user.id },
    jwtSecret,
    { expiresIn: '1h', jwtid: sessionId }
  );
  const decodedToken = jwt.decode(accessToken);
  await UserDB.createSession(sessionId, user.id, accessToken, decodedToken.exp * 1000);

  return res.status(200).json({
    message: '2FA authentication successful!',
    accessToken
  });
});

export default router;