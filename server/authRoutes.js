import express from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import { UserDB } from './userDb.js';

const router = express.Router();

// 1. REGISTER ROUTE
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Email and password (min 8 chars) required.' });
    }

    const existingUser = UserDB.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    UserDB.createUser(email, hashedPassword);

    const secret = speakeasy.generateSecret({ length: 20 });
    const mfaSecret = secret.base32;

    UserDB.updateUser(email, { mfaSecret, mfaEnabled: true });

    res.json({
      message: 'Registration successful!',
      mfaSecret: mfaSecret
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// 2. LOGIN STEP 1 (Verify Password)
router.post('/login-step1', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = UserDB.findByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const step3Token = crypto.randomBytes(32).toString('hex');
    UserDB.updateUser(email, { step3Token });

    res.json({ tempToken: step3Token });
  } catch (err) {
    console.error('Login Step 1 Error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// 3. LOGIN STEP 2 (Verify 2FA)
router.post('/login-step2', async (req, res) => {
  try {
    const { email, tempToken, totpCode } = req.body;

    if (!email || !totpCode) {
      return res.status(400).json({ error: 'Missing email or 2FA code.' });
    }

    const user = UserDB.findByEmail(email);

    if (!user || !user.mfaSecret) {
      return res.status(400).json({ error: 'User 2FA not initialized.' });
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid 2FA Code. Check your TOTP generator app.' });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    res.json({ sessionToken });
  } catch (err) {
    console.error('Login Step 2 Error:', err);
    res.status(500).json({ error: 'Server error during 2FA verification.' });
  }
});

export default router;