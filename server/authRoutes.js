import express from 'express';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { UserDB } from './userDb.js';
import { JWT_SECRET, AUTH_RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from './config.js';
import { validateEmail, validatePassword, validateTotpCode } from './inputValidation.js';
import { requireAuth } from './authMiddleware.js';

const router = express.Router();

// Stricter rate limit for auth endpoints to slow brute force
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

router.use(authLimiter);

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown';
}

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!validateEmail(email) || !validatePassword(password)) {
      return res.status(400).json({ error: 'Provide a valid email and a password of at least 8 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await UserDB.findByEmail(normalizedEmail);
    if (existingUser) {
      await UserDB.createAuditLog(existingUser.id, 'register_failed_exists', getClientIp(req));
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const secret = speakeasy.generateSecret({
      name: `SecureConvert (${normalizedEmail})`,
      length: 20
    });
    const passwordHash = await bcrypt.hash(password, 12);

    // Use transaction so user + mfa secret are created atomically
    const user = await UserDB.transaction(async () => {
      const created = await UserDB.createUser(normalizedEmail, passwordHash);
      await UserDB.updateUser(normalizedEmail, { mfaSecret: secret.base32, mfaEnabled: 1 });
      return created;
    });

    await UserDB.createAuditLog(user.id, 'register_success', getClientIp(req));

    return res.status(201).json({
      message: 'User registered successfully!',
      mfaSecret: secret.base32,
      otpauthUrl: secret.otpauth_url
    });
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    console.error('[register]', error);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login-step1', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!validateEmail(email) || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await UserDB.findByEmail(normalizedEmail);
    const passwordMatches = user && await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      if (user) await UserDB.createAuditLog(user.id, 'login_step1_failed', getClientIp(req));
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const tempToken = crypto.randomBytes(32).toString('hex');
    await UserDB.updateUser(normalizedEmail, { step3Token: tempToken });
    await UserDB.createAuditLog(user.id, 'login_step1_success', getClientIp(req));

    return res.status(200).json({
      message: 'Password accepted. Proceed to Step 2.',
      tempToken
    });
  } catch (error) {
    console.error('[login-step1]', error);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/login-step2', async (req, res) => {
  try {
    const { email, tempToken, totpCode } = req.body;

    if (!validateEmail(email) || typeof tempToken !== 'string' || !validateTotpCode(totpCode)) {
      return res.status(400).json({ error: 'Missing or invalid 2FA parameters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await UserDB.findByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!user.mfaSecret) {
      return res.status(400).json({ error: 'Two-factor authentication is not set up for this account.' });
    }

    if (user.step3Token !== tempToken) {
      await UserDB.createAuditLog(user.id, 'login_step2_failed_bad_token', getClientIp(req));
      return res.status(401).json({ error: 'The login step has expired. Please try again.' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: totpCode.trim(),
      window: 1
    });

    if (!verified) {
      await UserDB.createAuditLog(user.id, 'login_step2_failed_bad_totp', getClientIp(req));
      return res.status(401).json({ error: 'Invalid 6-digit TOTP code.' });
    }

    await UserDB.updateUser(normalizedEmail, { step3Token: null });

    const sessionId = crypto.randomUUID();
    const accessToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '1h', jwtid: sessionId }
    );
    const decodedToken = jwt.decode(accessToken);
    await UserDB.createSession(sessionId, user.id, accessToken, decodedToken.exp * 1000);
    await UserDB.createAuditLog(user.id, 'login_success', getClientIp(req));

    return res.status(200).json({
      message: '2FA authentication successful!',
      accessToken
    });
  } catch (error) {
    console.error('[login-step2]', error);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// Current user profile + history — used by dashboard after cross-window login
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await UserDB.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const jobs = await UserDB.listConversionJobs(req.user.id);
    return res.json({ email: user.email, id: user.id, jobs });
  } catch (error) {
    console.error('[me]', error);
    return res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    await UserDB.deleteSession(req.user.sessionId);
    await UserDB.createAuditLog(req.user.id, 'logout', getClientIp(req));
    return res.json({ message: 'Signed out.' });
  } catch (error) {
    console.error('[logout]', error);
    return res.status(500).json({ error: 'Logout failed.' });
  }
});

export default router;
