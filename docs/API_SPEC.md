# Digital Faculty Library — API Specification

**Project:** Digital Faculty Library
**Version:** 1.0
**Status:** Draft
**Architecture:** Next.js App Router + PostgreSQL + Prisma + Cloudflare R2 + Meilisearch + OpenAI + pgvector

---

# 1. Overview

The Digital Faculty Library API provides access to:

* Academic resources
* Courses and departments
* Resource search
* PDF viewing and downloads
* User accounts
* Bookmarks
* Resource contributions
* Moderation
* AI-powered document summaries
* AI document chat
* AI-generated quizzes
* User reading progress
* Analytics
* Administrative operations

The API is designed around a **public-first architecture**.

Students do **not** need an account to:

* Browse resources
* Search the library
* View resource metadata
* Read public PDFs
* Download approved resources

Authentication is only required for features that need user identity or privileges.

---

# 2. API Conventions

## 2.1 Base URL

Production:

```text
https://your-domain.com/api
```

Development:

```text
http://localhost:3000/api
```

All API endpoints are prefixed with:

```text
/api
```

Example:

```http
GET /api/resources
```

---

# 3. Authentication

Authentication is handled using NextAuth/Auth.js.

## 3.1 Authentication Methods

The initial implementation should support:

* Google OAuth
* Email/password authentication, if enabled
* Session-based authentication

Authenticated requests use the user's NextAuth session.

The API should not require users to manually send JWT tokens from the frontend when using standard browser sessions.

---

# 4. User Roles

The API supports the following roles:

| Role        | Description                  |
| ----------- | ---------------------------- |
| `STUDENT`   | Normal authenticated student |
| `MODERATOR` | Reviews submitted resources  |
| `ADMIN`     | Full system access           |

Default role:

```text
STUDENT
```

---

# 5. Standard Response Format

Successful responses should follow a predictable structure.

## Success

```json
{
  "success": true,
  "data": {}
}
```

For lists:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

# 6. Error Format

All API errors should use:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource could not be found."
  }
}
```

## Standard Error Codes

| Code                    | HTTP Status | Meaning                     |
| ----------------------- | ----------: | --------------------------- |
| `UNAUTHORIZED`          |         401 | Authentication required     |
| `FORBIDDEN`             |         403 | User lacks permission       |
| `NOT_FOUND`             |         404 | Resource does not exist     |
| `VALIDATION_ERROR`      |         400 | Invalid request             |
| `CONFLICT`              |         409 | Resource already exists     |
| `RATE_LIMITED`          |         429 | Too many requests           |
| `FILE_TOO_LARGE`        |         413 | Uploaded file exceeds limit |
| `UNSUPPORTED_FILE_TYPE` |         415 | File type not supported     |
| `UPLOAD_FAILED`         |         500 | Upload failed               |
| `AI_ERROR`              |         500 | AI service failure          |
| `SEARCH_ERROR`          |         500 | Search service failure      |
| `INTERNAL_ERROR`        |         500 | Unexpected server error     |

---

# 7. Pagination

List endpoints use:

```text
?page=1&limit=20
```

Defaults:

```text
page = 1
limit = 20
```

Maximum:

```text
limit = 100
```

Example:

```http
GET /api/resources?page=2&limit=20
```

Response:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 137,
    "totalPages": 7
  }
}
```

---

# 8. Departments API

## 8.1 Get Departments

```http
GET /api/departments
```

Authentication:

```text
None
```

