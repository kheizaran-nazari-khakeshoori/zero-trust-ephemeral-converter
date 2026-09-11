import express from 'express';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import QRCode from 'qrcode';
import { UserDB } from './userDb.js';
import { JWT_SECRET, AUTH_RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from './config.js';
import { validateEmail, validatePassword, validateTotpCode } from './inputValidation.js';

const router = express.Router();

// Utility: generate a QR image for any otpauth:// URL - NOT rate limited (image load would otherwise 429)
// Useful as fallback for client-side rendering or for re-displaying the code.
// GET /api/auth/qr?data=otpauth://totp/...   -> image/png
// GET /api/auth/qr?data=...&format=json      -> { qrDataUrl }
router.get('/qr', async (req, res) => {
  try {
    const data = req.query.data || req.query.otpauthUrl || req.query.url;
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Missing ?data=otpauth://... query parameter.' });
    }
    if (data.length > 1024) {
      return res.status(400).json({ error: 'QR data too long.' });
    }
    if (!data.startsWith('otpauth://')) {
      return res.status(400).json({ error: 'QR data must be an otpauth:// URL.' });
    }

    if (req.query.format === 'json') {
      const qrDataUrl = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 300
      });
      return res.json({ qrDataUrl, otpauthUrl: data });
    }

    const pngBuffer = await QRCode.toBuffer(data, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 300,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', pngBuffer.length);
    return res.send(pngBuffer);
  } catch (error) {
    console.error('[qr]', error);
    return res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

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

    // Generate QR code Data URL for Google Authenticator / Authy / Microsoft Authenticator
    let qrDataUrl = null;
    try {
      if (secret.otpauth_url) {
        qrDataUrl = await QRCode.toDataURL(secret.otpauth_url, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 300,
          color: { dark: '#000000', light: '#ffffff' }
        });
      }
    } catch (qrError) {
      console.warn('[register] QR generation failed', qrError);
    }

    return res.status(201).json({
      message: 'User registered successfully!',
      mfaSecret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrDataUrl
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

export default router;

// Defines the authentication routes for the application, including registration, login, and two-factor authentication.
// jwt : The code uses JSON Web Tokens (JWT) for session management. After successful 2FA verification, a JWT is generated and returned to the client. This token can be used for subsequent authenticated requests to the server.