import test from "node:test";
import assert from "node:assert/strict";

// Ensure isolated dev memory store is used for unit tests without touching external Postgres
delete process.env.DATABASE_URL;
process.env.SESSION_SECRET =
  "test-only-high-entropy-session-secret-key-minimum-32-chars!!";
process.env.ADMIN_EMAILS = "dean@fuoye.edu.ng";

import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  generateResetToken,
} from "@/lib/auth";
import {
  extractApiError,
  validatePassword,
  getSafeRedirectPath,
  formatBytes,
  extractYouTubeId,
  extractYoutubeId,
  parseSizeToBytes,
  isSafeStorageKey,
} from "@/lib/api-helpers";
import { DEPARTMENTS, getDepartmentBySlug, resolveDepartment } from "@/lib/departments";
import {
  createUser,
  updateUserPassword,
  updateUserRole,
  createPasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/db/users";
import {
  canAccessSubmission,
  createSubmission,
  deleteSubmissionWithChecks,
  mapSubmissionRow,
  updateSubmissionStatus,
  pruneStaleUploads,
} from "@/lib/db/submissions";
import { addSavedResource, getSavedResources } from "@/lib/db/saved";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeDbError } from "@/lib/db/pool";

test("Password hashing & constant-time verification", async () => {
  const hash = await hashPassword("Thermo2026");
  assert.ok(hash.includes(":"), "Expected salt:derivedKey format");
  assert.equal(await verifyPassword("Thermo2026", hash), true);
  assert.equal(await verifyPassword("WrongPass123", hash), false);
  assert.equal(await verifyPassword("Thermo2026", "malformed"), false);
});

test("Session tokens bind sessionVersion and reject tampering", () => {
  const token = createSessionToken({
    userId: "usr_123",
    email: "student@fuoye.edu.ng",
    role: "STUDENT",
    sessionVersion: 3,
  });

  const verified = verifySessionToken(token);
  assert.ok(verified);
  assert.equal(verified.userId, "usr_123");
  assert.equal(verified.sessionVersion, 3);

  const tampered = `${token.split(".")[0]}.forgedsignature`;
  assert.equal(verifySessionToken(tampered), null);
});

test("ADMIN_EMAILS bootstrap persists ADMIN role and role/password changes bump sessionVersion", async () => {
  const admin = await createUser({
    name: "Faculty Dean",
    email: "dean@fuoye.edu.ng",
    password: await hashPassword("StrongPass1"),
    department: "Civil Engineering",
    level: "500L",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Dean",
  });
  assert.equal(admin.role, "ADMIN");
  assert.equal(admin.sessionVersion, 1);

  const promoted = await updateUserRole(admin.id, "MODERATOR");
  assert.ok(promoted);
  assert.equal(promoted.role, "MODERATOR");
  assert.equal(
    promoted.sessionVersion,
    2,
    "Changing role must bump sessionVersion to invalidate prior cookies"
  );

  const afterPw = await updateUserPassword(
    admin.id,
    await hashPassword("NewStrong2")
  );
  assert.ok(afterPw);
  assert.equal(afterPw.sessionVersion, 3);
});

test("Password reset tokens are single-use and revoke active sessions", async () => {
  const student = await createUser({
    name: "Adaeze",
    email: "adaeze@fuoye.edu.ng",
    password: await hashPassword("InitialPass1"),
    department: "Mechanical Engineering",
    level: "300L",
    avatar: "https://api.dicebear.com/7.x/lorelei/svg?seed=Ada",
  });

  const { rawToken, tokenHash } = generateResetToken();
  assert.equal(rawToken.length, 64);
  assert.notEqual(rawToken, tokenHash);

  await createPasswordResetToken(student.id, tokenHash, 15);

  const newHash = await hashPassword("ResetPass99");
  const consumed = await consumePasswordResetToken(tokenHash, newHash);
  assert.ok(consumed);
  assert.equal(consumed.sessionVersion, student.sessionVersion + 1);
  assert.equal(await verifyPassword("ResetPass99", consumed.password), true);

  // Replay must fail
  const replayed = await consumePasswordResetToken(tokenHash, newHash);
  assert.equal(replayed, null);
});