Returns all departments available in the library.

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "dept_123",
      "name": "Electrical & Electronics Engineering",
      "code": "EEE",
      "resourceCount": 128
    }
  ]
}
```

---

## 8.2 Get Department

```http
GET /api/departments/:departmentId
```

Authentication:

```text
None
```

Example:

```http
GET /api/departments/dept_123
```

---

# 9. Courses API

## 9.1 Get Courses

```http
GET /api/courses
```

Authentication:

```text
None
```

### Query Parameters

| Parameter      | Type   | Required |
| -------------- | ------ | -------- |
| `departmentId` | string | No       |
| `level`        | number | No       |
| `page`         | number | No       |
| `limit`        | number | No       |

Example:

```http
GET /api/courses?departmentId=dept_123&level=300
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "course_123",
      "code": "EEE 372",
      "title": "Measurement and Instrumentation II",
      "level": 300,
      "department": {
        "id": "dept_123",
        "name": "Electrical & Electronics Engineering"
      },
      "resourceCount": 24
    }
  ]
}
```

---

## 9.2 Get Course

```http
GET /api/courses/:courseId
```

Authentication:

```text
None
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "course_123",
    "code": "EEE 372",
    "title": "Measurement and Instrumentation II",
    "level": 300,
    "departmentId": "dept_123"
  }
}
```

---

## 9.3 Get Course Resources

```http
GET /api/courses/:courseId/resources
```

Authentication:

```text
None
```

### Query Parameters

```text
?page=1
&limit=20
&type=PDF
&sort=recent
```

---

# 10. Resources API

Resources are the core entity of the library.

---

## 10.1 Get Resources

```http
GET /api/resources
```

Authentication:

```text
None
```

Only resources with:

```text
status = APPROVED
```

are returned publicly.

### Query Parameters

| Parameter      | Type   | Description          |
| -------------- | ------ | -------------------- |
| `page`         | number | Page number          |
| `limit`        | number | Results per page     |
| `courseId`     | string | Filter by course     |
| `departmentId` | string | Filter by department |
| `level`        | number | Filter by level      |
| `type`         | string | Resource type        |
| `sort`         | string | Sorting method       |

Example:

```http
GET /api/resources?courseId=course_123&type=PDF&page=1&limit=20
```

---

## 10.2 Get Resource

```http
GET /api/resources/:resourceId
```

Authentication:

```text
None
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "resource_123",
    "title": "Measurement and Instrumentation Notes",
    "description": "Lecture notes covering measurement systems.",
    "type": "PDF",
    "fileSize": 2457600,
    "pageCount": 48,
    "course": {
      "id": "course_123",
      "code": "EEE 372",
      "title": "Measurement and Instrumentation II"
    },
    "department": {
      "id": "dept_123",
      "name": "Electrical & Electronics Engineering"
    },
    "level": 300,
    "tags": [
      "measurement",
      "instrumentation",
      "sensors"
    ],
    "downloads": 125,
    "createdAt": "2026-09-13T12:00:00Z"
  }
}
```

---

# 11. Resource Viewing

## 11.1 Get Resource File URL

```http
GET /api/resources/:resourceId/view
```

Authentication:

```text
None
```

The API generates a temporary signed Cloudflare R2 URL.

### Response

```json
{
  "success": true,
  "data": {
    "url": "https://signed-storage-url...",
    "expiresIn": 900
  }
}
```

The client should never receive permanent private storage credentials.

---

# 12. Resource Downloads

## 12.1 Download Resource

```http
GET /api/resources/:resourceId/download
```

Authentication:

```text
None
```

Downloads do not require an account.

### Flow

```text
Client
  ↓
GET /api/resources/:id/download
  ↓
Validate resource
  ↓
Generate signed R2 URL
  ↓
Increment download counter
  ↓
Return URL
```

### Response

```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://signed-storage-url...",
    "expiresIn": 900
  }
}
```

The frontend should redirect the user to the signed URL.

---

# 13. Search API

## 13.1 Global Search

```http
GET /api/search
```

Authentication:

```text
None
```

### Query Parameters

| Parameter    | Required | Description       |
| ------------ | -------- | ----------------- |
| `q`          | Yes      | Search query      |
| `department` | No       | Department filter |
| `course`     | No       | Course filter     |
| `level`      | No       | Academic level    |
| `type`       | No       | Resource type     |
| `page`       | No       | Page number       |
| `limit`      | No       | Results per page  |

Example:

```http
GET /api/search?q=transformer&department=EEE&level=300
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "resource_123",
      "title": "Electrical Machines Notes",
      "description": "Introduction to transformers and electrical machines.",
      "type": "PDF",
      "course": {
        "code": "EEE 314",
        "title": "Electrical Machines"
      },
      "highlight": "Introduction to <em>transformers</em>..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPages": 1
  }
}
```

Search is powered by Meilisearch.

---

# 14. Authentication API

## 14.1 Get Current User

```http
GET /api/auth/me
```

Authentication:

```text
Required
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "STUDENT",
    "department": "Electrical Engineering",
    "level": 300
  }
}
```

---

# 15. Upload API

Uploading resources requires authentication.

## 15.1 Create Upload

```http
POST /api/uploads
```

Authentication:

```text
Required
```

### Request

```json
{
  "title": "EEE 372 Lecture Notes",
  "description": "Measurement and Instrumentation lecture notes.",
  "courseId": "course_123",
  "type": "PDF",
  "tags": [
    "measurement",
    "instrumentation"
  ]
}
```

### Response

```json
{
  "success": true,
  "data": {
    "uploadId": "upload_123",
    "uploadUrl": "https://signed-r2-upload-url...",
    "expiresIn": 900
  }
}
```

The actual file should be uploaded directly to Cloudflare R2 using the signed upload URL.

This prevents large files from unnecessarily passing through the Next.js server.

---

# 16. Upload Completion

## 16.1 Complete Upload

```http
POST /api/uploads/:uploadId/complete
```

Authentication:

```text
Required
```

### Response

```json
{
  "success": true,
  "data": {
    "uploadId": "upload_123",
    "resourceId": "resource_123",
    "status": "PROCESSING"
  }
}
```

---

# 17. Upload Processing

After an upload is completed:

```text
Upload
 ↓
