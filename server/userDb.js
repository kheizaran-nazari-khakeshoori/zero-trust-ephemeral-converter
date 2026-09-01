import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database stored on disk
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Create table if it doesn't exist
db.serialize(() => {
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
  }
};