test("Moderation boundary & deletion protection on submissions", async () => {
  const pending = await createSubmission({
    id: "sub_pending_1",
    userId: "usr_owner",
    title: "Fluid Mechanics Notes",
    courseCode: "MEE 301",
    department: "Mechanical Engineering",
    level: "300L",
    semester: "First Semester",
    type: "Lecture Note",
    medium: "PDF",
    r2Key: "uploads/mech/MEE301/sub_pending_1_notes.pdf",
    status: "PENDING_REVIEW",
  });

  // Never persists expiring S3 URLs; always canonicalizes to /view
  assert.equal(pending.fileUrl, "/api/resources/sub_pending_1/view");

  // Even legacy DB rows with expired S3 URLs are healed on read
  const healed = mapSubmissionRow({
    id: "sub_legacy",
    user_id: "usr_owner",
    title: "Old Row",
    course_code: "CVE 201",
    department: "Civil Engineering",
    level: "200L",
    medium: "PDF",
    r2_key: "uploads/civil/CVE201/old.pdf",
    file_url: "https://expired-r2-presigned.example.com/old.pdf?X-Amz-Expires=3600",
    status: "APPROVED",
  });
  assert.equal(healed.fileUrl, "/api/resources/sub_legacy/view");

  // Access control checks
  assert.equal(canAccessSubmission(pending, null), false);
  assert.equal(
    canAccessSubmission(pending, { userId: "usr_stranger", role: "STUDENT" }),
    false
  );
  assert.equal(
    canAccessSubmission(pending, { userId: "usr_owner", role: "STUDENT" }),
    true
  );
  assert.equal(
    canAccessSubmission(pending, { userId: "usr_mod", role: "MODERATOR" }),
    true
  );

  // Approved resources cannot be deleted by contributors
  const approved = await createSubmission({
    id: "sub_approved_1",
    userId: "usr_owner",
    title: "Approved Exam PQ",
    courseCode: "MEE 301",
    department: "Mechanical Engineering",
    level: "300L",
    semester: "First Semester",
    type: "Past Question",
    medium: "PDF",
    r2Key: "uploads/mech/MEE301/sub_approved_1_pq.pdf",
    status: "APPROVED",
  });

  const studentDelete = await deleteSubmissionWithChecks(
    { userId: "usr_owner", role: "STUDENT" },
    approved.id
  );
  assert.equal(studentDelete.deleted, false);
  assert.equal(studentDelete.reason, "ALREADY_APPROVED");

  const modDelete = await deleteSubmissionWithChecks(
    { userId: "usr_mod", role: "MODERATOR" },
    approved.id
  );
  assert.equal(modDelete.deleted, true);

  // Rejection preserves r2Key for audit/appeal and stores rejectionReason
  const rejected = await updateSubmissionStatus(
    pending.id,
    "REJECTED",
    "Admin Reviewer",
    "Corrupted scan pages",
    "usr_mod"
  );
  assert.ok(rejected);
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.r2Key, "uploads/mech/MEE301/sub_pending_1_notes.pdf");
  assert.equal(rejected.rejectionReason, "Corrupted scan pages");
});

test("API contract helpers prevent [object Object], weak passwords, and open redirects", () => {
  assert.equal(
    extractApiError({
      success: false,
      error: { code: "INVALID_TOKEN", message: "Reset link expired." },
    }),
    "Reset link expired."
  );
  assert.equal(
    extractApiError({ success: false, error: "Legacy error string" }),
    "Legacy error string"
  );

  assert.equal(validatePassword("123456").valid, false);
  assert.equal(validatePassword("abcdefgh").valid, false);
  assert.equal(validatePassword("Engineer2026").valid, true);

  assert.equal(getSafeRedirectPath("/moderation"), "/moderation");
  assert.equal(getSafeRedirectPath("https://evil.example.com"), "/profile");
  assert.equal(getSafeRedirectPath("//evil.example.com"), "/profile");
  assert.equal(getSafeRedirectPath("/login"), "/profile");
  assert.equal(formatBytes(2 * 1024 * 1024), "2.00 MB");
});

