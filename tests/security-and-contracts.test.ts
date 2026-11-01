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
} from "@/lib/api-helpers";
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

  // Rejection clears r2Key and stores rejectionReason
  const rejected = await updateSubmissionStatus(
    pending.id,
    "REJECTED",
    "Admin Reviewer",
    "Corrupted scan pages",
    "usr_mod"
  );
  assert.ok(rejected);
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.r2Key, undefined);
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
