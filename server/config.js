import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env files in order: .env.local overrides .env
for (const envFile of ['.env.local', '.env']) {
  const envPath = path.join(__dirname, envFile);
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
}
// Also load from repo root if present
dotenv.config({ override: false });

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = Number.parseInt(process.env.PORT || '5000', 10);
export const HOST = process.env.HOST || '127.0.0.1';

const defaultDevSecret = 'development-only-change-this-secret';
export const JWT_SECRET = process.env.JWT_SECRET || defaultDevSecret;

if (NODE_ENV === 'production' && JWT_SECRET === defaultDevSecret) {
  throw new Error('JWT_SECRET must be set to a strong random value in production');
}

if (JWT_SECRET.length < 32 && NODE_ENV !== 'test') {
  console.warn('[config] JWT_SECRET is short — use at least 32 random characters in production');
}

export const CORS_ORIGINS = (process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000']);

export const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);
export const RATE_LIMIT_MAX = Number.parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
export const AUTH_RATE_LIMIT_MAX = Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10);

export const MAX_UPLOAD_SIZE = Number.parseInt(process.env.MAX_UPLOAD_SIZE || String(10 * 1024 * 1024), 10);





// Configuration for the file upload and validation