test("isSafeStorageKey blocks literal and URL-encoded path traversal attacks", () => {
  // Valid storage keys
  assert.equal(
    isSafeStorageKey("uploads/civil/CVE201/sub_123_notes.pdf"),
    true
  );
  assert.equal(
    isSafeStorageKey("uploads/mech/MEE301/sub_abc_exam.pdf"),
    true
  );

  // Literal traversal & path manipulation
  assert.equal(isSafeStorageKey("uploads/../etc/passwd"), false);
  assert.equal(isSafeStorageKey("uploads/..\\secret.pdf"), false);
  assert.equal(isSafeStorageKey("uploads/dir/../../secret.pdf"), false);
  assert.equal(isSafeStorageKey("uploads/secret\\file.pdf"), false);
  assert.equal(isSafeStorageKey("uploads/./file.pdf"), false);

  // Single URL-encoded traversal (%2e is '.', %2f is '/', %5c is '\')
  assert.equal(isSafeStorageKey("uploads/%2e%2e/secret.pdf"), false);
  assert.equal(isSafeStorageKey("uploads/%2e%2e%2fsecret.pdf"), false);
  assert.equal(isSafeStorageKey("uploads/..%2fsecret.pdf"), false);
  assert.equal(isSafeStorageKey("uploads/%2e%2e%5csecret.pdf"), false);
  assert.equal(isSafeStorageKey("uploads/test%5csecret.pdf"), false);

  // Double URL-encoded traversal (%252e is double-encoded '.')
  assert.equal(isSafeStorageKey("uploads/%252e%252e/secret.pdf"), false);
  assert.equal(isSafeStorageKey("uploads/%252e%252e%252fsecret.pdf"), false);

  // Null byte injection & invalid prefixes
  assert.equal(isSafeStorageKey("uploads/\0secret.pdf"), false);
  assert.equal(isSafeStorageKey("uploads/%00secret.pdf"), false);
  assert.equal(isSafeStorageKey("/etc/passwd"), false);
  assert.equal(isSafeStorageKey(""), false);
  assert.equal(isSafeStorageKey(null), false);
  assert.equal(isSafeStorageKey(undefined), false);
});

test("Rate limiter enforces threshold within window", async () => {
  const key = `test_rl_${Date.now()}`;
  const r1 = await checkRateLimit(key, { limit: 2, windowMs: 60_000 });
  const r2 = await checkRateLimit(key, { limit: 2, windowMs: 60_000 });
  const r3 = await checkRateLimit(key, { limit: 2, windowMs: 60_000 });

  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  assert.equal(r3.allowed, false);
  assert.equal(r3.remaining, 0);
});

test("normalizeDbError flattens AggregateError to prevent React Flight AggregateError(null) crash", () => {
  const agg = Object.assign(
    new AggregateError(
      [
        new Error("connect ECONNREFUSED ::1:5432"),
        new Error("connect ECONNREFUSED 127.0.0.1:5432"),
      ],
      ""
    ),
    { code: "ECONNREFUSED" }
  );

  const normalized = normalizeDbError(agg) as NodeJS.ErrnoException & {
    errors?: unknown;
  };
  assert.equal(normalized instanceof AggregateError, false);
  assert.equal("errors" in normalized, false);
  assert.equal(normalized.code, "ECONNREFUSED");
  assert.match(normalized.message, /ECONNREFUSED 127\.0\.0\.1:5432/);
});

test("pruneStaleUploads purges abandoned sessions older than threshold", async () => {
  const stale = await createSubmission({
    id: "sub_stale_1",
    userId: "usr_owner",
    title: "Stale Upload",
    courseCode: "MEE 201",
    department: "Mechanical Engineering",
    level: "200L",
    semester: "First Semester",
    type: "Lecture Note",
    medium: "PDF",
    r2Key: "uploads/mech/MEE201/stale.pdf",
    status: "UPLOADING",
  });
  // Backdate createdAt to 3 hours ago
  stale.createdAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const prunedKeys = await pruneStaleUploads(120);
  assert.ok(prunedKeys.includes("uploads/mech/MEE201/stale.pdf"));
});

