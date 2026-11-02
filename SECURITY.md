# Security Policy

## Supported Versions

Security updates are actively applied to the main development branch.

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

We take the security of NUESApedia and student academic data seriously. If you discover a vulnerability or security flaw, please do not disclose it publicly via GitHub issues.

### Reporting Process

1. Email your findings directly to the maintainers or faculty IT coordinators at [security@nuesapedia.fuoye.edu.ng](mailto:security@nuesapedia.fuoye.edu.ng) (or open a private GitHub Security Advisory).
2. Include detailed information to help reproduce the issue:
   - Type of vulnerability (e.g., authentication bypass, SQL injection, R2 bucket permission leak, rate limit bypass)
   - Step-by-step instructions or proof-of-concept (PoC)
   - Affected endpoints or files
   - Potential impact
3. You will receive an acknowledgment within 48 hours.
4. We will coordinate a timeline for patching and disclosure.

## Security Practices in NUESApedia

- **Session Security:** Cryptographic `HttpOnly`, `SameSite=Lax` HMAC-SHA256 session tokens bound to database `session_version` with immediate revocation.
- **Password Storage:** Salted `scrypt` hashing with constant-time equality checks.
- **Storage Protection:** Cloudflare R2 files are stored with unguessable hashed keys and accessed via short-lived, pre-signed 15-minute URLs. Uploads undergo server-side size verification and `%PDF-` magic-byte checks.
- **Rate Limiting:** IP and account-level sliding window rate limits backed by PostgreSQL with spoofing-resistant client IP extraction.
- **Shared Device Privacy:** PWA Service Worker caches strictly public catalog queries; logging out purges session cookies, local storage bookmarks, and IndexedDB offline document blobs.

