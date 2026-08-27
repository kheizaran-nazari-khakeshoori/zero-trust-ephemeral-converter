import express from 'express';
import bcrypt from 'bcryptjs';
import { UserDB } from './userDb.js';

const router = express.Router();

// Step 1: User Registration with Bcrypt Hashing
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and password (min 8 chars) required.' });
  }

  if (UserDB.findByEmail(email)) {
    return res.status(400).json({ error: 'User already exists.' });
  }

  // Hash password using Bcrypt with cost factor 12
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  UserDB.createUser(email, passwordHash);

  res.json({ message: 'Registration successful! Proceed to Step 1 Login.' });
});

// Step 1: Primary Password Authentication
router.post('/login-step1', async (req, res) => {
  const { email, password } = req.body;

  const user = UserDB.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  res.json({
    message: 'Step 1 Passed! Password verified.',
    nextStep: 'MFA_REQUIRED',
    userEmail: user.email
  });
});

export default router;