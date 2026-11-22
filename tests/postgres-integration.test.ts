import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET =
    "integration-test-session-secret-key-minimum-32-characters!!";
}
process.env.ADMIN_EMAILS = "pg-admin@fuoye.edu.ng";

test(
  "PostgreSQL full-lifecycle integration: users, deduplication, FTS, bookmarks, progress, reports & cascades",
  { skip: !hasDatabaseUrl ? "DATABASE_URL is not set; skipping PostgreSQL integration test." : false },
  async () => {
    const {
      getPool,
      createUser,
      findUserByEmail,
      findUserProfileById,
      updateUserRole,
      createPasswordResetToken,
      consumePasswordResetToken,
      createSubmission,
      findDuplicateSubmissionByHash,
      findDuplicateSubmissionByYoutubeId,
      updateSubmissionStatus,
      getApprovedResourcesPaginated,
      getApprovedCourses,
      getApprovedResourcesForSitemap,
      incrementResourceDownload,
      addSavedResource,
      getSavedResources,
      upsertReadingProgress,
      getUserResourceReadingProgress,
      createResourceReport,
      resolveResourceReport,
      deleteSubmissionWithChecks,
    } = await import("@/lib/db");
    const { hashPassword, verifyPassword, generateResetToken } = await import("@/lib/auth");

    const suffix = crypto.randomBytes(6).toString("hex");
    const studentEmail = `pg_student_${suffix}@fuoye.edu.ng`;
    const adminEmail = "pg-admin@fuoye.edu.ng";
    const pool = getPool();

    const createdUserIds: string[] = [];
    const createdSubmissionIds: string[] = [];

    try {
      // 1. User creation & ADMIN_EMAILS bootstrap + session_version invalidation
      const student = await createUser({
        name: "Tunde Integration",
        email: studentEmail,
        password: await hashPassword("ThermoPass2026"),
        department: "Mechanical Engineering",
        level: "300L",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Tunde",
      });
      createdUserIds.push(student.id);
      assert.equal(student.role, "STUDENT");
      assert.equal(student.sessionVersion, 1);

      const lookedUp = await findUserByEmail(studentEmail);
      assert.ok(lookedUp);
      assert.equal(lookedUp.id, student.id);

      const profile = await findUserProfileById(student.id);
      assert.ok(profile);
      assert.equal("password" in profile, false);

      const promoted = await updateUserRole(student.id, "MODERATOR");
      assert.ok(promoted);
      assert.equal(promoted.role, "MODERATOR");
      assert.equal(promoted.sessionVersion, 2);

      // 2. Single-use transactional password reset
      const reset = generateResetToken();
      await createPasswordResetToken(student.id, reset.tokenHash, 15);
      const resetUser = await consumePasswordResetToken(
        reset.tokenHash,
        await hashPassword("UpdatedPass2026")
      );
      assert.ok(resetUser);
      assert.equal(resetUser.sessionVersion, 3);
      assert.equal(await verifyPassword("UpdatedPass2026", resetUser.password), true);
      assert.equal(
        await consumePasswordResetToken(reset.tokenHash, await hashPassword("Replay123")),
        null
      );

      // 3. Submission creation + SHA-256 & YouTube deduplication
      const pdfHash = crypto
        .createHash("sha256")
        .update(`unique-pdf-bytes-${suffix}`)
        .digest("hex");
      const subId = `sub_pg_${suffix}`;
      const created = await createSubmission({
        id: subId,
        userId: student.id,
        title: `Heat Exchangers Lecture Pack ${suffix}`,
        courseCode: "MEE 301",
        department: "Mechanical Engineering",
        level: "300L",
        semester: "First Semester",
        type: "Lecture Note",
        medium: "PDF",
        description: "LMTD, NTU effectiveness, shell-and-tube exchanger calculations.",
        fileName: "heat_exchangers.pdf",
        fileSize: "1.50 MB",
        fileSizeBytes: 1_572_864,
        fileHash: pdfHash,
        r2Key: `uploads/mechanical/MEE301/${subId}_heat_exchangers.pdf`,
        status: "PENDING_REVIEW",
      });
      createdSubmissionIds.push(created.id);
      assert.equal(created.fileHash, pdfHash);

      const dupHash = await findDuplicateSubmissionByHash(pdfHash);
      assert.ok(dupHash);
      assert.equal(dupHash.id, subId);
      assert.equal(await findDuplicateSubmissionByHash(pdfHash, subId), null);

      const ytId = `yt${suffix.slice(0, 9)}`;
      const ytSub = await createSubmission({
        id: `sub_yt_${suffix}`,
        userId: student.id,
        title: `Rankine Cycle Walkthrough ${suffix}`,
        courseCode: "MEE 301",
        department: "Mechanical Engineering",
        level: "300L",
        semester: "First Semester",
        type: "Video Tutorial",
        medium: "YOUTUBE",
        youtubeUrl: `https://www.youtube.com/watch?v=${ytId}`,
        youtubeVideoId: ytId,
        status: "PENDING_REVIEW",
      });
      createdSubmissionIds.push(ytSub.id);

      const dupYt = await findDuplicateSubmissionByYoutubeId(ytId);
      assert.ok(dupYt);
      assert.equal(dupYt.id, ytSub.id);

      // 4. Moderation approval + PostgreSQL FTS + courses aggregation + sitemap projection + downloads
      const approved = await updateSubmissionStatus(
        subId,
        "APPROVED",
        `${adminEmail} (ADMIN)`,
        undefined,
        student.id
      );
      assert.ok(approved);
      assert.equal(approved.status, "APPROVED");

      const searchRes = await getApprovedResourcesPaginated({
        department: "Mechanical Engineering",
        level: "300L",
        query: "exchangers",
      });
      assert.ok(searchRes.resources.some((r) => r.id === subId));

      const courses = await getApprovedCourses("Mechanical Engineering");
      assert.ok(courses.some((c) => c.code === "MEE 301"));

      const sitemapRows = await getApprovedResourcesForSitemap(100);
      assert.ok(sitemapRows.some((r) => r.id === subId));

      const nextDownloads = await incrementResourceDownload(subId);
      assert.equal(nextDownloads, 1);

      // 5. Bookmarks, cross-device reading progress upsert/toggle, and reports
      await addSavedResource({
        userId: student.id,
        resourceId: subId,
        title: created.title,
        courseCode: created.courseCode,
        department: created.department,
        type: created.type,
      });
      const saved = await getSavedResources(student.id);
      assert.ok(saved.some((s) => s.resourceId === subId));

      const p1 = await upsertReadingProgress(student.id, subId, 100, 12);
      assert.equal(p1.percentage, 100);
      assert.equal(p1.page, 12);

      // Ensure un-marking completed persists cleanly
      const p2 = await upsertReadingProgress(student.id, subId, 40, 5);
      assert.equal(p2.percentage, 40);
      assert.equal(p2.page, 5);

      const fetchedProg = await getUserResourceReadingProgress(student.id, subId);
      assert.ok(fetchedProg);
      assert.equal(fetchedProg.percentage, 40);
      assert.equal(fetchedProg.page, 5);

      const report = await createResourceReport({
        resourceId: subId,
        resourceTitle: created.title,
        courseCode: created.courseCode,
        reason: "Corrupted or unreadable document",
        details: "Page 7 diagram is clipped.",
      });
      assert.equal(report.status, "OPEN");

      const resolvedReport = await resolveResourceReport(report.id);
      assert.equal(resolvedReport, true);

      // 6. Cascade deletion cleans up saved_resources, reading_progress, and resource_reports
      const del = await deleteSubmissionWithChecks(
        { userId: student.id, role: "MODERATOR" },
        subId
      );
      assert.equal(del.deleted, true);

      const savedAfter = await getSavedResources(student.id);
      assert.equal(savedAfter.some((s) => s.resourceId === subId), false);
      const progAfter = await getUserResourceReadingProgress(student.id, subId);
      assert.equal(progAfter, null);
    } finally {
      for (const sid of createdSubmissionIds) {
        await pool.query("DELETE FROM submissions WHERE id = $1", [sid]).catch(() => {});
      }
      for (const uid of createdUserIds) {
        await pool.query("DELETE FROM users WHERE id = $1", [uid]).catch(() => {});
      }
      await pool.end();
    }
  }
);
