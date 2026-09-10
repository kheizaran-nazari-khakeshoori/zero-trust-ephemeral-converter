# SecureConvert — Zero-Trust Ephemeral File Converter

*Authenticated, RAM-only file conversion with magic-byte validation, 2FA and auditable SQLite history.*

***Portfolio Project** — Demonstrates secure file handling, relational database design, Express hardening, and ephemeral processing.*

![Build](https://img.shields.io/badge/build-passing-brightgreen) ![Node](https://img.shields.io/badge/node-22.x-blue) ![Tests](https://img.shields.io/badge/tests-15%20passing-success) ![Audit](https://img.shields.io/badge/audit-0%20vulns-blue)

<p align="center">
  <img src="assets/Screenshot%20From%202026-09-09%2019-38-00.png" width="48%" alt="Login and 2FA" />
  <img src="assets/Screenshot%20From%202026-09-09%2019-38-10.png" width="48%" alt="Converter dashboard" />
</p>

<p align="center">
  <img src="assets/Screenshot%20From%202026-09-09%2019-41-44.png" width="68%" alt="DB schema GUI" />
</p>

## Table of Contents
- [System Demonstration](#system-demonstration)
- [Why This Project Matters](#why-this-project-matters)
- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution Approach](#solution-approach)
- [Demo](#demo)
- [Features](#features)
- [Results & Metrics](#results--metrics)
- [Architecture](#architecture)
- [Engineering Decisions](#engineering-decisions)
- [Challenges & Lessons Learned](#challenges--lessons-learned)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Testing & Verification](#testing--verification)
- [Future Improvements](#future-improvements)
- [Author](#author)

---

## System Demonstration

### System Workflow

```
[Browser / Client] 
      │
      ▼
[Express API + Helmet + CORS + RateLimit]  (server/server.js)
      │
      ├──► [Auth Layer]  password (bcrypt) + TOTP (speakeasy) → JWT + sessions
      ├──► [Validation]  magic bytes (PNG/JSON/txt) + filename + targetFormat
      └──► [Conversion]  md→HTML / md→PDF (pdfkit) / JSON→CSV / PNG→WebP (sharp)
      │
      ▼
[SQLite — users / sessions / conversion_jobs / audit_logs]  (server/userDb.js)
      │
      ▼
[Streamed Blob Download + History]
```

### Agent / System Execution Demo

*Example execution — register → 2FA → convert*

```bash
curl -s http://127.0.0.1:5000/api/auth/register -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"correct horse battery staple"}'
# -> {mfaSecret:"JBSWY3DPEHPK3PXP", otpauthUrl:"otpauth://..."}
# add to Google Authenticator, then:
curl -s http://127.0.0.1:5000/api/auth/login-step1 -d '{"email":"ada@example.com","password":"..."}'
curl -s http://127.0.0.1:5000/api/auth/login-step2 -d '{"email":"ada@example.com","tempToken":"...","totpCode":"123456"}'
# -> {accessToken:"eyJ..."}
curl -H "Authorization: Bearer eyJ..." -F file=@demo-files/sample.md -F targetFormat=pdf http://127.0.0.1:5000/api/convert --output out.pdf
```

### Example Output
```
🔒 SecureConvert Server running on http://127.0.0.1:5000
Processing sample.md (txt) -> pdf for user 4
File converted and downloaded successfully!  (client/app.js history refresh)
```

### Highlights
- **Zero-disk conversion** — `multer.memoryStorage()` + streaming, no `uploads/` persistence
- **DB-backed auth & audit** — hashed JWT sessions, 4-table relational design, migrations
- **Strict validation** — magic bytes, path-traversal and TOTP regex, size/pixel caps
- **Sub-second pipelines** — sharp/pdfkit in-process, no worker fork
- **Progress & history** — XHR upload progress, per-user `conversion_jobs` panel
- **Hardened & tested** — Helmet, CORS, rate-limit, 15 integration tests, `npm audit` 0

### Built With
`Node.js 22` • `Express 4` • `SQLite3` • `Sharp` • `PDFKit` • `Speakeasy TOTP` • `JWT + bcryptjs` • `Helmet + express-rate-limit + multer`

---

## Why This Project Matters

Most online converters store uploads on disk, trust file extensions, and skip authentication — leaving data at rest and open to RCE or exfiltration.

SecureConvert explores the opposite: **treat every file as untrusted**, never persist it, require 2FA, and keep a relational audit trail. It showcases concepts relevant to modern secure engineering:

- Zero-trust file handling + magic-byte validation
- Session-bound JWT with hashed storage
- Relational design, migrations, indexing and transactions
- Rate limiting, security headers and ephemeral processing

---

## Overview

SecureConvert is an authenticated web converter. A single HTML client (`client/index.html`) talks to an Express API (`server/server.js`) that validates files by binary signatures, converts in RAM (Markdown→HTML/PDF, JSON→CSV, PNG→WebP), streams the result back, and logs the job to SQLite. Full flow is in `docs/db-schema.md` and visual `docs/schema.html`.

---

## Problem Statement

Who is affected: students, teams, or anyone handling sensitive docs that shouldn't linger on a server.

Traditional converters suffer from:

- **Disk persistence** — files remain in `/tmp`/`uploads`, recoverable
- **Weak type checks** — extension only, `.exe` renamed to `.png` passes
- **No auth / no audit** — anyone can abuse the endpoint, no history
- **SQL injection & no transactions** — string-interpolated queries, half-written users

These matter because they leak data, enable abuse, and earn poor DB grades.

---

## Solution Approach

The system has three layers; detailed flow is in [Architecture](#architecture) to avoid duplication.

**1. Interface / API Layer** — `server/server.js`, `client/app.js`
- Serves static client on `:5500` (via `client/package.json: dev-serve.js` with auto-open), API on `:5000`
- Helmet, CORS (`config.js: CORS_ORIGINS`), global + auth-specific rate limits, `GET /api/health`

**2. Auth & Validation Layer** — `server/authRoutes.js`, `server/authMiddleware.js`, `server/fileValidator.js`, `server/inputValidation.js`
- Register: `bcrypt(12)` → `users` + `mfaSecret`; Login step1: `tempToken` in `step3Token`; Step2: `speakeasy.totp.verify` → JWT `jti` + `sessions(tokenHash=SHA256)`
- Validation: magic bytes for PNG/JPG/PDF, JSON parse, text heuristic; blocks `..`, `/`, control chars; email/TOTP regex

**3. Conversion & Persistence Layer** — `server/converter.js`, `server/userDb.js`
- In-memory converters (sharp `limitInputPixels:25M`, pdfkit stream, JSON header discovery)
- SQLite `users ||--o{ sessions / conversion_jobs / audit_logs`, FK `ON DELETE CASCADE/SET NULL`, indexes, `PRAGMA WAL`, versioned `MIGRATIONS`, `transaction()` for atomic register

---

## Demo

### Running the Application

```bash
cp server/.env.example server/.env.local
# edit JWT_SECRET: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# terminal 1 — api
cd server && npm install && npm start
# -> 🔒 SecureConvert Server running on http://127.0.0.1:5000

# terminal 2 — client (auto-opens browser)
cd client && npm install && npm run dev
# -> http://127.0.0.1:5500
# fallback: cd client && python3 -m http.server 5500
```

### Direct Tool / API Usage

```bash
# health
curl http://127.0.0.1:5000/api/health

# register + 2FA + convert (see System Demonstration above)
curl -H "Authorization: Bearer <token>" -F file=@demo-files/data.json -F targetFormat=csv http://127.0.0.1:5000/api/convert -o out.csv

# history
curl -H "Authorization: Bearer <token>" http://127.0.0.1:5000/api/history
```

### Configuration / Integration

```bash
cp server/.env.example server/.env.local  # then edit
```

Env vars (see `server/config.js`): `JWT_SECRET` (32+ chars, required prod), `PORT/HOST`, `CORS_ORIGINS` (comma list), `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`, `MAX_UPLOAD_SIZE`.

For frontend, override API via `<meta name="api-base" content="http://...">` or `localStorage.setItem('apiBase','...')`.

### Example Output

`File converted and downloaded successfully!` + `Recent conversions` shows `sample.md | txt → pdf | 2026-09-09`.

---

## Features
- 🔐 **2FA (password + TOTP)** with `otpauthUrl` for Google Authenticator
- 🛡️ **Magic-byte validation** (PNG `89 50 4E 47`, JSON parse, text heuristic)
- ⚡ **4 pipelines:** Markdown→HTML, Markdown→PDF, JSON→CSV, PNG→WebP
- 💾 **SQLite history & audit:** `conversion_jobs` + `audit_logs` per user
- 📊 **DB design:** 4 tables, FKs, UNIQUE, indexes, migrations, transactions, parameterized queries
- 🎯 **Frontend:** drag & drop, upload progress, logout, responsive, XSS-safe `innerText`

---

## Results & Metrics

*Dataset:* seeded `server/seed.js` — 3 demo users × 7 jobs (txt→html/pdf, json→csv, png→webp) + `demo-files/sample.md|data.json`.

- **Tests:** `15` passing — unit (`converter`, `fileValidator`) + integration (`auth`, `conversion`, `security`: oversize 413, binary 400, XSS escaping) — `server/*.test.js`
- **Lint:** `0` errors (`eslint.config.js` ignores `_next`)
- **Audit:** `0` vulnerabilities (`npm audit` after `qs` override `6.16.0`)
- **Latency (local):** `md→pdf` ~25ms, `PNG→WebP` ~11ms (2×2 red), full conversion routes <1.1s integration
- **Security:** extension-spoof `.exe` rejected via magic bytes; `email' OR 1=1` blocked by `validateEmail` + `?` params

Interpretation: SQLite WAL + indexes make `WHERE userId=? ORDER BY createdAt DESC LIMIT 20` logarithmic; hashing `tokenHash` contains DB leak impact.

---

## Architecture

**High-Level:** Browser (static) → Express API (auth → validate → convert) → SQLite (relational). All conversions stay in `Buffer` → `res.send(Buffer)` with `Content-Disposition: attachment`.

**System Data Flow**

```
┌───────────────────┐
│   Browser Input   │  email/password + TOTP + file + targetFormat
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Express / Helmet │  json limit 100kb, CORS, rateLimit
└─────────┬─────────┘
          │
    ┌─────┼─────┐
    ▼     ▼     ▼
 [Auth][Valid][Convert]
    │     │     │
    ▼     ▼     ▼
 [JWT] [Magic][Sharp/PDFKit/CSV]
    │     │     │
    └─────┼─────┘
          ▼
┌───────────────────┐
│  SQLite + Audit   │  users/sessions/jobs/logs
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Streamed Download │  + GET /api/history
└───────────────────┘
```

**Component Details**

***Core API & Conversion Layer***
**Location:** `server/server.js`, `server/converter.js`
**Responsibilities:**
- Route `/api/convert` + `/api/history` + `/api/health` + `/api/auth`
- In-memory converters, error mapping (413, 400, 500)

***Auth & DB Layer***
**Location:** `server/authRoutes.js`, `server/authMiddleware.js`, `server/userDb.js`
**Responsibilities:**
- 2FA flow, JWT `jti`, `findSession` check, `createAuditLog`, `transaction`

***Technical Highlights***
- `multer.memoryStorage()` — zero disk, `sharp({failOnError:true})`, `limitInputPixels`
- `PRAGMA foreign_keys=ON` + `WAL` + `user_version` migrations
- Hashed sessions (`SHA256(token)`) — stolen DB ≠ bearer token

---

## Engineering Decisions

<details><summary><strong>Why SQLite + migrations? (not in-memory Map)</strong></summary>

Required by brief (`text.md:36` tables). `Map` lost data on restart and had no FK/UNIQUE/index. SQLite gives persistence, `1—∞` relations, and demo-able `EXPLAIN QUERY PLAN`. Migrations (`userDb.js:10`) avoid `CREATE TABLE IF NOT EXISTS` drift.
**Benefits:** zero infra, single `database.sqlite` file, WAL concurrency, printable `docs/db-schema.md`.
</details>

<details><summary><strong>Why Express + Helmet + express-rate-limit?</strong></summary>

Already in project, battle-tested. Helmet adds CSP/HSTS/X-Frame, rate-limit throttles brute force (global 100, auth 20). Alternatives like Fastify similar but Express matches `server/package.json` and `server/server.js:32`.
**Chosen for:** minimal change, `helmet({contentSecurityPolicy:false})` to keep client simple.
</details>

<details><summary><strong>Why memory-only + Sharp/PDFKit?</strong></summary>

Brief demands ephemeral processing. Sharp handles `limitInputPixels` to stop decompression bombs; PDFKit streams without temp files. Multer limits `fileSize: MAX_UPLOAD_SIZE`, `files:1, parts:3`.
**Chosen for:** satisfies zero-disk, measurable latency, easy test with `Buffer`.
</details>

---

## Challenges & Lessons Learned

**Challenge 1: `serve -o` broke on 14.x** (`ArgError: unknown option: -o`)
**Solution:** replaced `serve . -l 5500 -o` with `client/dev-serve.js` that spawns `serve` and does `xdg-open/open` cross-platform; added `dev:python` fallback.
**Result:** `npm run dev --prefix client` reliably auto-opens `http://127.0.0.1:5500` on Fedora/macOS/Windows.

**Challenge 2: `qs` audit 2 moderate (Express 4.22.2)**
**Solution:** `server/package.json:25` `overrides: {qs:"6.16.0"}` + `npm install`.
**Result:** `npm audit` → `0` vulnerabilities, `body-parser` deduped.

**Challenge 3: `SQLITE_CORRUPT` after WAL migration**
**Solution:** WAL leaves `-shm/-wal`; added `database.sqlite-shm|wal` to ignores, `rm -f server/database.sqlite*` + `npm run seed` reseeds.
**Result:** clean `PRAGMA journal_mode=WAL` with grouped `MIGRATIONS`.

**Lessons Learned**
- Parameterize *column names* too — whitelisted `ALLOWED_USER_COLUMNS` in `updateUser`
- Rate-limit auth separately; TOTP `window:1` tolerates clock drift
- Hash JWT before storing; verify `jti + userId` in middleware
- Keep `dev-serve.js` for `serve` upgrades

---

## Repository Structure

```
.
├── assets/                     # screenshots for README
│   ├── Screenshot From 2026-09-09 19-38-00.png
│   └── ...
├── client/
│   ├── index.html              # SPA, Mermaid not needed
│   ├── app.js                  # auth + drag&drop + XHR progress + history
│   ├── package.json            # serve + dev-serve.js
│   ├── dev-serve.js            # serve + auto-open (fixed -o)
│   └── dev-open.js             # python http.server + auto-open
├── server/
│   ├── server.js               # Express, helmet, cors, limits, /api/*, health, 404
│   ├── config.js               # dotenv, JWT_SECRET guard, CORS, limits
│   ├── userDb.js               # SQLite + migrations + audit_logs + indexes + transaction
│   ├── authRoutes.js           # register / login-step1 / login-step2
│   ├── authMiddleware.js       # requireAuth (jti+userId)
│   ├── converter.js            # md→html/pdf, png→webp, json→csv
│   ├── fileValidator.js        # magic bytes
│   ├── inputValidation.js      # filename/email/TOTP
│   ├── seed.js                 # npm run seed (no sqlite3 CLI)
│   ├── eslint.config.js
│   └── package.json            # qs override
├── docs/
│   ├── db-schema.md            # ER + DDL + 5 queries
│   ├── schema.html             # printable light GUI (xdg-open)
│   ├── Report_SecureConvert.md
│   └── Report_SecureConvert_Armando_Ruggeri.pdf
├── demo-files/                 # sample.md, data.json, test.exe (rejected)
└── README.md
```

---

## Getting Started

**Clone**

```bash
git clone https://github.com/kheizaran-nazari-khakeshoori/zero-trust-ephemeral-converter.git
cd zero-trust-ephemeral-converter
```

**Requirements**

- Node 22 (or 18+), Python 3 (fallback static serve), or just Node (serve)

**Configuration**

```bash
cp server/.env.example server/.env.local
# edit: JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
```

**Run**

```bash
# api
cd server && npm install && npm start
# client (auto-opens)
cd ../client && npm install && npm run dev
# open: http://127.0.0.1:5500
```

**DB seed (no sqlite3 binary needed):**
```bash
npm run seed --prefix server
npm run db:inspect --prefix server
xdg-open docs/schema.html
```

---

## Testing & Verification

**Automated Testing**

```bash
cd server
npm test          # NODE_ENV=test node --test (15 tests)
# - converter.test.js: XSS escape, PDF header %PDF-, WebP RIFF, CSV headers
# - fileValidator.test.js: PNG, JSON, binary reject
# - auth.integration.test.js: register + 2 steps + bad password
# - conversion.integration.test.js: 4 routes + unsupported format
# - security.integration.test.js: oversize 413, binary 400, XSS
```

**Manual Verification**

```bash
# bad type
echo -e "\x00\x01\x02" | curl -H "Authorization: Bearer $TOKEN" -F file=@- -F targetFormat=html http://127.0.0.1:5000/api/convert
# injection attempt (blocked)
curl -X POST http://127.0.0.1:5000/api/auth/register -d '{"email":"a@b.com'\'' OR 1=1--","password":"12345678"}' -H "Content-Type: application/json"
```

**Expected Outcome**
- All 15 tests pass, lint 0, health `{"status":"ok"}`
- Conversion returns blob with `Content-Disposition: attachment`
- History shows `sourceType → targetType` + timestamp

---

## Future Improvements
- WebAuthn/Passkeys as 3rd factor (README claims but not yet)
- Client-side AES-GCM encrypted storage option
- Pagination + search on `/api/history` and `audit_logs`
- Per-user rate limit + `GET /api/audit`
- GitHub Actions CI (test + lint + audit)

---

## Author

**Kheizaran Nazari Khakeshoori**
**GitHub:** https://github.com/kheizaran-nazari-khakeshoori
**LinkedIn:** https://www.linkedin.com/in/kheizaran-nazari-khakeshoori
**Email:** kheizarannazarikhakeshoori@gmail.com

*Disclaimer: Educational/portfolio project, MIT License.*

