import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database stored on disk
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT,
      mfaSecret TEXT,
      mfaEnabled INTEGER DEFAULT 0,
      step3Token TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      tokenHash TEXT UNIQUE NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (userId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expiresAt)');
  db.run(`
    CREATE TABLE IF NOT EXISTS conversion_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      originalFilename TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      targetType TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_conversion_jobs_user_id ON conversion_jobs (userId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_conversion_jobs_created_at ON conversion_jobs (createdAt)');
});

export const UserDB = {
  findByEmail: (email) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  createUser: (email, passwordHash) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (email, passwordHash) VALUES (?, ?)',
        [email.toLowerCase(), passwordHash],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, email: email.toLowerCase() });
        }
      );
    });
  },

  updateUser: (email, updates) => {
    return new Promise((resolve, reject) => {
      const keys = Object.keys(updates);
      const values = Object.values(updates);
      
      if (keys.length === 0) return resolve(null);

      const setClause = keys.map(key => `${key} = ?`).join(', ');
      values.push(email.toLowerCase());

      db.run(`UPDATE users SET ${setClause} WHERE email = ?`, values, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  createSession: (sessionId, userId, token, expiresAt) => {
    return new Promise((resolve, reject) => {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      db.run(
        'INSERT INTO sessions (id, userId, tokenHash, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)',
        [sessionId, userId, tokenHash, expiresAt, Date.now()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  findSession: (sessionId, token) => {
    return new Promise((resolve, reject) => {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      db.get(
        'SELECT * FROM sessions WHERE id = ? AND tokenHash = ? AND expiresAt > ?',
        [sessionId, tokenHash, Date.now()],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  createConversionJob: (userId, originalFilename, sourceType, targetType, status) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO conversion_jobs
          (userId, originalFilename, sourceType, targetType, status, createdAt)
          VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, originalFilename, sourceType, targetType, status, Date.now()],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  listConversionJobs: (userId, limit = 20) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, originalFilename, sourceType, targetType, status, createdAt
         FROM conversion_jobs WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
};