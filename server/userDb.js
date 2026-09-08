import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database stored on disk
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Lightweight migration system — version stored in pragma user_version
const MIGRATIONS = [
  // v1: base schema
  `
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT,
      mfaSecret TEXT,
      mfaEnabled INTEGER DEFAULT 0,
      step3Token TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      tokenHash TEXT UNIQUE NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (userId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expiresAt);
    CREATE TABLE IF NOT EXISTS conversion_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      originalFilename TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      targetType TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_conversion_jobs_user_id ON conversion_jobs (userId);
    CREATE INDEX IF NOT EXISTS idx_conversion_jobs_created_at ON conversion_jobs (createdAt);
  `,
  // v2: audit_logs + missing indexes
  `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      action TEXT NOT NULL,
      ipAddress TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (userId);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (createdAt);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
  `
];

function runMigrations() {
  db.serialize(() => {
    db.get('PRAGMA user_version', (err, row) => {
      if (err) return console.error('[db] failed to read user_version', err);
      const current = row ? row.user_version : 0;
      let version = current;
      const applyNext = () => {
        if (version >= MIGRATIONS.length) {
          if (version !== current) {
            db.run(`PRAGMA user_version = ${version}`);
          }
          // Enable WAL for better concurrency after migrations
          db.run('PRAGMA journal_mode = WAL');
          db.run('PRAGMA foreign_keys = ON');
          return;
        }
        db.exec(MIGRATIONS[version], (execErr) => {
          if (execErr) return console.error(`[db] migration v${version + 1} failed`, execErr);
          version += 1;
          db.run(`PRAGMA user_version = ${version}`, applyNext);
        });
      };
      applyNext();
    });
  });
}

runMigrations();

// Whitelist for updateUser to prevent SQL injection via column names
const ALLOWED_USER_COLUMNS = new Set(['passwordHash', 'mfaSecret', 'mfaEnabled', 'step3Token']);

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export const UserDB = {
  findByEmail: (email) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  },

  findById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
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
      const keys = Object.keys(updates).filter(k => ALLOWED_USER_COLUMNS.has(k));
      if (keys.length === 0) return resolve(0);
      const values = keys.map(k => updates[k]);
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
          else resolve(row || null);
        }
      );
    });
  },

  deleteSession: (sessionId) => runAsync('DELETE FROM sessions WHERE id = ?', [sessionId]),

  cleanupExpiredSessions: () => runAsync('DELETE FROM sessions WHERE expiresAt <= ?', [Date.now()]),

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
      const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
      db.all(
        `SELECT id, originalFilename, sourceType, targetType, status, createdAt
         FROM conversion_jobs WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`,
        [userId, safeLimit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  createAuditLog: (userId, action, ipAddress) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO audit_logs (userId, action, ipAddress, createdAt) VALUES (?, ?, ?, ?)',
        [userId, action, ipAddress || null, Date.now()],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  listAuditLogs: (userId, limit = 50) => {
    return new Promise((resolve, reject) => {
      const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 200);
      db.all(
        'SELECT id, action, ipAddress, createdAt FROM audit_logs WHERE userId = ? ORDER BY createdAt DESC LIMIT ?',
        [userId, safeLimit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  // Run a set of statements inside a transaction. callback receives helpers.
  transaction: async (callback) => {
    await runAsync('BEGIN IMMEDIATE');
    try {
      const result = await callback({ runAsync, db });
      await runAsync('COMMIT');
      return result;
    } catch (error) {
      await runAsync('ROLLBACK');
      throw error;
    }
  },

  // expose raw db for tests if needed
  _db: db
};
