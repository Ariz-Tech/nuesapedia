# Contributing to The NUESA Library (NUESApedia)

Thank you for your interest in contributing to **The NUESA Library**! This platform provides a centralized, peer-reviewed academic repository for engineering students at the Faculty of Engineering, Federal University Oye-Ekiti (FUOYE).

Whether you are improving the web application, writing documentation, fixing bugs, or submitting engineering course materials, your contributions are welcome.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Ways to Contribute](#ways-to-contribute)
3. [Local Development Setup](#local-development-setup)
4. [Project Structure](#project-structure)
5. [Development Guidelines](#development-guidelines)
   - [TypeScript & Type Safety](#typescript--type-safety)
   - [Next.js & React 19 Architecture](#nextjs--react-19-architecture)
   - [Database & Storage Guidelines](#database--storage-guidelines)
   - [Security & Authentication](#security--authentication)
6. [Academic Material Submission Guidelines](#academic-material-submission-guidelines)
7. [Submitting a Pull Request](#submitting-a-pull-request)
8. [Commit Message Conventions](#commit-message-conventions)

---

## Code of Conduct

All contributors are expected to uphold the [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to [dean-engineering@fuoye.edu.ng](mailto:dean-engineering@fuoye.edu.ng).

---

## Ways to Contribute

- **Code:** Build new features, optimize performance, refactor client monoliths into modular Server Components, or fix bugs.
- **Academic Content:** Submit peer-reviewed lecture notes, exam past questions, textbooks, and curated YouTube video walkthroughs directly via the web portal (`/profile` -> Contribution Studio).
- **Curriculum & Metadata:** Expand the official course registry in `lib/courses.ts` or departmental records in `lib/departments.ts`.
- **Testing:** Add integration and component tests to expand coverage beyond unit contract tests.
- **Documentation:** Improve setup guides, architectural diagrams, API documentation, or inline code comments.

---

## Local Development Setup

### Prerequisites

- **Node.js**: v20.x or v22.x LTS
- **npm**: v10+
- **PostgreSQL**: v14+ (optional for local mock mode; required for full database features)
- **Git**

### Step-by-Step Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nuesa-fuoye/nuesapedia.git
   cd nuesapedia
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   - For **zero-dependency local development**, leave `DATABASE_URL=""`. The platform automatically boots in isolated in-memory mode.
   - For **real database testing**, set `DATABASE_URL` to a running PostgreSQL instance (e.g. `postgresql://postgres:postgres@localhost:5432/nuesapedia`).

4. **Apply database schema (if using PostgreSQL):**
   ```bash
   npm run db:migrate
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
nuesapedia/
├── app/                        # Next.js 16 App Router
│   ├── api/                    # API Route Handlers (Auth, Uploads, Resources, Moderation)
│   ├── resources/              # Academic resource vault & search catalog
│   ├── saved/                  # Saved bookmarks & offline download vault
│   ├── profile/                # User account settings & contribution studio
│   ├── moderation/             # Faculty moderation portal & review queue
│   ├── login/ & signup/        # Authentication pages
│   ├── layout.tsx              # Root HTML shell, fonts, global providers
│   └── page.tsx                # Dynamic landing page & feature showcases
├── components/                 # Reusable UI components
│   ├── Navbar.tsx              # Navigation header with autocomplete search
│   ├── Footer.tsx              # Site footer
│   ├── ResourceViewerModal.tsx # PDF & YouTube inline study modal
│   ├── ResourceUploadPortal.tsx# Drag-and-drop file uploader & YouTube submitter
│   └── ...                     # Landing page sections & UI icons
├── context/                    # React Context providers (AuthContext, SavedResourcesContext)
├── lib/                        # Business logic & utilities
│   ├── auth.ts                 # scrypt hashing, session HMAC tokens, RBAC verification
│   ├── api-helpers.ts          # Standardized API response payloads & validators
│   ├── courses.ts              # Canonical engineering course registry (FUOYE)
│   ├── departments.ts          # Department registry & slug resolver
│   ├── r2.ts                   # Cloudflare R2 / S3 client & pre-signed URL generator
│   ├── rate-limit.ts           # PostgreSQL & memory-backed rate limiter
│   ├── saved-client.ts         # User-scoped localStorage bookmarks
│   ├── offline-vault.ts        # IndexedDB storage for offline reading & study packs
│   └── db/                     # Database access layer
│       ├── pool.ts             # pg.Pool connection lifecycle & dev mock store
│       ├── schema.sql          # Canonical PostgreSQL schema & indexes
│       ├── submissions.ts      # Resource upload queries & full-text search
│       ├── users.ts            # User accounts & session versioning
│       └── saved.ts            # Saved resource queries
├── public/                     # Static assets, PWA icons, manifest, sw.js
├── scripts/                    # Migration runners & test loaders
└── tests/                      # Automated security & contract test suites
```

---

## Development Guidelines

### TypeScript & Type Safety

- Maintain strict typing throughout the codebase. Avoid `any` types.
- Validate types before committing:
  ```bash
  npm run typecheck
  ```

### Next.js & React 19 Architecture

- **Server vs. Client Components:** Prefer React Server Components for data fetching and layout shells. Use `"use client"` only when interactive state, browser APIs, or custom events are required.
- **Request Memoization:** Wrap server-side authentication lookups in React's `cache()` to eliminate redundant database queries within a single render pass.
- **Dynamic Imports:** Lazy-load heavyweight components (such as upload portals and document viewers) using `next/dynamic` with skeleton loading states.

### Database & Storage Guidelines

- **Parameterized Queries:** Never concatenate user input into raw SQL queries. Always pass parameters via `$1, $2, ...`.
- **Soft Deletions on Moderation:** Do not permanently delete R2 storage objects on rejection; retain pointers so review errors can be corrected and students can review feedback.
- **Clean Relational Schema:** Ensure relational constraints and foreign keys use `ON DELETE CASCADE` where appropriate.

### Security & Authentication

- **Session Invalidation:** Any user password change or role modification must increment `session_version` to invalidate existing cookies immediately.
- **Client IP Resolution:** Use platform-verified edge headers (`cf-connecting-ip`, `x-vercel-forwarded-for`) and strictly validate candidate IP formats before relying on `X-Forwarded-For`.
- **Shared Device Privacy:** Ensure all user-scoped storage (cookies, `localStorage`, `IndexedDB` blobs) is cleared during `logout()`.

---

## Academic Material Submission Guidelines

When adding or testing academic resources:

1. **Format:** Only `.pdf` documents (max 30MB) and valid YouTube video URLs are supported.
2. **Quality:** PDFs must have legible scans, clear headings, and be oriented correctly.
3. **Accuracy:** Ensure course codes adhere to official faculty nomenclature:
   - **Civil Engineering:** `CVE 201`, `CVE 301`, etc.
   - **Mechanical Engineering:** `MEE 201`, `MEE 301`, etc.
   - **Materials & Metallurgical:** `MME 201`, `MME 301`, etc.
   - **Agric & Bio-Resources:** `ABE 201`, `ABE 301`, etc.
   - **Mining Engineering:** `MNE 201`, `MNE 301`, etc.
   - **General Faculty:** `ENG 101`, `ENG 102`, `ENG 201`, `MTH 101`, `PHY 101`, etc.
4. **Moderation:** All uploaded materials enter `PENDING_REVIEW` until approved by a faculty moderator or administrator.

---

## Submitting a Pull Request

1. **Create a feature branch:**
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```
2. **Make your changes** and write clean, readable code.
3. **Run local quality checks:**
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```
4. **Commit your changes** following the commit message conventions below.
5. **Push to your branch:**
   ```bash
   git push origin feat/your-feature-name
   ```
6. **Open a Pull Request** describing:
   - What problem this PR solves
   - Implementation summary
   - Testing steps and evidence that checks pass
   - Any architectural tradeoffs or database migration requirements

---

## Commit Message Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` A new feature or user-facing enhancement
- `fix:` A bug fix or security patch
- `docs:` Documentation updates (README, CONTRIBUTING, inline docs)
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` A code change that improves performance
- `test:` Adding or refactoring tests
- `chore:` Maintenance tasks, dependency updates, or build configurations

**Examples:**
```
feat(auth): memoize getSession calls with React cache
fix(moderation): prevent irrevocable R2 deletion on rejection
docs: update setup instructions and add contributing guide
test(rate-limit): add IP spoofing verification tests
```

---

## License & Intellectual Property

This project is proprietary software. By contributing code, documentation, or materials to NUESApedia, you agree that your contributions become the property of NUESA and the Faculty of Engineering, FUOYE, governed by the terms in [LICENSE](LICENSE).

