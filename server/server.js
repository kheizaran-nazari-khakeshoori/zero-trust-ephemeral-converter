import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { validateMagicBytes } from './fileValidator.js';

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Security Headers (CSP, HSTS, X-Frame-Options)
app.use(helmet());

// 2. Cross-Origin Resource Sharing Protection
app.use(cors({ origin: 'http://localhost:3000' }));

// 3. Rate Limiting (Prevents Brute Force Attacks)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// 4. In-Memory File Upload Config (Zero Disk Persistence)
const storage = multer.memoryStorage(); 
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

// File Conversion Endpoint
app.post('/api/convert', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  // Inspect the binary buffer headers
  const detectedType = validateMagicBytes(req.file.buffer);

  if (!detectedType) {
    return res.status(400).json({ 
      error: 'Security Alert: Invalid or unverified file signature detected. File rejected.' 
    });
  }

  console.log(`Verified File Type: ${detectedType.toUpperCase()} | Size: ${req.file.size} bytes`);

  res.json({
    message: `File verified as valid [${detectedType.toUpperCase()}] and processed safely in RAM!`,
    filename: req.file.originalname,
    detectedType: detectedType
  });
});

app.listen(PORT, () => {
  console.log(`🔒 SecureConvert Server running on port ${PORT}`);
});