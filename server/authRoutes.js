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

    // Check if user already exists
    const existingUser = UserDB.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate TOTP Secret Key using speakeasy
    const secret = speakeasy.generateSecret({ length: 20 });
    const mfaSecret = secret.base32;

    // Save user to memory/DB
    UserDB.save({
      email,
      password: hashedPassword,
      mfaSecret
    });

    res.json({
      message: 'Registration successful!',
      mfaSecret: mfaSecret
    });
  } catch (err) {
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

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Create temporary session token for MFA step
    const tempToken = crypto.randomBytes(32).toString('hex');
    UserDB.saveTempToken(tempToken, user.email);

    res.json({ tempToken });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// 3. LOGIN STEP 2 (Verify TOTP Code)
router.post('/login-step2', async (req, res) => {
  try {
    const { tempToken, totpCode } = req.body;

    const email = UserDB.getTempTokenUser(tempToken);
    if (!email) {
      return res.status(401).json({ error: 'Session expired or invalid token.' });
    }

    const user = UserDB.findByEmail(email);

    // Verify TOTP code using speakeasy
    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: totpCode
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid 2FA Code.' });
    }

    // Clear temp token and issue final session
    UserDB.removeTempToken(tempToken);
    const sessionToken = crypto.randomBytes(32).toString('hex');
    UserDB.saveSession(sessionToken, user.email);

    res.json({ sessionToken });
  } catch (err) {
    res.status(500).json({ error: 'Server error during 2FA.' });
  }
});

export default router;