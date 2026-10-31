# NUESApedia API Specification (Authoritative Runtime Reference)

This document reflects the **actual implemented Next.js 16 Route Handlers** under `app/api/**`.

## 1. Standard Response Envelope

All API endpoints return JSON using a unified envelope:

### Success
```json
{
  "success": true,
  "...payload": "..."
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation."
  }
}
```
Client callers use `extractApiError(data, fallback)` in `lib/api-helpers.ts` to safely extract `error.message`.

---

## 2. Authentication & Account Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Public | Creates student account (password ≥8 chars with letters + digits) and sets `nuesapedia_session` cookie. |
| `POST` | `/api/auth/login` | Public | Verifies credentials via constant-time `scrypt`, syncs `ADMIN_EMAILS`, and sets session cookie bound to `session_version`. |
| `POST` | `/api/auth/logout` | Any | Clears `nuesapedia_session` cookie (`maxAge: 0`). |
| `GET` | `/api/auth/me` | Session | Returns authenticated user profile with authoritative DB `role`. |
| `PATCH` / `PUT` | `/api/auth/me` | Session | Updates `name`, `department`, `level`, or `avatar`. |
| `PATCH` / `POST` | `/api/auth/password` | Session | Verifies `currentPassword`, updates password, increments `session_version` (signing out other devices), and refreshes active cookie. |
| `POST` | `/api/auth/forgot-password` | Public | Issues a single-use 15-minute reset token (`SHA-256` hashed in `password_reset_tokens`) and emails link via Resend. |
| `POST` | `/api/auth/reset-password` | Public | Consumes `{ token, newPassword }`, updates password, and increments `session_version`. |

---

## 3. Catalog, Reader & Bookmark Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/resources` | Public | Paginated approved catalog (`limit` default `24`, max `100`; filters: `department`, `level`, `semester`, `course`, `type`, `medium`, `q`, `sort`). |
| `GET` | `/api/resources/:id` | Public (if `APPROVED`) / Owner / Mod | Returns single resource metadata. Unapproved/rejected items return `404` to unauthorized callers. |
| `PATCH` | `/api/resources/:id` | Owner (if unapproved) / Mod | Updates resource metadata. |
| `DELETE` | `/api/resources/:id` | Owner (if unapproved) / Mod | Deletes resource and cleans up R2 object. Approved items cannot be deleted by contributors. |
| `GET` | `/api/resources/:id/view` | Public (if `APPROVED`) / Owner / Mod | Redirects (`302`) to freshly minted 15-minute `inline` signed R2 URL (or JSON with `?format=json`). |
| `GET` | `/api/resources/:id/download` | Public (if `APPROVED`) / Owner / Mod | Atomically increments `downloads` (for approved items) and redirects (`302`) to freshly minted `attachment` signed R2 URL. |
| `GET` / `PUT` | `/api/resources/:id/progress` | Session | Reads or upserts per-user reading progress (`percentage`, `page`). |
| `POST` | `/api/resources/:id/report` | Public (rate-limited) | Submits a quality/broken-file report for resource `:id`. |
| `GET` / `POST` / `DELETE` | `/api/saved` | Session | Lists, adds, or removes user-scoped bookmarks (`LEFT JOIN submissions`). |
| `GET` | `/api/courses` | Public | Lists canonical + approved database courses (`DISTINCT ON` chronological metadata + counts). |
| `GET` | `/api/departments` | Public | Lists NUESA engineering departments with course and resource counts. |
| `GET` | `/api/departments/:departmentId` | Public | Department detail breakdown by academic level (`100L`–`500L`). |
| `POST` | `/api/requests` | Public (rate-limited) | Submits a missing course material request. |

---

## 4. Upload, Moderation & Admin Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/uploads` | Session | Lists the current user's contributed submissions. |
| `POST` | `/api/uploads` | Session | Registers a `YOUTUBE` (`PENDING_REVIEW`) or `PDF` (`UPLOADING`) submission and returns pre-signed R2 PUT URL. |
| `POST` | `/api/uploads/:id/complete` | Owner / Mod | Verifies R2 object existence, `<= 30MB` byte size, and `%PDF-` magic header via `HeadObject` + range read before promoting `UPLOADING -> PENDING_REVIEW`. |
| `DELETE` | `/api/uploads?id=...` | Owner (if unapproved) / Mod | Withdraws a pending/rejected submission and deletes its R2 object. |
| `GET` / `PATCH` | `/api/moderation` | `MODERATOR` / `ADMIN` | Lists submissions (`status`, `limit`, `offset`) and approves or rejects submissions (deleting rejected R2 objects). |
| `GET` / `PATCH` | `/api/moderation/reports` | `MODERATOR` / `ADMIN` | Lists and resolves flagged resource reports. |
| `GET` / `PATCH` | `/api/requests` | `MODERATOR` / `ADMIN` | Lists and marks student material requests as `OPEN` or `FULFILLED`. |
| `GET` / `PATCH` | `/api/admin/users` | `ADMIN` | Lists users (`limit`, `offset`) and updates RBAC roles (incrementing `session_version` to revoke stale privileges immediately). |
| `GET` | `/api/health` | Public | Verifies live PostgreSQL (`SELECT 1`) and Cloudflare R2 (`HeadBucket`) connectivity (`200` healthy / `503` degraded). |