Virus Scan
 ↓
File Validation
 ↓
Metadata Extraction
 ↓
Text Extraction
 ↓
OCR if necessary
 ↓
Duplicate Detection
 ↓
AI Processing
 ↓
Embedding Generation
 ↓
Pending Moderation
```

The resource should not become publicly accessible until approved.

---

# 18. My Uploads

## 18.1 Get User Uploads

```http
GET /api/uploads
```

Authentication:

```text
Required
```

### Query Parameters

```text
?page=1
&limit=20
&status=PENDING
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "resource_123",
      "title": "EEE 372 Lecture Notes",
      "status": "PENDING",
      "createdAt": "2026-09-13T12:00:00Z"
    }
  ]
}
```

---

# 19. Bookmarks API

Bookmarks require authentication.

## 19.1 Add Bookmark

```http
POST /api/bookmarks
```

### Request

```json
{
  "resourceId": "resource_123"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "bookmark_123",
    "resourceId": "resource_123"
  }
}
```

---

## 19.2 Remove Bookmark

```http
DELETE /api/bookmarks/:resourceId
```

Authentication:

```text
Required
```

---

## 19.3 Get Bookmarks

```http
GET /api/bookmarks
```

Authentication:

```text
Required
```

---

# 20. Reading Progress API

Reading progress should be stored for authenticated users.

## 20.1 Save Reading Progress

```http
PUT /api/resources/:resourceId/progress
```

### Request

```json
{
  "page": 24,
  "percentage": 50
}
```

### Response

```json
{
  "success": true,
  "data": {
    "resourceId": "resource_123",
    "page": 24,
    "percentage": 50
  }
}
```

---

## 20.2 Get Reading Progress

```http
GET /api/resources/:resourceId/progress
```

Authentication:

```text
Required
```

---

# 21. AI API

AI functionality is divided into:

* Summary
* Document chat
* Quiz generation

AI endpoints should be rate-limited.

---

# 22. AI Summary

## 22.1 Generate Summary

```http
POST /api/ai/summary
```

Authentication:

```text
Optional
```

### Request

```json
{
  "resourceId": "resource_123"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "resourceId": "resource_123",
    "summary": {
      "overview": "This document introduces...",
      "keyConcepts": [
        "Measurement systems",
        "Sensors",
        "Transducers"
      ],
      "formulas": [
        "V = IR"
      ],
      "examTips": [
        "Understand the difference between accuracy and precision."
      ]
    }
  }
}
```

---

# 23. AI Document Chat

## 23.1 Ask Question

```http
POST /api/ai/chat
```

Authentication:

```text
Optional
```

### Request

```json
{
  "resourceId": "resource_123",
  "message": "What is the difference between accuracy and precision?"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "answer": "Accuracy refers to how close a measurement is to the true value...",
    "sources": [
      {
        "page": 12,
        "text": "Accuracy describes..."
      }
    ]
  }
}
```

The AI must only answer using retrieved document context when the request is document-specific.

---

# 24. AI Chat Pipeline

```text
User Question
      ↓
Validate Resource
      ↓
Generate Query Embedding
      ↓
pgvector Similarity Search
      ↓
Retrieve Relevant Chunks
      ↓
Build Context
      ↓
OpenAI
      ↓
Validate Response
      ↓
