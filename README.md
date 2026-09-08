# SecureConvert

SecureConvert is a small Express application for authenticated, in-memory file conversion.

## Requirements

- Node.js 18 or newer
- Python 3 for serving the plain HTML client

## Run locally

From the repository root, install the server dependencies:

```bash
cd server
npm install
export JWT_SECRET="replace-this-with-a-long-random-secret"
npm start
```

In a second terminal, serve the client:

```bash
cd client
python3 -m http.server 5500
```

Open http://127.0.0.1:5500 in a browser. Register an account, add the displayed secret to an authenticator app, then complete the two login steps.

## Test

```bash
cd server
npm test
```

The test suite covers conversion functions, file signatures, and security edge cases.

## Configuration

Use `server/.env.example` as a reference, then export `JWT_SECRET`, `PORT`, and `HOST` in your shell before starting the server. The application reads these values from the process environment.

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