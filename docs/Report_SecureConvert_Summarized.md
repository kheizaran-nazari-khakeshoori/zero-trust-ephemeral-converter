# SecureConvert — Zero-Trust Ephemeral File Converter
### Summarized Professional Report

**Submitted to:** Prof. Armando Ruggeri  
**Student:** Kheizaran Nazari Khakeshoori — kheizarannazarikhakeshoori@gmail.com  
**Repository:** github.com/kheizaran-nazari-khakeshoori/zero-trust-ephemeral-converter  
**Date:** September 2026  
**Course:** Secure Web Systems / Database Systems

---

## 1. Executive Summary

SecureConvert is an authenticated, ephemeral file-conversion platform developed under a zero-trust principle: every uploaded file is treated as untrusted, validated by binary signatures, processed exclusively in memory (RAM), streamed back to the user, and never persisted to disk.

The system provides secure conversion across four pipelines — Markdown to HTML, Markdown to PDF, JSON to CSV, and PNG to WebP — protected by two-factor authentication (password + TOTP), hardened API controls, and a fully relational SQLite database for users, sessions, conversion history, and audit logging.

This report summarizes the problem addressed, the solution architecture, database and security design, key results, and future directions. No source code is included, in accordance with submission requirements.

---

## 2. Problem Statement

Conventional online file converters present three critical weaknesses:

1.  **Data persistence:** Uploaded files are written to temporary directories and remain recoverable after conversion, creating privacy risks for sensitive documents.
2.  **Weak type validation:** Reliance on file extensions allows an executable renamed as an image to bypass checks, exposing the server to malware and remote execution risks.
3.  **Lack of authentication and auditability:** Public endpoints without access control or logging enable abuse and provide no traceability for security review.

These issues are particularly relevant for students, research teams, and organizations handling confidential documents that must not remain on third-party infrastructure. In addition, many academic prototypes lack proper relational design, using in-memory storage without constraints, transactions, or protection against injection.

## 3. Objectives

The project was designed to achieve four objectives:

*   Deliver ephemeral file conversion without any disk persistence.
*   Enforce strict file-type validation, input sanitization, and size limits.
*   Require authenticated access for every conversion with per-user history and auditable logs.
*   Demonstrate database best practices including relational modeling, constraints, indexing, migrations, and secure querying.

## 4. System Overview and Architecture

SecureConvert follows a three-tier architecture:

**Interface Layer:** A responsive single-page client provides registration, two-step login, drag-and-drop upload, format selection, real-time upload progress, and a per-user conversion history panel. The static client is served independently from the API.

**API and Security Layer:** A Node.js/Express API handles all business logic. It applies security headers, cross-origin policies, and rate limiting. Endpoints are organized around authentication, file conversion, history retrieval, and health monitoring.

**Conversion and Persistence Layer:** File conversion is performed entirely in memory using specialized libraries for image processing and document generation. All metadata is persisted in SQLite, while file buffers are streamed directly to the client and then discarded.

**Request Flow:** The browser authenticates via a two-step process, receives a session-bound token, and submits files with a target format. The server authenticates the request, validates the file by its binary signature, performs the conversion in memory, records the job and audit entry, and returns the result as a downloadable attachment.

## 5. Database Design

The database is the core academic contribution and is implemented in SQLite with full relational integrity.

**Entity-Relationship Model:**
*   One user has many sessions
*   One user has many conversion jobs
*   One user has many audit log entries

Deletion of a user cascades to sessions and conversion jobs, while audit logs are preserved with a nullified user reference to maintain a forensic trail.

**Tables:**

*   **Users:** Stores identity, password hashes, and multi-factor secrets. Email uniqueness is enforced at the database level to prevent race conditions.
*   **Sessions:** Stores hashed session tokens with expiration timestamps, enabling secure validation without exposing bearer tokens even if the database is compromised.
*   **Conversion Jobs:** Records each conversion with original filename, detected source type, requested target type, status, and timestamp. Indexed for efficient per-user history retrieval.
*   **Audit Logs:** Records security-relevant actions such as registration, login attempts, and conversions, including client IP addresses for traceability.

**Integrity Mechanisms:**

*   Foreign keys with appropriate cascade behaviors and enforcement enabled at the database level.
*   Unique constraints on email and token hashes as invariants.
*   Indexes on email, user identifiers, and timestamps to ensure logarithmic query performance.
*   Parameterized queries throughout and whitelisting of updatable columns to prevent injection, including column-name injection.
*   Transaction support for atomic multi-step operations such as user creation.
*   Versioned migrations instead of simple table-creation checks, allowing reproducible and idempotent schema evolution.
*   Write-Ahead Logging for concurrent read and write operations.

