# The NUESA Library (`nuesapedia`)

Digital academic repository for the Nigerian Universities Engineering Students' Association (NUESA) — built with **Next.js 16 (App Router)**, **React 19**, **PostgreSQL (`pg`)**, and **Cloudflare R2** object storage, with offline-first **IndexedDB + Service Worker** support for campus study environments.

## Architecture Overview

- **Frontend**: Next.js 16 App Router (`app/`), Server Components on landing (`app/page.tsx`) + interactive Client Components for catalog filtering, modal PDF/YouTube viewing, and offline study packs.
- **Database**: PostgreSQL via `pg.Pool` (`lib/db/*`), canonical SQL schema in `lib/db/schema.sql`, full-text `GIN` (`tsvector`) + functional indexes, and explicit migration runner (`npm run db:migrate`).
- **Authentication & RBAC**: `scrypt` salted password hashing, HMAC-SHA256 `HttpOnly` session cookies bound to PostgreSQL `users.session_version` (enabling instant session revocation on password reset or role demotion), and single-use SHA-256-hashed 15-minute password reset tokens (`password_reset_tokens`) delivered via Resend HTTP API.
- **Object Storage**: Direct-to-Cloudflare-R2 pre-signed PUT uploads (`UPLOADING -> PENDING_REVIEW` after server-side `HeadObject` size and `%PDF-` magic-byte verification) and on-demand short-lived signed `inline`/`attachment` redirects via `/api/resources/[id]/view` and `/api/resources/[id]/download`.
- **Offline Study Vault**: IndexedDB (`lib/offline-vault.ts`) with storage quota checks (`navigator.storage.estimate()`), user-namespaced local bookmarks (`lib/saved-client.ts`), and public-only Service Worker caching (`public/sw.js`).

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and configure `DATABASE_URL`, `SESSION_SECRET`, and (optionally for cloud storage/email) `R2_*` and `RESEND_API_KEY`.
3. Run PostgreSQL schema migrations:
   ```bash
   npm run db:migrate
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Verification Scripts

```bash
npm run typecheck   # TypeScript strict check
npm run lint        # ESLint (React 19 / Next.js Core Web Vitals)
npm test            # Node 22 native TypeScript security & contract tests
npm run build       # Production Next.js build
```
