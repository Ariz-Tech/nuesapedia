import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";

const rootDir = process.cwd();
const buildIdPath = path.join(rootDir, ".next", "BUILD_ID");

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        srv.close();
        reject(new Error("Could not allocate free port"));
        return;
      }
      const { port } = addr;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function waitForServer(baseUrl: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.status === 200 || res.status === 503) {
        return;
      }
    } catch {
      // Server still booting
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Next.js server did not become ready at ${baseUrl} within ${timeoutMs}ms`);
}

function extractSessionCookie(res: Response): string {
  const setCookie =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie().join("; ")
      : res.headers.get("set-cookie") || "";
  const match = setCookie.match(/nuesapedia_session=[^;]+/);
  return match ? match[0] : "";
}

test("Full-stack HTTP E2E flow: signup, upload, deduplication, moderation, catalog, progress, report & SEO", async () => {
  assert.ok(
    fs.existsSync(buildIdPath),
    "Production build (.next/BUILD_ID) not found. Run `npm run build` before `npm run test:e2e`."
  );

  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const suffix = crypto.randomBytes(5).toString("hex");
  const adminEmail = `e2e_admin_${suffix}@fuoye.edu.ng`;
  const studentEmail = `e2e_student_${suffix}@fuoye.edu.ng`;
  const ytVideoId = `E2e${suffix.slice(0, 8)}`;

  const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
  const child: ChildProcess = spawn(
    process.execPath,
    [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: "production",
        APP_URL: baseUrl,
        SESSION_SECRET:
          process.env.SESSION_SECRET ||
          "e2e-only-high-entropy-session-secret-key-minimum-32-chars!!",
        ADMIN_EMAILS: adminEmail,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let stderrLog = "";
  child.stderr?.on("data", (chunk) => {
    stderrLog += String(chunk);
  });

  try {
    await waitForServer(baseUrl);

    // 1. Public pages, SEO endpoints, and branded 404
    const [homeRes, robotsRes, sitemapRes, notFoundRes] = await Promise.all([
      fetch(`${baseUrl}/`),
      fetch(`${baseUrl}/robots.txt`),
      fetch(`${baseUrl}/sitemap.xml`),
      fetch(`${baseUrl}/definitely-missing-page-${suffix}`),
    ]);
    assert.equal(homeRes.status, 200, `Homepage failed: ${stderrLog}`);
    assert.equal(robotsRes.status, 200);
    const robotsText = await robotsRes.text();
    assert.match(robotsText, /Disallow:\s*\/api\//i);
    assert.match(robotsText, /Sitemap:/i);

    assert.equal(sitemapRes.status, 200);
    const sitemapXml = await sitemapRes.text();
    assert.match(sitemapXml, /<urlset/);
    assert.match(sitemapXml, /\/resources/);

    assert.equal(notFoundRes.status, 404);
    const notFoundHtml = await notFoundRes.text();
    assert.match(notFoundHtml, /404/i);

    // 2. If DATABASE_URL is absent in production mode, auth/DB routes require Postgres; skip stateful DB steps cleanly.
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    if (!healthJson?.checks?.database?.connected) {
      return;
    }

    // 3. Student signup & session verification
    const studentSignupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Chidi E2E Student",
        email: studentEmail,
        password: "StrongPassword2026",
        department: "Civil Engineering",
        level: "300L",
      }),
    });
    assert.equal(studentSignupRes.status, 201);
    const studentCookie = extractSessionCookie(studentSignupRes);
    assert.ok(studentCookie.startsWith("nuesapedia_session="));

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: studentCookie },
    });
    assert.equal(meRes.status, 200);
    const meJson = await meRes.json();
    assert.equal(meJson.user.email, studentEmail);
    assert.equal(meJson.user.role, "STUDENT");

    // 4. Student uploads a YouTube tutorial -> PENDING_REVIEW
    const uploadRes = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        title: `E2E Structural Analysis Lecture ${suffix}`,
        courseCode: "CVE 301",
        department: "Civil Engineering",
        level: "300L",
        semester: "First Semester",
        type: "Video Tutorial",
        medium: "YOUTUBE",
        youtubeUrl: `https://www.youtube.com/watch?v=${ytVideoId}`,
        description: "End-to-end automated verification lecture.",
      }),
    });
    assert.equal(uploadRes.status, 201);
    const uploadJson = await uploadRes.json();
    const submissionId: string = uploadJson.submission.id;
    assert.equal(uploadJson.submission.status, "PENDING_REVIEW");

    // 5. Duplicate YouTube submission must be rejected with 409 DUPLICATE_RESOURCE
    const dupRes = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        title: "Duplicate Attempt",
        courseCode: "CVE 301",
        department: "Civil Engineering",
        level: "300L",
        semester: "First Semester",
        type: "Video Tutorial",
        medium: "YOUTUBE",
        youtubeUrl: `https://youtu.be/${ytVideoId}`,
      }),
    });
    assert.equal(dupRes.status, 409);
    const dupJson = await dupRes.json();
    assert.equal(dupJson.error?.code, "DUPLICATE_RESOURCE");

    // 6. Admin signup & moderation approval
    const adminSignupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Faculty Admin E2E",
        email: adminEmail,
        password: "AdminPassword2026",
        department: "Civil Engineering",
        level: "500L",
      }),
    });
    assert.equal(adminSignupRes.status, 201);
    const adminCookie = extractSessionCookie(adminSignupRes);
    assert.ok(adminCookie);

    const approveRes = await fetch(`${baseUrl}/api/moderation`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        submissionId,
        status: "APPROVED",
      }),
    });
    assert.equal(approveRes.status, 200);

    // 7. Public catalog search & resource reader SSR page
    const catalogRes = await fetch(
      `${baseUrl}/api/resources?q=${encodeURIComponent(suffix)}`
    );
    assert.equal(catalogRes.status, 200);
    const catalogJson = await catalogRes.json();
    assert.ok(
      catalogJson.resources.some((r: { id: string }) => r.id === submissionId),
      "Approved resource should appear in public catalog search"
    );

    const readerRes = await fetch(`${baseUrl}/resources/${encodeURIComponent(submissionId)}`);
    assert.equal(readerRes.status, 200);

    // 8. Cross-device reading progress sync (PUT + GET)
    const progPut = await fetch(
      `${baseUrl}/api/resources/${encodeURIComponent(submissionId)}/progress`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: studentCookie,
        },
        body: JSON.stringify({ percentage: 65, page: 7 }),
      }
    );
    assert.equal(progPut.status, 200);

    const progGet = await fetch(
      `${baseUrl}/api/resources/${encodeURIComponent(submissionId)}/progress`,
      {
        headers: { Cookie: studentCookie },
      }
    );
    assert.equal(progGet.status, 200);
    const progJson = await progGet.json();
    assert.equal(progJson.progress.percentage, 65);
    assert.equal(progJson.progress.page, 7);

    // 9. Student issue report + Moderator resolution
    const reportRes = await fetch(
      `${baseUrl}/api/resources/${encodeURIComponent(submissionId)}/report`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Broken video link",
          details: "Automated E2E report check.",
        }),
      }
    );
    assert.equal(reportRes.status, 201);
    const reportJson = await reportRes.json();
    const reportId: string = reportJson.report.id;

    const resolveRes = await fetch(`${baseUrl}/api/moderation/reports`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ reportId }),
    });
    assert.equal(resolveRes.status, 200);

    // 10. Cleanup test submission via admin DELETE & verify logout revokes cookie
    const deleteRes = await fetch(
      `${baseUrl}/api/resources/${encodeURIComponent(submissionId)}`,
      {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      }
    );
    assert.equal(deleteRes.status, 200);

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    assert.equal(logoutRes.status, 200);
  } finally {
    child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 300));
    if (!child.killed) child.kill("SIGKILL");
  }
});
