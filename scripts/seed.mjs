import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");

if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error(
    "ERROR: DATABASE_URL is not set. Set DATABASE_URL to a PostgreSQL instance before running `npm run db:seed`."
  );
  process.exit(1);
}

function hashPasswordScrypt(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

const configuredAdmins = (process.env.ADMIN_EMAILS || "admin@fuoye.edu.ng")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const adminEmail = configuredAdmins[0] || "admin@fuoye.edu.ng";
const seedPassword =
  process.env.SEED_ADMIN_PASSWORD?.trim() ||
  (process.env.NODE_ENV === "production" ? "" : "NuesaAdmin2026!");

if (!seedPassword) {
  console.error(
    "ERROR: SEED_ADMIN_PASSWORD must be explicitly set when seeding in production."
  );
  process.exit(1);
}

const STARTER_RESOURCES = [
  {
    id: "seed_cve_201_vid",
    title: "Strength of Materials: Shear Force & Bending Moment Diagrams",
    courseCode: "CVE 201",
    department: "Civil Engineering",
    level: "200L",
    semester: "First Semester",
    sessionYear: "2025/2026",
    type: "Video Tutorial",
    medium: "YOUTUBE",
    description:
      "Step-by-step worked examples on constructing shear force and bending moment diagrams for simply supported and cantilever beams.",
    youtubeVideoId: "C-FEVzI8oe8",
  },
  {
    id: "seed_mee_301_vid",
    title: "Thermodynamics II: Rankine & Brayton Power Cycles Explained",
    courseCode: "MEE 301",
    department: "Mechanical Engineering",
    level: "300L",
    semester: "First Semester",
    sessionYear: "2025/2026",
    type: "Video Tutorial",
    medium: "YOUTUBE",
    description:
      "Comprehensive revision lecture covering vapor power cycles, thermal efficiency, and heat exchanger effectiveness.",
    youtubeVideoId: "8N1BxHgsojg",
  },
  {
    id: "seed_mme_201_vid",
    title: "Materials Science: Crystal Structures, Unit Cells & Iron-Carbon Phase Diagram",
    courseCode: "MME 201",
    department: "Materials and Metallurgical Engineering",
    level: "200L",
    semester: "First Semester",
    sessionYear: "2025/2026",
    type: "Video Tutorial",
    medium: "YOUTUBE",
    description:
      "Visual guide to BCC, FCC, HCP crystal lattices, Miller indices, and eutectic/eutectoid phase transformations.",
    youtubeVideoId: "kY2R1v3fG9E",
  },
  {
    id: "seed_abe_301_vid",
    title: "Fluid Mechanics & Open Channel Hydraulics — Bernoulli & Manning Applications",
    courseCode: "ABE 301",
    department: "Agric and Bio Resources Engineering",
    level: "300L",
    semester: "First Semester",
    sessionYear: "2025/2026",
    type: "Video Tutorial",
    medium: "YOUTUBE",
    description:
      "Foundational hydraulics walkthrough for agricultural watershed channels, head loss, and flow measurement.",
    youtubeVideoId: "clVwKynHpB0",
  },
  {
    id: "seed_mne_301_vid",
    title: "Introduction to Surface Mining, Blasting Design & Rock Mechanics",
    courseCode: "MNE 301",
    department: "Mining Engineering",
    level: "300L",
    semester: "First Semester",
    sessionYear: "2025/2026",
    type: "Video Tutorial",
    medium: "YOUTUBE",
    description:
      "Overview of bench geometry, burden/spacing blast patterns, rock fragmentation, and mine safety standards.",
    youtubeVideoId: "5qap5aO4i9A",
  },
];

const rejectUnauthorized =
  process.env.PG_SSL_REJECT_UNAUTHORIZED !== undefined
    ? process.env.PG_SSL_REJECT_UNAUTHORIZED === "true"
    : process.env.NODE_ENV === "production";

const pool = new pg.Pool({
  connectionString,
  ssl:
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized },
});

try {
  console.log("Seeding The NUESA Library PostgreSQL database...");
  const passwordHash = await hashPasswordScrypt(seedPassword);
  const curatorId = "usr_nuesa_curator";

  await pool.query("BEGIN");

  const userRes = await pool.query(
    `INSERT INTO users (id, name, email, password, department, level, avatar, role, session_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'ADMIN', 1)
     ON CONFLICT (email) DO UPDATE SET role = 'ADMIN'
     RETURNING id, email`,
    [
      curatorId,
      "NUESA Faculty Curator",
      adminEmail,
      passwordHash,
      "Civil Engineering",
      "500L",
      "https://api.dicebear.com/7.x/bottts/svg?seed=NUESACurator",
    ]
  );

  const effectiveAdminId = userRes.rows[0].id;
  let insertedCount = 0;

  for (const item of STARTER_RESOURCES) {
    const youtubeUrl = `https://www.youtube.com/watch?v=${item.youtubeVideoId}`;
    const thumbnailUrl = `https://img.youtube.com/vi/${item.youtubeVideoId}/hqdefault.jpg`;

    const res = await pool.query(
      `INSERT INTO submissions (
        id, user_id, title, course_code, department, level, semester, session_year,
        type, medium, description, file_url, file_size, youtube_url, youtube_video_id,
        thumbnail_url, status, reviewed_at, reviewed_by, reviewed_by_id, downloads
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, 'Streaming Video', $13, $14,
        $15, 'APPROVED', CURRENT_TIMESTAMP, 'NUESA Faculty Curator (ADMIN)', $2, 0
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id`,
      [
        item.id,
        effectiveAdminId,
        item.title,
        item.courseCode,
        item.department,
        item.level,
        item.semester,
        item.sessionYear,
        item.type,
        item.medium,
        item.description,
        youtubeUrl,
        youtubeUrl,
        item.youtubeVideoId,
        thumbnailUrl,
      ]
    );
    if ((res.rowCount ?? 0) > 0) insertedCount += 1;
  }

  await pool.query("COMMIT");
  console.log(
    `Seed complete: curator ${userRes.rows[0].email} ready, ${insertedCount} starter resource(s) inserted (${STARTER_RESOURCES.length - insertedCount} already present).`
  );
} catch (err) {
  try {
    await pool.query("ROLLBACK");
  } catch {
    // Ignore rollback failure
  }
  console.error("Seed failed:", err?.message || err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
