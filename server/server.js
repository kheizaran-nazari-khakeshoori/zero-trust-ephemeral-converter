import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { validateMagicBytes } from './fileValidator.js';
import {
  convertMarkdownToHtml,
  convertMarkdownToPdf,
  convertPngToWebp,
  convertJsonToCsv
} from './converter.js';
import authRoutes from './authRoutes.js';
import { requireAuth } from './authMiddleware.js';
import { UserDB } from './userDb.js';
import { HOST, PORT } from './config.js';
import {
  ALLOWED_TARGET_FORMATS,
  MAX_UPLOAD_SIZE,
  validateOriginalFilename
} from './inputValidation.js';

const app = express();

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
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
    files: 1,
    fields: 2,
    parts: 3
  },
  fileFilter: (req, file, callback) => {
    if (!validateOriginalFilename(file.originalname)) {
      return callback(new Error('Invalid file name.'));
    }
    return callback(null, true);
  }
});

// File Conversion Endpoint with Magic Byte Inspection
app.post('/api/convert', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const detectedType = validateMagicBytes(req.file.buffer);
  const targetFormat = typeof req.body.targetFormat === 'string'
    ? req.body.targetFormat.trim().toLowerCase()
    : '';

  if (!ALLOWED_TARGET_FORMATS.has(targetFormat)) {
    return res.status(400).json({ error: 'Choose a supported target format: html, pdf, csv, or webp.' });
  }

  if (!detectedType) {
    return res.status(400).json({ 
      error: 'The file type could not be verified. Upload a valid text, JSON, or PNG file.'
    });
  }

  if (targetFormat === 'webp' && detectedType !== 'png') {
    return res.status(400).json({ error: 'WebP conversion requires a PNG image.' });
  }
  if (['html', 'pdf'].includes(targetFormat) && !['txt', 'json'].includes(detectedType)) {
    return res.status(400).json({ error: 'HTML and PDF conversion requires a text or Markdown file.' });
  }
  if (targetFormat === 'csv' && detectedType !== 'json') {
    return res.status(400).json({ error: 'CSV conversion requires a valid JSON file.' });
  }

  await UserDB.createConversionJob(
    req.user.id,
    req.file.originalname,
    detectedType,
    targetFormat,
    'completed'
  );

  console.log(`Processing ${req.file.originalname} (${detectedType}) -> ${targetFormat}`);

  const rawContent = req.file.buffer.toString('utf-8');

  // Convert Markdown/Text to HTML
  if (targetFormat === 'html') {
    const convertedHtml = convertMarkdownToHtml(rawContent);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="converted_${Date.now()}.html"`);
    return res.send(convertedHtml);
  }

  if (targetFormat === 'pdf') {
    const convertedPdf = await convertMarkdownToPdf(rawContent);
    if (!convertedPdf) {
      return res.status(400).json({ error: 'The text file does not contain convertible content.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="converted_${Date.now()}.pdf"`);
    return res.send(convertedPdf);
  }

  if (targetFormat === 'webp') {
    const convertedWebp = await convertPngToWebp(req.file.buffer);
    if (!convertedWebp) {
      return res.status(400).json({ error: 'The PNG image could not be converted to WebP.' });
    }
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Disposition', `attachment; filename="converted_${Date.now()}.webp"`);
    return res.send(convertedWebp);
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

app.get('/api/history', requireAuth, async (req, res) => {
  const jobs = await UserDB.listConversionJobs(req.user.id);
  return res.json({ jobs });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`🔒 SecureConvert Server running on http://${HOST}:${PORT}`);
  });
}

export default app;