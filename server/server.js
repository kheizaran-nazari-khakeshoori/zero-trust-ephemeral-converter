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
import {
  CORS_ORIGINS,
  HOST,
  MAX_UPLOAD_SIZE,
  PORT,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS
} from './config.js';
import {
  ALLOWED_TARGET_FORMATS,
  validateOriginalFilename
} from './inputValidation.js';

const app = express();

// 1. Security Headers (CSP, HSTS, X-Frame-Options)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
// Always hide powered-by header even if helmet config changes
app.disable('x-powered-by');

// 2. Body Parsing Middleware
app.use(express.json({ limit: '100kb' }));

// Health check - no auth, no rate limit
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// 3. Cross-Origin Resource Sharing Protection
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true
}));

// 4. Rate Limiting (Prevents Brute Force Attacks)
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// 5. Authentication API Routes
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

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `The file is too large. The maximum size is ${Math.round(MAX_UPLOAD_SIZE / (1024 * 1024))} MB.` });
  }
  if (error.message === 'Invalid file name.') {
    return res.status(400).json({ error: 'The uploaded file name is not allowed.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large.' });
  }
  console.error('[error]', error);
  return res.status(500).json({ error: 'Internal server error.' });
});

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, HOST, () => {
    console.log(`🔒 SecureConvert Server running on http://${HOST}:${PORT}`);
  });

  const shutdown = () => {
    console.log('[shutdown] Closing server...');
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;