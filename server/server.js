import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { validateMagicBytes } from './fileValidator.js';
import { convertMarkdownToHtml, convertJsonToCsv } from './converter.js';
import authRoutes from './authRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Security Headers (CSP, HSTS, X-Frame-Options)
app.use(helmet());

// 2. Body Parsing Middleware (NEW - Put this here!)
app.use(express.json());

// 3. Cross-Origin Resource Sharing Protection
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
  credentials: true
}));

// 4. Rate Limiting (Prevents Brute Force Attacks)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// 5. Authentication API Routes (NEW - Put this here!)
app.use('/api/auth', authRoutes);

// 6. In-Memory File Upload Config (Zero Disk Persistence)
const storage = multer.memoryStorage(); 
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

// File Conversion Endpoint with Magic Byte Inspection
app.post('/api/convert', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const detectedType = validateMagicBytes(req.file.buffer);
  const targetFormat = req.body.targetFormat || 'html';

  if (!detectedType) {
    return res.status(400).json({ 
      error: 'Security Alert: Invalid or unverified file signature detected.' 
    });
  }

  console.log(`Processing ${req.file.originalname} (${detectedType}) -> ${targetFormat}`);

  const rawContent = req.file.buffer.toString('utf-8');

  // Convert Markdown/Text to HTML
  if (targetFormat === 'html') {
    const convertedHtml = convertMarkdownToHtml(rawContent);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="converted_${Date.now()}.html"`);
    return res.send(convertedHtml);
  }

  // Convert JSON to CSV
  if (targetFormat === 'csv') {
    const convertedCsv = convertJsonToCsv(req.file.buffer);
    if (!convertedCsv) {
      return res.status(400).json({ error: 'Invalid JSON array structure for CSV conversion.' });
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="converted_${Date.now()}.csv"`);
    return res.send(convertedCsv);
  }

  res.status(400).json({ error: 'Unsupported target format.' });
});

app.listen(PORT, () => {
  console.log(`🔒 SecureConvert Server running on port ${PORT}`);
});