test("deleteSubmissionWithChecks cascades cleanup across saved bookmarks", async () => {
  const sub = await createSubmission({
    id: "sub_to_delete",
    userId: "usr_owner",
    title: "Obsolete PDF",
    courseCode: "CVE 401",
    department: "Civil Engineering",
    level: "400L",
    semester: "First Semester",
    type: "Lecture Note",
    medium: "PDF",
    status: "PENDING_REVIEW",
  });

  await addSavedResource({
    userId: "usr_owner",
    resourceId: sub.id,
    title: sub.title,
    courseCode: sub.courseCode,
    department: sub.department,
    type: sub.type,
  });

  const savedBefore = await getSavedResources("usr_owner");
  assert.ok(savedBefore.some((s) => s.resourceId === sub.id));

  await deleteSubmissionWithChecks({ userId: "usr_owner", role: "STUDENT" }, sub.id);

  const savedAfter = await getSavedResources("usr_owner");
  assert.equal(savedAfter.some((s) => s.resourceId === sub.id), false);
});

test("getClientIp prefers edge headers and uses first IP in x-forwarded-for chain", () => {
  const cfReq = new Request("http://localhost", {
    headers: { "cf-connecting-ip": "197.210.85.12" },
  });
  assert.equal(getClientIp(cfReq), "197.210.85.12");

  const xffReq = new Request("http://localhost", {
    headers: { "x-forwarded-for": "102.89.34.1, 10.0.0.1, 127.0.0.1" },
  });
  assert.equal(getClientIp(xffReq), "102.89.34.1");
});

test("extractYouTubeId and extractYoutubeId resolve standard and edge URLs consistently", () => {
  const standard = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const short = "https://youtu.be/dQw4w9WgXcQ";
  const embed = "https://www.youtube.com/embed/dQw4w9WgXcQ";
  const shorts = "https://www.youtube.com/shorts/dQw4w9WgXcQ";
  const rawId = "dQw4w9WgXcQ";
  const invalid = "https://example.com/not-youtube";

  assert.equal(extractYouTubeId(standard), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeId(short), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeId(embed), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeId(shorts), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeId(rawId), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeId(invalid), null);
  assert.equal(extractYouTubeId(null), null);
  assert.equal(extractYouTubeId(""), null);

  // Alias contract
  assert.equal(extractYoutubeId(standard), "dQw4w9WgXcQ");
  assert.equal(extractYoutubeId(invalid), undefined);
});

test("Department registry and resolution enforce strict naming and slug lookup", () => {
  assert.equal(DEPARTMENTS.length, 5);
  assert.ok(DEPARTMENTS.includes("Civil Engineering"));
  assert.ok(DEPARTMENTS.includes("Mechanical Engineering"));

  const civil = getDepartmentBySlug("civil");
  assert.ok(civil);
  assert.equal(civil.id, "CVE");
  assert.equal(civil.name, "Civil Engineering");

  const resolved = resolveDepartment("cve");
  assert.ok(resolved);
  assert.equal(resolved.slug, "civil");

  assert.equal(getDepartmentBySlug("unknown_dept"), undefined);
});

test("File size parsing and byte calculations handle edge cases", () => {
  assert.equal(parseSizeToBytes("2.5 MB"), 2621440);
  assert.equal(parseSizeToBytes("500 KB"), 512000);
  assert.equal(parseSizeToBytes("1024 B"), 1024);
  assert.equal(parseSizeToBytes("invalid"), null);
  assert.equal(parseSizeToBytes(null), null);
  assert.equal(formatBytes(null), "PDF Document");
  assert.equal(formatBytes(0), "PDF Document");
  assert.equal(formatBytes(1024), "1.0 KB");
  assert.equal(formatBytes(1024 * 1024), "1.00 MB");
});

test("Mock R2 storage allows unauthenticated GET for reading and downloading resources", async () => {
  const { mockR2Store } = await import("@/lib/mock-r2-store");
  const { GET: mockR2Get } = await import("@/app/api/uploads/mock-r2/route");

  const testKey = "uploads/test-sample.pdf";
  const dummyBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  mockR2Store.set(testKey, {
    bytes: dummyBytes,
    sizeBytes: dummyBytes.byteLength,
    uploadedBy: "test-user",
    createdAt: Date.now(),
  });

  const req = new Request(`http://localhost:3000/api/uploads/mock-r2?key=${encodeURIComponent(testKey)}`);
  const res = await mockR2Get(req);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "application/pdf");
  const body = new Uint8Array(await res.arrayBuffer());
  assert.equal(body.byteLength, 5);
});