Return Answer + Sources
```

The API should never send the entire document to the model when only a small subset of the document is relevant.

---

# 25. AI Quiz API

## 25.1 Generate Quiz

```http
POST /api/ai/quiz
```

Authentication:

```text
Required
```

### Request

```json
{
  "resourceId": "resource_123",
  "numberOfQuestions": 10,
  "difficulty": "MEDIUM"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "quizId": "quiz_123",
    "questions": [
      {
        "id": "question_1",
        "question": "What instrument measures voltage?",
        "options": [
          "Ammeter",
          "Voltmeter",
          "Wattmeter",
          "Ohmmeter"
        ]
      }
    ],
    "duration": 600
  }
}
```

The correct answers should **not** be returned to the client before the quiz is submitted.

---

# 26. Quiz Submission

## 26.1 Submit Quiz

```http
POST /api/ai/quiz/:quizId/submit
```

Authentication:

```text
Required
```

### Request

```json
{
  "answers": {
    "question_1": 1,
    "question_2": 3
  }
}
```

### Response

```json
{
  "success": true,
  "data": {
    "quizId": "quiz_123",
    "score": 80,
    "total": 10,
    "correct": 8,
    "incorrect": 2,
    "review": [
      {
        "questionId": "question_1",
        "correctAnswer": 1,
        "selectedAnswer": 1,
        "explanation": "A voltmeter measures potential difference."
      }
    ]
  }
}
```

---

# 27. Moderation API

Moderation endpoints require:

```text
MODERATOR
```

or:

```text
ADMIN
```

---

## 27.1 Get Pending Resources

```http
GET /api/admin/resources?status=PENDING
```

Authentication:

```text
Moderator/Admin
```

---

## 27.2 Get Resource for Review

```http
GET /api/admin/resources/:resourceId
```

Authentication:

```text
Moderator/Admin
```

Returns:

* Resource metadata
* Contributor information
* File information
* Processing status
* Duplicate warnings
* Extracted metadata

---

# 28. Approve Resource

```http
POST /api/admin/resources/:resourceId/approve
```

Authentication:

```text
Moderator/Admin
```

### Request

```json
{
  "notes": "Resource verified and approved."
}
```

### Response

```json
{
  "success": true,
  "data": {
    "resourceId": "resource_123",
    "status": "APPROVED"
  }
}
```

After approval:

```text
Resource
 ↓
Update Database
 ↓
Index Meilisearch
 ↓
Publish
```

---

# 29. Reject Resource

```http
POST /api/admin/resources/:resourceId/reject
```

Authentication:

```text
Moderator/Admin
```

### Request

```json
{
  "reason": "The uploaded document is unrelated to the selected course."
}
```

### Response

```json
{
  "success": true,
  "data": {
    "resourceId": "resource_123",
    "status": "REJECTED"
  }
}
```

---

# 30. Edit Resource Metadata

```http
PATCH /api/admin/resources/:resourceId
```

Authentication:

```text
Moderator/Admin
```

### Request

```json
{
  "title": "Updated Resource Title",
  "description": "Updated description.",
  "courseId": "course_456",
  "tags": [
    "electronics",
    "circuits"
  ]
}
```

---

# 31. Delete Resource

```http
DELETE /api/admin/resources/:resourceId
```

Authentication:

```text
Admin
```

The resource should be soft-deleted first.

Example:

```text
deletedAt = timestamp
```

The underlying R2 object should only be permanently removed after the retention policy is satisfied.

---

# 32. User Management API

Admin only.

## 32.1 List Users

```http
GET /api/admin/users
```

### Query Parameters

```text
?page=1
&limit=20
&role=STUDENT
```

---

## 32.2 Update User Role

```http
PATCH /api/admin/users/:userId
```

### Request

```json
{
  "role": "MODERATOR"
}
```

Only admins can modify roles.

---

# 33. Analytics API

Analytics endpoints are protected.

## 33.1 Resource Analytics

```http
GET /api/admin/analytics/resources
```

Possible response:

```json
{
  "success": true,
  "data": {
    "totalResources": 512,
    "approvedResources": 470,
    "pendingResources": 31,
    "rejectedResources": 11,
    "totalDownloads": 8241
  }
}
```

---

## 33.2 Search Analytics

```http
GET /api/admin/analytics/search
```

Track:

* Number of searches
* Popular queries
* Queries with no results
* Most searched courses

---

## 33.3 AI Analytics

```http
GET /api/admin/analytics/ai
```

Track:

* Summary requests
* Chat requests
* Quiz generations
* Token usage
* Estimated AI cost
* Failed requests

---

# 34. Health API

## 34.1 Health Check

```http
GET /api/health
```

Authentication:

```text
None
```

### Response

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "healthy",
    "search": "healthy",
    "storage": "healthy",
    "timestamp": "2026-09-13T12:00:00Z"
  }
}
```

