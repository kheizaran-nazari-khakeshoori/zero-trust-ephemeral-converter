import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';

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

  // The file is accessible in memory via req.file.buffer
  console.log(`Received file: ${req.file.originalname} (${req.file.size} bytes) in memory.`);

  // Example transformation step (Buffer in RAM)
  const fileContent = req.file.buffer.toString('utf-8');
  
  // Return converted content response directly
  res.json({
    message: 'File successfully processed entirely in RAM!',
    filename: req.file.originalname,
    bytesProcessed: req.file.size
  });
});

app.listen(PORT, () => {
  console.log(`🔒 SecureConvert Server running on port ${PORT}`);
});