test("Material categories do not include Textbook, Lab Manual, or Formula Sheet / Summary", async () => {
  const { MATERIAL_CATEGORIES } = await import("@/lib/constants");
  assert.ok(!MATERIAL_CATEGORIES.includes("Textbook" as any));
  assert.ok(!MATERIAL_CATEGORIES.includes("Lab Manual" as any));
  assert.ok(!MATERIAL_CATEGORIES.includes("Formula Sheet / Summary" as any));
  assert.ok(MATERIAL_CATEGORIES.includes("Lecture Note"));
  assert.ok(MATERIAL_CATEGORIES.includes("Past Question"));
  assert.ok(MATERIAL_CATEGORIES.includes("Video Tutorial"));
});

test("Videos are categorized as Video Tutorial", async () => {
  const { MATERIAL_CATEGORIES } = await import("@/lib/constants");
  assert.equal(MATERIAL_CATEGORIES.includes("Video Tutorial"), true);
});

test("File utilities recognize and validate documents, slides, and presentations", async () => {
  const {
    isAllowedDocumentFilename,
    getMimeTypeForFilename,
    verifyDocumentBytes,
    getFileFormatDisplay,
  } = await import("@/lib/file-utils");

  assert.equal(isAllowedDocumentFilename("lecture1.pdf"), true);
  assert.equal(isAllowedDocumentFilename("handout.docx"), true);
  assert.equal(isAllowedDocumentFilename("handout.doc"), true);
  assert.equal(isAllowedDocumentFilename("slides.pptx"), true);
  assert.equal(isAllowedDocumentFilename("presentation.ppt"), true);
  assert.equal(isAllowedDocumentFilename("notes.txt"), true);
  assert.equal(isAllowedDocumentFilename("malicious.exe"), false);
  assert.equal(isAllowedDocumentFilename("script.sh"), false);

  assert.equal(getMimeTypeForFilename("slides.pptx"), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  assert.equal(getMimeTypeForFilename("notes.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(getMimeTypeForFilename("handout.pdf"), "application/pdf");

  // PPTX / DOCX Zip signature PK\x03\x04
  const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
  assert.equal(verifyDocumentBytes(zipBytes, "slides.pptx").valid, true);
  assert.equal(verifyDocumentBytes(zipBytes, "notes.docx").valid, true);

  // PDF signature %PDF-
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  assert.equal(verifyDocumentBytes(pdfBytes, "doc.pdf").valid, true);

  const display = getFileFormatDisplay("week4_lecture.pptx");
  assert.equal(display.isPresentation, true);
  assert.equal(display.extension, "PPTX");
});

test("Cron cleanup enforces fail-closed authorization when CRON_SECRET is set", async () => {
  const { GET: cleanupHandler } = await import("@/app/api/cron/cleanup/route");

  process.env.CRON_SECRET = "super_secure_cron_secret_key_12345";

  // Request without auth header should fail
  const unauthReq = new Request("http://localhost/api/cron/cleanup");
  const unauthRes = await cleanupHandler(unauthReq);
  assert.equal(unauthRes.status, 401);

  // Request with invalid token should fail
  const badAuthReq = new Request("http://localhost/api/cron/cleanup", {
    headers: { authorization: "Bearer wrong_secret" },
  });
  const badAuthRes = await cleanupHandler(badAuthReq);
  assert.equal(badAuthRes.status, 401);

  // Request with valid secret should succeed
  const validReq = new Request("http://localhost/api/cron/cleanup", {
    headers: { authorization: "Bearer super_secure_cron_secret_key_12345" },
  });
  const validRes = await cleanupHandler(validReq);
  assert.equal(validRes.status, 200);

  delete process.env.CRON_SECRET;
});

test("Resource reporting rejects non-existent resources with 404", async () => {
  const { POST: reportHandler } = await import("@/app/api/resources/[id]/report/route");

  const req = new Request("http://localhost/api/resources/non_existent_id/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason: "Broken link or corrupted content" }),
  });

  const res = await reportHandler(req, {
    params: Promise.resolve({ id: "non_existent_id" }),
  });
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.error?.code, "NOT_FOUND");
});