This endpoint can be used by uptime monitoring.

---

# 35. Background Worker APIs

Worker endpoints should not be publicly accessible.

They should require an internal service secret or signed request.

---

## 35.1 Process Upload

```http
POST /api/internal/uploads/process
```

Responsibilities:

* Virus scanning
* Metadata extraction
* Text extraction
* OCR
* Duplicate detection
* Chunking

---

## 35.2 Generate Embeddings

```http
POST /api/internal/embeddings
```

Responsibilities:

```text
Text chunks
 ↓
Generate embeddings
 ↓
Store vectors in pgvector
```

---

## 35.3 Index Search Document

```http
POST /api/internal/search/index
```

Responsibilities:

* Create Meilisearch document
* Update indexed metadata
* Remove rejected/deleted resources

---

# 36. Resource Processing Status

Resources can have the following statuses:

```text
PROCESSING
PENDING
APPROVED
REJECTED
FAILED
```

### State Flow

```text
UPLOAD
  ↓
PROCESSING
  ↓
PENDING
  ↓
┌──────────────┐
│              │
APPROVED    REJECTED
```

If processing fails:

```text
PROCESSING
    ↓
FAILED
```

---

# 37. Resource Types

Initial supported resource types:

```text
PDF
DOCX
PPT
VIDEO
LINK
```

The MVP should prioritize:

```text
PDF
```

---

# 38. Upload Validation

The API must validate:

### File extension

Allowed:

```text
.pdf
.docx
.ppt
.pptx
```

### MIME type

The server must verify the actual MIME type instead of trusting the filename.

### File size

The maximum upload size should be configurable through an environment variable.

Example:

```env
MAX_UPLOAD_SIZE_MB=50
```

---

# 39. Duplicate Detection

The upload pipeline should calculate a cryptographic hash:

```text
SHA-256
```

Example:

```text
fileHash = SHA256(file)
```

Before creating a new resource:

```text
Check fileHash
      ↓
Existing?
 ┌────┴────┐
Yes        No
 ↓          ↓
Reject     Continue
```

The API should return:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "This file already exists in the library."
  }
}
```

---

# 40. Rate Limiting

Rate limiting should be implemented using Upstash Redis.

Different endpoints should have different limits.

| Endpoint Type    | Suggested Limit |
| ---------------- | --------------: |
| Public resources |         120/min |
| Search           |          60/min |
| Download URL     |          30/min |
| Upload           |         10/hour |
| AI Summary       |         10/hour |
| AI Chat          |         30/hour |
| AI Quiz          |         10/hour |
| Authentication   |          10/min |

These values should be configurable.

---

# 41. AI Cost Protection

AI endpoints must implement:

* Rate limiting
* Maximum input size
* Maximum output tokens
* Request quotas
* Request logging
* Timeout handling
* Retry limits

Unauthenticated AI requests should have stricter limits than authenticated requests.

---

# 42. Caching

Public resources should be aggressively cached.

Potential cache targets:

```text
Departments
Courses
Resource metadata
Popular resources
Search results
```

Resource metadata may use:

```http
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

Signed download/view URLs should not be cached publicly.

---

# 43. Security Requirements

All API endpoints must:

* Validate request bodies
* Validate query parameters
* Sanitize user-generated content
* Use parameterized database queries through Prisma
* Apply authentication where required
* Apply role-based authorization
* Rate-limit expensive endpoints
* Never expose R2 credentials
* Never expose OpenAI API keys
* Never expose database credentials

---

# 44. CORS

Since the frontend and API are served from the same Next.js application, CORS should be restrictive.

If external clients are introduced later, explicitly allow trusted origins.

Never use:

```text
Access-Control-Allow-Origin: *
```

for authenticated APIs.

---

# 45. Request Validation

Zod should be used for API request validation.

Example:

```ts
const createBookmarkSchema = z.object({
  resourceId: z.string().min(1),
});
```

Invalid requests return:

```http
400 Bad Request
```