## 6. Security Architecture

Security is applied in depth across authentication, validation, and transport:

*   **Authentication:** Passwords are hashed with bcrypt. A second factor is provided via Time-based One-Time Passwords. Login is split into two steps with a short-lived intermediate token bridging the stages. Final access is granted via a signed JSON Web Token bound to a server-side session record. Sessions are stored only as hashes.
*   **Transport and Headers:** Security headers are applied to all responses, with cross-origin access restricted to configured origins and rate limits enforced globally and more strictly on authentication endpoints.
*   **File Validation:** Validation is based on magic-byte signatures for binary formats, structural parsing for JSON, and heuristic analysis for text. Filenames are sanitized to block directory traversal and control characters. Additional guards include limits on upload size, image pixel count, JSON structure size, and document length to prevent resource exhaustion attacks.
*   **Auditability:** Every authentication and conversion action is logged with user context and IP address.

## 7. Key Features

*   Two-factor authentication with authenticator application support.
*   Magic-byte file validation that rejects extension-spoofed files.
*   Four conversion pipelines covering document and image use cases.
*   Fully in-memory processing with no temporary file creation.
*   Per-user conversion history and system-wide audit logging.
*   Responsive interface with drag-and-drop, progress indication, and user-friendly error handling.

## 8. Results and Verification

The system was verified through automated and manual testing:

*   **Automated Tests:** 15 tests covering unit and integration scenarios, including valid and invalid files, all four conversion routes, authentication flows, and security cases such as oversized uploads, binary content rejection, and cross-site scripting protection.
*   **Quality Checks:** Zero lint errors and zero reported vulnerabilities in dependency audit.
*   **Performance:** On local hardware, image and document conversions complete in milliseconds, with full API round-trips remaining under one second, demonstrating that in-memory processing avoids the overhead of disk I/O and external workers.
*   **Security Validation:** Malicious files with falsified extensions are correctly rejected, and injection attempts against authentication are blocked by input validation and parameterized queries.

## 9. Engineering Decisions

Three key decisions define the project:

*   **SQLite with Migrations:** Selected to satisfy the database-focused requirements while providing zero-infrastructure persistence, relational integrity, and demonstrable query planning, in contrast to transient in-memory maps.
*   **Express with Hardening Middleware:** Chosen for its maturity and compatibility with security middleware for headers and rate limiting, meeting requirements with minimal architectural change.
*   **Memory-Only Conversion:** Adopted to fulfill the ephemeral processing requirement, with pixel and size caps to mitigate decompression attacks and streaming to avoid temporary files.

## 10. Challenges and Lessons Learned

*   Ensuring reliable local development across operating systems required replacing a platform-dependent auto-open feature with a cross-platform solution.
*   Resolving dependency vulnerabilities required explicit version overrides to achieve a clean audit.
*   Managing write-ahead log artifacts required proper file handling to prevent database corruption after migrations.

Key lessons include the importance of validating both values and column identifiers, hashing tokens before storage, applying stricter rate limits to authentication, and accounting for time drift in one-time password verification.

## 11. Future Improvements

*   Addition of passkey/WebAuthn support as a third authentication factor.
*   Optional client-side encryption for sensitive workflows.
*   Pagination and search capabilities for history and audit views.
*   Per-user rate limiting and a dedicated audit retrieval endpoint.
*   Continuous integration pipeline for automated testing, linting, and auditing.

## 12. Conclusion

SecureConvert demonstrates that a small-scale web application can achieve strong security and sound database engineering without sacrificing usability. By combining zero-trust file handling, ephemeral in-memory conversion, two-factor authentication, and a properly normalized relational schema, the project provides a practical example of secure engineering principles applicable to modern web systems. The implementation is complete, tested, and ready for demonstration and further extension.

---

**Author:** Kheizaran Nazari Khakeshoori  
**GitHub:** github.com/kheizaran-nazari-khakeshoori  
**LinkedIn:** linkedin.com/in/kheizaran-nazari-khakeshoori

*Disclaimer: This is an educational portfolio project.*

**Appendix Reference:** Detailed database schema, entity-relationship diagram, and data definition are available in `docs/db-schema.md` and `docs/schema.html` for presentation purposes.
