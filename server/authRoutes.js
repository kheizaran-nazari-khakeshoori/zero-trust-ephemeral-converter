import express from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import { UserDB } from './userDb.js';

const router = express.Router();

// 1. REGISTER ROUTE (Email Only)
router.post('/register', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    // Check if user exists
    const existingUser = UserDB.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already registered.' });
    }

    // Generate TOTP Secret Key using speakeasy
    const secret = speakeasy.generateSecret({ length: 20 });
    const mfaSecret = secret.base32;

    // Create base user record without password yet
    UserDB.createUser(email, null);
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
    if (!user) {
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
    res.status(500).json({ error: 'Server error.' });
  }
});

// 3. LOGIN STEP 2 (Verify 2FA)
router.post('/login-step2', async (req, res) => {
  try {
    const { tempToken, totpCode } = req.body;

    // Find user matching tempToken
    let userFound = null;
    const allUsers = Array.from(users.values()); // helper fallback
    
    // Check if token matches
    if (!tempToken || !totpCode) {
      return res.status(400).json({ error: 'Missing token or code.' });
    }

    const isValid = speakeasy.totp.verify({
      secret: userFound?.mfaSecret || '',
      encoding: 'base32',
      token: totpCode
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid 2FA Code.' });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    res.json({ sessionToken });
  } catch (err) {
    console.error('Login Step 2 Error:', err);
    res.status(500).json({ error: 'Server error during 2FA.' });
  }
});

export default router;