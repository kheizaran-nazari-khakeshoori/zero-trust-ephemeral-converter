import express from 'express';
import speakeasy from 'speakeasy';

const router = express.Router();

// Temporary in-memory user storage (Reset on server restart)
const users = new Map();

// 1. REGISTER: Creates user & generates 2FA Secret Key
router.post('/register', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (users.has(email)) {
    return res.status(400).json({ error: 'User already exists.' });
  }

  // Generate 2FA Secret Key for Google Authenticator
  const secret = speakeasy.generateSecret({
    name: `SecureConvert (${email})`
  });

  users.set(email, {
    password,
    mfaSecret: secret.base32
  });

  return res.status(200).json({
    message: 'User registered successfully!',
    mfaSecret: secret.base32
  });
});

// 2. STEP 1: PASSWORD LOGIN
router.post('/login-step1', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = users.get(email);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Generate a temporary session token for Step 2
  const tempToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

  return res.status(200).json({
    message: 'Password accepted. Proceed to Step 2.',
    tempToken
  });
});

// 3. STEP 2: TOTP CODE VERIFICATION
router.post('/login-step2', (req, res) => {
  const { email, tempToken, totpCode } = req.body;

  if (!email || !tempToken || !totpCode) {
    return res.status(400).json({ error: 'Missing required 2FA parameters.' });
  }

  const user = users.get(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Verify the 6-digit TOTP token against the user's secret
  const verified = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: totpCode,
    window: 1 // Allows 30 seconds time drift grace period
  });

  if (!verified) {
    return res.status(400).json({ error: 'Invalid 6-digit TOTP code.' });
  }

  return res.status(200).json({
    message: '2FA authentication successful!'
  });
});

export default router;