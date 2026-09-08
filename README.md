# SecureConvert

SecureConvert is a small Express application for authenticated, in-memory file conversion with zero-trust handling and ephemeral RAM-only processing.

## Requirements

- Node.js 18 or newer (22 recommended)
- Python 3 for serving the plain HTML client (or any static server)
- Docker (optional, for containerized runs)

## Run locally

Copy the example env and set a strong secret:

```bash
cp server/.env.example server/.env.local
# edit server/.env.local and set JWT_SECRET to a long random value
# e.g. node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Install and start the API:

```bash
cd server
npm install
npm start
# or: JWT_SECRET=... npm start
```

In a second terminal, serve the client:

```bash
cd client
python3 -m http.server 5500
```

Open http://127.0.0.1:5500 in a browser. Register an account, add the displayed secret to an authenticator app, then complete the two login steps. Health check: http://127.0.0.1:5000/api/health

## Test & Lint

```bash
cd server
npm test          # unit + integration (auth, conversion, security)
npm run lint      # ESLint with no warnings
```

The test suite covers conversion functions, file signatures, and security edge cases.

## Configuration

All runtime knobs live in `server/config.js` and are read from the environment (dotenv supports `server/.env.local` and `server/.env`):

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | dev-only | **Required in production** — 32+ random chars |
| `PORT` / `HOST` | 5000 / 127.0.0.1 | Bind address |
| `CORS_ORIGINS` | 5500/3000 origins | Comma-separated allowed origins |
| `RATE_LIMIT_MAX` | 100 | Requests per 15 min per IP |
| `AUTH_RATE_LIMIT_MAX` | 20 | Stricter limit for /api/auth |
| `MAX_UPLOAD_SIZE` | 10485760 | Multer limit in bytes |

See `server/.env.example` for a complete template.

## Docker

```bash
docker build -t secure-convert .
docker run -p 5000:5000 --env-file server/.env.local secure-convert
# or
docker compose up --build
```

Container runs as non-root `appuser`, exposes `5000`, and has a `HEALTHCHECK` against `/api/health`.

## Supported conversions

- Text or Markdown to HTML
- Text or Markdown to PDF
- JSON records to CSV
- PNG images to WebP

Uploaded files are processed from memory and are not written to disk by the converter.

## 🌟 Features

### 🛡️ Security Architecture
- **3-Step Authentication Model:** Password (Argon2id) + TOTP (Authenticator App) + WebAuthn / Passkeys.
- **Ephemeral Processing:** Files are processed strictly in RAM buffers and streamed directly back—zero disk persistence by default.
- **Client-Side Encryption:** Optional server storage uses AES-GCM-256 client-side encryption. The server stores only encrypted blobs and never holds decryption keys.
- **Magic Byte Validation:** Strict file-type validation inspecting binary headers rather than relying on file extensions.
- **Sandboxed Execution:** Conversions execute inside isolated environments to prevent Remote Code Execution (RCE).

### ⚡ Web Capabilities
- Drag-and-drop file upload with real-time status.
- Multiple conversion pipelines (Markdown ➔ PDF, PNG ➔ WebP, JSON ➔ CSV).
- Interactive Security Dashboard for session and key management.

---

## 🏗️ Project Structure

```text
secure-convert/
├── docs/                 # Threat model and API specifications
├── client/               # Frontend UI (HTML, CSS, JavaScript)
├── server/               # Backend REST API (Node.js/Express or FastAPI)
│   ├── src/
│   │   ├── auth/         # 3FA authentication logic
│   │   ├── converters/   # Isolated conversion engines
│   │   ├── middleware/   # Security headers, rate limiters, file sanitization
│   │   └── utils/        # Crypto and buffer helpers
└── tests/                # Unit tests & security vulnerability testing