Example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data.",
    "fields": {
      "resourceId": "Resource ID is required."
    }
  }
}
```

---

# 46. HTTP Status Codes

The API should use standard HTTP status codes.

| Status | Usage                          |
| -----: | ------------------------------ |
|  `200` | Successful request             |
|  `201` | Resource created               |
|  `202` | Processing accepted            |
|  `204` | Successful deletion/no content |
|  `400` | Invalid request                |
|  `401` | Not authenticated              |
|  `403` | Not authorized                 |
|  `404` | Not found                      |
|  `409` | Conflict                       |
|  `413` | File too large                 |
|  `415` | Unsupported media type         |
|  `422` | Unprocessable entity           |
|  `429` | Rate limited                   |
|  `500` | Server error                   |
|  `503` | Service unavailable            |

---

# 47. API Route Summary

## Public

```text
GET    /api/departments
GET    /api/departments/:id

GET    /api/courses
GET    /api/courses/:id
GET    /api/courses/:id/resources

GET    /api/resources
GET    /api/resources/:id
GET    /api/resources/:id/view
GET    /api/resources/:id/download

GET    /api/search

GET    /api/health
```

---

## Authenticated

```text
GET    /api/auth/me

POST   /api/uploads
POST   /api/uploads/:id/complete
GET    /api/uploads

POST   /api/bookmarks
GET    /api/bookmarks
DELETE /api/bookmarks/:resourceId

PUT    /api/resources/:id/progress
GET    /api/resources/:id/progress

POST   /api/ai/summary
POST   /api/ai/chat
POST   /api/ai/quiz
POST   /api/ai/quiz/:id/submit
```

---

## Moderator/Admin

```text
GET    /api/admin/resources
GET    /api/admin/resources/:id

POST   /api/admin/resources/:id/approve
POST   /api/admin/resources/:id/reject

PATCH  /api/admin/resources/:id

GET    /api/admin/users
PATCH  /api/admin/users/:id
```

---

## Admin

```text
DELETE /api/admin/resources/:id

GET    /api/admin/analytics/resources
GET    /api/admin/analytics/search
GET    /api/admin/analytics/ai
```

---

## Internal

```text
POST /api/internal/uploads/process
POST /api/internal/embeddings
POST /api/internal/search/index
```

Internal routes must never be exposed as normal public APIs.

---

# 48. Recommended Next.js Route Structure

The API should map cleanly to the Next.js App Router:

```text
app/
└── api/
    ├── auth/
    │   └── me/
    │       └── route.ts
    │
    ├── departments/
    │   ├── route.ts
    │   └── [departmentId]/
    │       └── route.ts
    │
    ├── courses/
    │   ├── route.ts
    │   └── [courseId]/
    │       ├── route.ts
    │       └── resources/
    │           └── route.ts
    │
    ├── resources/
    │   ├── route.ts
    │   └── [resourceId]/
    │       ├── route.ts
    │       ├── view/
    │       │   └── route.ts
    │       ├── download/
    │       │   └── route.ts
    │       └── progress/
    │           └── route.ts
    │
    ├── search/
    │   └── route.ts
    │
    ├── uploads/
    │   ├── route.ts
    │   └── [uploadId]/
    │       └── complete/
    │           └── route.ts
    │
    ├── bookmarks/
    │   ├── route.ts
    │   └── [resourceId]/
    │       └── route.ts
    │
    ├── ai/
    │   ├── summary/
    │   │   └── route.ts
    │   ├── chat/
    │   │   └── route.ts
    │   └── quiz/
    │       ├── route.ts
    │       └── [quizId]/
    │           └── submit/
    │               └── route.ts
    │
    ├── admin/
    │   ├── resources/
    │   │   ├── route.ts
    │   │   └── [resourceId]/
    │   │       ├── route.ts
    │   │       ├── approve/
    │   │       │   └── route.ts
    │   │       └── reject/
    │   │           └── route.ts
    │   ├── users/
    │   │   ├── route.ts
    │   │   └── [userId]/
    │   │       └── route.ts
    │   └── analytics/
    │       ├── resources/
    │       │   └── route.ts
    │       ├── search/
    │       │   └── route.ts
    │       └── ai/
    │           └── route.ts
    │
    ├── internal/
    │   ├── uploads/
    │   │   └── process/
    │   │       └── route.ts
    │   ├── embeddings/
    │   │   └── route.ts
    │   └── search/
    │       └── index/
    │           └── route.ts
    │
    └── health/
        └── route.ts
