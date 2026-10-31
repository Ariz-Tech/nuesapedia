# NUESApedia Architecture & Engineering Plan

## Current Production Stack

1. **Application Framework**: Next.js 16 (App Router) + React 19 + TypeScript (`strict: true`).
2. **Database Layer**: PostgreSQL via `pg` (`lib/db/*`), schema managed in `lib/db/schema.sql` and applied via `npm run db:migrate` (`scripts/migrate.mjs`).
   - Full-text search via PostgreSQL `to_tsvector` + `GIN` index (`idx_submissions_fts`).
   - Case-insensitive department and course lookups via expression B-tree indexes.
   - Distributed serverless rate limiting via atomic `INSERT ... ON CONFLICT` on `rate_limits`.
3. **Authentication & Session Security**:
   - `scrypt` password hashing with 16-byte random salt and `crypto.timingSafeEqual`.
   - `HttpOnly`, `SameSite=Lax` HMAC-SHA256 cookies verified against `users.session_version` on every authenticated request.
   - Single-use 15-minute SHA-256-hashed password reset tokens (`password_reset_tokens`) delivered via Resend (`lib/email.ts`).
4. **Storage & Upload Pipeline**:
   - Direct browser-to-Cloudflare-R2 uploads via pre-signed `PUT` URLs (`lib/r2.ts`).
   - Two-phase upload state (`UPLOADING -> PENDING_REVIEW`) gated by server-side `HeadObject` byte length (`<= 30MB`) and `%PDF-` file signature verification.
   - Zero persisted expiring URLs: database rows store `r2_key` and serve fresh short-lived signed `inline`/`attachment` redirects via `/api/resources/:id/view` and `/api/resources/:id/download`.
5. **Offline-First Campus Study**:
   - Quota-aware IndexedDB PDF vault (`lib/offline-vault.ts`).
   - User-ID-namespaced local bookmark storage (`lib/saved-client.ts`) + full cache purge on logout to protect shared library computers.
   - Public-catalog-only Service Worker (`public/sw.js`).

## Future Optional Enhancements
- **In-Canvas Mobile PDF Renderer**: Optional lazy-loaded `pdfjs-dist` page renderer for inline page-by-page annotations.
- **Normalized Curriculum Admin UI**: Dedicated faculty curriculum table editor for bulk course imports.
- **AI Study Companion**: Optional RAG summarization/quiz routes once faculty LLM budgets and vector indexing are provisioned.
