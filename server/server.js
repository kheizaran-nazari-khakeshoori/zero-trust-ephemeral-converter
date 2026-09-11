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
  convertJsonToCsv,
  convertCsvToJson,
  convertTextToTxt,
  convertImage
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

// Supported conversions map (for UI and help endpoint)
export const SUPPORTED_CONVERSIONS = {
  txt: ['html', 'pdf', 'txt'],
  json: ['csv', 'html', 'pdf', 'txt', 'json'],
  csv: ['json', 'html', 'txt'],
  png: ['webp', 'png', 'jpg', 'jpeg'],
  jpg: ['webp', 'png', 'jpg', 'jpeg'],
  jpeg: ['webp', 'png', 'jpg', 'jpeg'],
  webp: ['png', 'jpg', 'jpeg', 'webp'],
  gif: ['png', 'webp'],
  pdf: []
};

app.get('/api/formats', (req, res) => {
  res.json({ supported: SUPPORTED_CONVERSIONS, allowed: [...ALLOWED_TARGET_FORMATS] });
});

// File Conversion Endpoint with Magic Byte Inspection
app.post('/api/convert', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const detectedType = validateMagicBytes(req.file.buffer);
    const rawTarget = typeof req.body.targetFormat === 'string' ? req.body.targetFormat.trim().toLowerCase() : '';
    // normalize jpeg alias
    const targetFormat = rawTarget === 'jpeg' ? 'jpg' : rawTarget;

    if (!ALLOWED_TARGET_FORMATS.has(rawTarget) && !ALLOWED_TARGET_FORMATS.has(targetFormat)) {
      return res.status(400).json({ error: `Choose a supported target format: ${[...ALLOWED_TARGET_FORMATS].join(', ')}.` });
    }

    if (!detectedType) {
      return res.status(400).json({
        error: 'The file type could not be verified. Upload a valid text, JSON, CSV, PNG, JPG or WebP file.'
      });
    }

    // Validate compatibility
    const docTargets = new Set(['html', 'pdf', 'txt']);
    const imageTargets = new Set(['png', 'jpg', 'jpeg', 'webp']);
    const normalizedTarget = targetFormat; // jpg/jpeg unified
    const imageSources = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
    const textSources = new Set(['txt', 'json', 'csv']);

    if (docTargets.has(normalizedTarget) && !textSources.has(detectedType)) {
      return res.status(400).json({ error: ` ${normalizedTarget.toUpperCase()} conversion requires a text, Markdown, JSON or CSV file (got ${detectedType}).` });
    }
    if (normalizedTarget === 'csv' && detectedType !== 'json') {
      return res.status(400).json({ error: 'CSV conversion requires a valid JSON file.' });
    }
    if (normalizedTarget === 'json' && detectedType !== 'csv') {
      return res.status(400).json({ error: 'JSON conversion requires a CSV file.' });
    }
    if (imageTargets.has(normalizedTarget) && !imageSources.has(detectedType)) {
      return res.status(400).json({ error: `${normalizedTarget.toUpperCase()} conversion requires a PNG, JPG or WebP image (got ${detectedType}).` });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    console.log(`Processing ${req.file.originalname} (${detectedType}) -> ${normalizedTarget} for user ${req.user.id}`);

    let resultBuffer = null;
    let contentType = '';
    let fileExt = normalizedTarget === 'jpg' ? 'jpg' : normalizedTarget;

    if (normalizedTarget === 'html') {
      const rawContent = req.file.buffer.toString('utf-8');
      const convertedHtml = convertMarkdownToHtml(rawContent);
      if (!convertedHtml) return res.status(400).json({ error: 'The text file does not contain convertible content.' });
      resultBuffer = Buffer.from(convertedHtml, 'utf-8');
      contentType = 'text/html';
    } else if (normalizedTarget === 'pdf') {
      const rawContent = req.file.buffer.toString('utf-8');
      const convertedPdf = await convertMarkdownToPdf(rawContent);
      if (!convertedPdf) return res.status(400).json({ error: 'The text file does not contain convertible content.' });
      resultBuffer = convertedPdf;
      contentType = 'application/pdf';
    } else if (normalizedTarget === 'txt') {
      const txt = convertTextToTxt(req.file.buffer);
      if (!txt) return res.status(400).json({ error: 'The file does not contain convertible text.' });
      resultBuffer = Buffer.from(txt, 'utf-8');
      contentType = 'text/plain';
      fileExt = 'txt';
    } else if (imageTargets.has(normalizedTarget)) {
      // Use generic image converter (fallback to legacy png->webp for compat)
      let converted = await convertImage(req.file.buffer, normalizedTarget);
      if (!converted && normalizedTarget === 'webp' && detectedType === 'png') {
        converted = await convertPngToWebp(req.file.buffer);
      }
      if (!converted) return res.status(400).json({ error: `The image could not be converted to ${normalizedTarget.toUpperCase()}.` });
      resultBuffer = converted;
      if (normalizedTarget === 'webp') contentType = 'image/webp';
      else if (normalizedTarget === 'png') contentType = 'image/png';
      else contentType = 'image/jpeg';
    } else if (normalizedTarget === 'csv') {
      const convertedCsv = convertJsonToCsv(req.file.buffer);
      if (!convertedCsv) return res.status(400).json({ error: 'Invalid JSON array structure for CSV conversion.' });
      resultBuffer = Buffer.from(convertedCsv, 'utf-8');
      contentType = 'text/csv';
    } else if (normalizedTarget === 'json') {
      const convertedJson = convertCsvToJson(req.file.buffer);
      if (!convertedJson) return res.status(400).json({ error: 'Invalid CSV structure for JSON conversion.' });
      resultBuffer = Buffer.from(convertedJson, 'utf-8');
      contentType = 'application/json';
      fileExt = 'json';
    } else {
      return res.status(400).json({ error: 'Unsupported target format.' });
    }

    // Only record successful conversions
    await UserDB.createConversionJob(
      req.user.id,
      req.file.originalname,
      detectedType,
      targetFormat,
      'completed'
    );
    await UserDB.createAuditLog(req.user.id, `convert_${detectedType}_to_${targetFormat}`, ip);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="converted_${Date.now()}.${fileExt}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(resultBuffer);
  } catch (error) {
    console.error('[convert]', error);
    return res.status(500).json({ error: 'Conversion failed. Please try again.' });
  }
});

app.get('/api/history', requireAuth, async (req, res) => {
  const jobs = await UserDB.listConversionJobs(req.user.id);
  return res.json({ jobs });
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((error, req, res, _next) => {
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

// The main application server that handles all API requests and serves the frontend.