```

---

# 49. API Design Principles

The implementation should follow these principles:

### 1. Public by default

Academic resources should be accessible without authentication.

### 2. Authentication only when necessary

Do not force students to create accounts simply to download educational material.

### 3. Direct-to-storage uploads

Large files should go directly to Cloudflare R2 using signed URLs.

### 4. Async processing

Expensive operations such as:

* OCR
* Text extraction
* Embedding generation
* Search indexing

should run asynchronously.

### 5. AI must use RAG

The document itself should remain the source of truth for document-specific AI responses.

### 6. Never expose secrets

The browser must never receive:

```text
DATABASE_URL
R2_SECRET
OPENAI_API_KEY
MEILI_MASTER_KEY
UPSTASH_REDIS_TOKEN
```

### 7. Every expensive endpoint is rate-limited

Especially:

```text
/uploads
/ai/*
/search
/download
```

### 8. API responses should remain predictable

Clients should always be able to determine:

```text
success
data
error
pagination
```

without endpoint-specific response conventions.

---

# 50. MVP API Scope

The first production release only needs to implement:

```text
GET    /api/departments
GET    /api/courses
GET    /api/resources
GET    /api/resources/:id
GET    /api/resources/:id/view
GET    /api/resources/:id/download

GET    /api/search

POST   /api/uploads
POST   /api/uploads/:id/complete

POST   /api/ai/summary
POST   /api/ai/chat
POST   /api/ai/quiz

POST   /api/bookmarks
GET    /api/bookmarks
DELETE /api/bookmarks/:id

GET    /api/admin/resources
POST   /api/admin/resources/:id/approve
POST   /api/admin/resources/:id/reject

GET    /api/health
```

Additional APIs can be introduced as the product grows.

---

# 51. Future API Extensions

Future versions may introduce:

```text
GET    /api/collections
POST   /api/collections

GET    /api/resources/:id/comments
POST   /api/resources/:id/comments

POST   /api/resources/:id/rating

GET    /api/announcements

GET    /api/study-plans
POST   /api/study-plans

POST   /api/ai/flashcards

POST   /api/ai/voice

GET    /api/leaderboard
```

These should not be implemented in the MVP unless they become necessary.

---

# 52. API Versioning

The initial API does not require URL versioning.

Current:

```text
/api/resources
```

If breaking changes become necessary:

```text
/api/v2/resources
```

Versioning should only be introduced when there is a genuine breaking API change.

---

# 53. Documentation

The API should eventually be documented using OpenAPI.

Recommended endpoint:

```text
/api/docs
```

and machine-readable specification:

```text
/api/openapi.json
```

Swagger UI or Scalar can be used for interactive documentation.

The OpenAPI specification should be generated from the actual route schemas rather than maintained separately where possible.

---

# 54. Definition of Done

An API endpoint is considered complete when:

* [ ] Route is implemented
* [ ] Request validation exists
* [ ] Authentication requirements are enforced
* [ ] Role authorization is enforced where required
* [ ] Database queries are implemented
* [ ] Error handling is implemented
* [ ] Rate limiting is applied where necessary
* [ ] Response follows the standard API format
* [ ] Unit/integration tests exist
* [ ] Logging exists for important operations
* [ ] OpenAPI documentation exists
* [ ] Security considerations have been reviewed

---

# 55. Final Architecture

The API architecture can be summarized as:

```text
                    ┌─────────────────────┐
                    │      Next.js        │
                    │    API Routes       │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        PostgreSQL         Cloudflare R2    Meilisearch
        + pgvector           Storage           Search
              │                │
              │                │
              └────────┬───────┘
                       │
                       ▼
                Background Queue
                  Upstash Redis
                       │
            ┌──────────┼───────────┐
            ▼          ▼           ▼
           OCR      Embeddings    Processing
            │          │
            └──────────┼───────────┘
                       ▼
                    OpenAI
                       │
                       ▼
                  AI Features
              ┌────────┼────────┐
              ▼        ▼        ▼
           Summary    Chat     Quiz
```

The API should remain stateless wherever possible, with PostgreSQL serving as the source of truth, R2 handling files, Meilisearch handling discovery, pgvector handling semantic retrieval, and background workers handling expensive processing.
