# The NUESA Library (NUESApedia)

[![Next.js](https://img.shields.io/badge/Next.js-16.3.5-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2_Storage-F38020?style=flat-square&logo=cloudflare)](https://www.cloudflare.com/products/r2/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg?style=flat-square)](LICENSE)

**The NUESA Library** is a digital academic repository and curriculum portal built for the **Nigerian Universities Engineering Students' Association (NUESA)** at the **Faculty of Engineering, Federal University Oye-Ekiti (FUOYE)**.

It provides a centralized platform for undergraduate engineering students to access verified lecture notes, exam past questions, laboratory manuals, textbooks, and curated YouTube video walkthroughs—complete with offline-first study capabilities designed for campus network environments.

---

## Key Features

- **Academic Resource Vault:** Filterable and searchable catalog across all 5 engineering departments (Civil, Mechanical, Materials & Metallurgical, Agric & Bio-Resources, Mining) spanning 100L through 500L levels.
- **Embedded Document & Video Viewer:** In-browser distraction-free study viewer for multi-page PDFs and curriculum-mapped YouTube tutorial playlists.
- **Offline Study Vault (PWA):** Zero-data study capability powered by browser IndexedDB and Service Workers (`sw.js`). Students can download textbooks and lecture notes to their device vault for study sessions without active internet connection.
- **Peer-Reviewed Contribution Studio:** Students can contribute materials directly to Cloudflare R2 via pre-signed, direct-to-storage PUT uploads, with server-side size checks and `%PDF-` signature verification.
- **Faculty Moderation Portal:** Comprehensive review queue (`/moderation`) allowing student leaders and faculty moderators to inspect, approve, or reject submissions with detailed review feedback.
- **Smart Course Search & Autocomplete:** Real-time course code lookup matching both canonical curriculum registry codes (`CVE 201`, `MEE 301`) and user-uploaded course titles.
- **Privacy on Shared PCs:** Designed specifically for university library terminals and cybercafés—logging out purges session cookies, local storage bookmarks, and IndexedDB offline document blobs.

---

## Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────┐
│                   Next.js 16 Client                    │
│   (React 19, Tailwind v4, Lucide, PWA Service Worker)  │
└───────────────────────────┬────────────────────────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────┐
│     Next.js App Router       │  │   Offline Storage    │
│  - Server Components (RSC)   │  │   - IndexedDB Vault  │
│  - API Handlers (/api/*)     │  │   - LocalStorage     │
│  - React cache() Memoization │  │   - CacheStorage     │
└──────────────┬───────────────┘  └──────────────────────┘
               │
        ┌──────┴──────────────────────┐
        ▼                             ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│  PostgreSQL Database     │   │  Cloudflare R2 Storage   │
│  - pg.Pool connection    │   │  - S3-compatible bucket  │
│  - Full-text tsvector GIN│   │  - Direct browser upload │
│  - Session versioning    │   │  - Short-lived signed URL│
│  - Rate limit tracking   │   │  - Zero egress fees      │
└──────────────────────────┘   └──────────────────────────┘
```

| Component | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Server components, edge routing, API routes |
| **UI Library** | React 19 & Tailwind CSS v4 | Interactive UI with zero-runtime utility styling |
| **Database** | PostgreSQL (`pg`) | Canonical relational storage, full-text search, audit records |
| **Object Storage** | Cloudflare R2 (`@aws-sdk/client-s3`) | Zero-egress PDF and curriculum document storage |
| **Authentication** | Custom HMAC-SHA256 & `scrypt` | Stateless cookie tokens with instant database session revocation |
| **Offline Engine** | IndexedDB & Service Worker v6 | Client-side blob storage and static asset caching |
| **Email Service** | Resend HTTP API | Password reset token delivery |

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or `v22.x` LTS
- **npm**: `v10+`
- **PostgreSQL**: `v14+` (Optional for local dev; built-in in-memory fallback available)

### Quickstart

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nuesa-fuoye/nuesapedia.git
   cd nuesapedia
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env
   ```
   *Note: In local development, you can leave `DATABASE_URL=""` to run in zero-dependency in-memory mode.*

4. **Run Database Migrations (PostgreSQL mode):**
   ```bash
   npm run db:migrate
   ```

5. **Start Dev Server:**
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description | Default |
|---|---|---|---|
| `DATABASE_URL` | Production | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) | `""` (In-memory dev mode) |
| `SESSION_SECRET` | Production | High-entropy secret key (min 32 chars) for signing session cookies | Fallback dev secret |
| `NEXT_PUBLIC_APP_URL` | Production | Public domain URL for generating password reset links | `http://localhost:3000` |
| `ADMIN_EMAILS` | Optional | Comma-separated emails automatically assigned `ADMIN` role | `admin@fuoye.edu.ng` |
| `R2_ACCOUNT_ID` | Production | Cloudflare R2 Account ID | `""` (Mock storage dev mode) |
| `R2_ACCESS_KEY_ID` | Production | Cloudflare R2 Access Key ID | `""` |
| `R2_SECRET_ACCESS_KEY` | Production | Cloudflare R2 Secret Access Key | `""` |
| `R2_BUCKET_NAME` | Production | Cloudflare R2 Bucket Name | `nuesapedia-storage` |
| `R2_PUBLIC_URL` | Optional | Public CDN URL (leave empty to enforce signed 15-min URLs) | `""` |
| `RESEND_API_KEY` | Optional | Resend API key for transactional reset emails | `""` |
| `EMAIL_FROM` | Optional | Sender email address for outbound emails | `noreply@nuesapedia.fuoye.edu.ng` |
| `SKIP_SCHEMA_ENSURE` | Production | Skips runtime `CREATE TABLE IF NOT EXISTS` checks | `false` |

---

## Security Architecture

- **Session Invalidation:** User sessions are cryptographically signed with HMAC-SHA256 and bound to `users.session_version`. Any password update or role change bumps this integer, immediately invalidating all active cookies across devices.
- **Request Memoization:** `getSession()` is wrapped in React's `cache()` to prevent duplicate database lookups during server render passes.
- **Spoof-Resistant Rate Limiting:** `getClientIp()` prioritizes edge platform headers (`cf-connecting-ip`, `x-vercel-forwarded-for`) and strictly validates IPv4/IPv6 structure before evaluating fallback proxy headers.
- **Secure File Ingestion:** Browser clients upload directly to R2 using short-lived pre-signed PUT URLs. Before materials are queued for review, the server executes a `HeadObject` check and reads the first 5 bytes (`Range: bytes=0-4`) to verify the `%PDF-` magic header.
- **Soft-Delete on Moderation:** Rejection records moderator feedback and marks submissions as `REJECTED` while preserving storage keys for audit and review, preventing accidental permanent data loss.

---

## Development & Testing Scripts

```bash
# Start local development server
npm run dev

# Run TypeScript typecheck with Next.js typegen
npm run typecheck

# Run ESLint across App Router and components
npm run lint

# Execute native Node.js security & contract tests
npm test

# Apply canonical PostgreSQL schema migrations
npm run db:migrate

# Build production Next.js application
npm run build
```

---

## Project Structure

```
├── app/                        # Next.js 16 App Router
│   ├── api/                    # REST API routes (Auth, Uploads, Resources, Moderation)
│   ├── resources/              # Academic resource library & search catalog
│   ├── saved/                  # Bookmarks and offline storage vault
│   ├── profile/                # User dashboard & contribution studio
│   ├── moderation/             # Review queue and user management portal
│   ├── login/ & signup/        # Authentication pages
│   └── page.tsx                # Public homepage and department browser
├── components/                 # React UI components
├── context/                    # AuthContext & SavedResourcesContext
├── lib/                        # Server utilities, S3 client, rate limiter, auth
│   └── db/                     # Database access layer, schema.sql, queries
├── public/                     # Static icons, manifest, service worker (sw.js)
├── scripts/                    # Migration runners & TypeScript test loaders
└── tests/                      # Automated contract and security test suite
```

---

## Team & Contributing

Internal contributions from authorized team members, NUESA executives, and faculty coordinators are managed via:

- [Contributing Guidelines](CONTRIBUTING.md) — Internal pull request workflow, code standards, and course material curation.
- [Code of Conduct](CODE_OF_CONDUCT.md) — Community pledge and academic integrity standards.
- [Security Policy](SECURITY.md) — Responsible disclosure process for security vulnerabilities.

---

## License

Proprietary and Confidential — All Rights Reserved.

Copyright (c) 2026 Nigerian Universities Engineering Students' Association (NUESA), Faculty of Engineering, Federal University Oye-Ekiti (FUOYE).

Unauthorized copying, distribution, modification, or public display of this software and source code, via any medium, is strictly prohibited. See [LICENSE](LICENSE) for full details.
