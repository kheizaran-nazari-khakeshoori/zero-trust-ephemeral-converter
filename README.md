# SecureConvert 🔒

> A Zero-Knowledge, Ephemeral File Conversion Platform built for Web Programming & Security.

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