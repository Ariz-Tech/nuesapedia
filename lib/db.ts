import { Pool } from "pg";
import { resolveCourseMetadata, type CourseMetadata } from "./courses";

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password: string;
  department: string;
  level: string;
  avatar: string;
  role: string;
  createdAt: string;
}

export interface DbSavedResource {
  id: string;
  userId: string;
  resourceId: string;
  title: string;
  courseCode: string;
  department: string;
  type: string;
  fileSize: string;
  createdAt: string;
  level?: string;
  semester?: string;
  sessionYear?: string;
  medium?: "PDF" | "YOUTUBE";
  description?: string;
  fileUrl?: string;
  fileName?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  downloads?: number;
}

export interface DbSubmission {
  id: string;
  userId: string;
  title: string;
  courseCode: string;
  department: string;
  level: string;
  semester: string;
  sessionYear?: string;
  type: string;
  medium: "PDF" | "YOUTUBE";
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  r2Key?: string;
  cloudinaryPublicId?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  downloads?: number;
  createdAt: string;
}

export interface DbReadingProgress {
  userId: string;
  resourceId: string;
  percentage: number;
  page: number;
  updatedAt: string;
}

export interface DbMaterialRequest {
  id: string;
  userId?: string;
  requesterName: string;
  courseCode: string;
  department: string;
  level: string;
  type: string;
  details: string;
  status: "OPEN" | "FULFILLED";
  createdAt: string;
}

export interface DbResourceReport {
  id: string;
  resourceId: string;
  resourceTitle: string;
  courseCode: string;
  reason: string;
  details?: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
}

export interface DbCourse extends CourseMetadata {
  resourceCount: number;
}

// In-memory fallback in case PostgreSQL is not yet started by the user locally
const memoryUsers = new Map<string, DbUser>();
const memorySavedResources: DbSavedResource[] = [];
const memorySubmissions: DbSubmission[] = [];
const memoryReadingProgress = new Map<string, DbReadingProgress>();
const memoryMaterialRequests: DbMaterialRequest[] = [];
const memoryResourceReports: DbResourceReport[] = [];

// PostgreSQL connection pool
let pool: Pool | null = null;
let isPostgresInitialized = false;

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
        max: 10,
        idleTimeoutMillis: 30000,
      });

      pool.on("error", (err) => {
        console.error("PostgreSQL client pool error:", err);
      });
    } catch (err) {
      console.error("Failed to construct PostgreSQL connection pool:", err);
      pool = null;
    }
  }
  return pool;
}

/**
 * Initialize PostgreSQL tables and indexes if PostgreSQL is accessible
 */
export async function initDb() {
  if (isPostgresInitialized) return;
  const db = getPool();
  if (!db) {
    if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
      console.error("CRITICAL PRODUCTION CONFIG: DATABASE_URL is not set. Data will not persist permanently across restarts!");
    } else if (!process.env.DATABASE_URL) {
      console.warn("NOTICE (DEV): DATABASE_URL is not set. Running in-memory database fallback (data resets on restart).");
    }
    return;
  }

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        department VARCHAR(255) NOT NULL,
        level VARCHAR(50) NOT NULL DEFAULT '100L',
        avatar TEXT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'STUDENT',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS saved_resources (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        resource_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        course_code VARCHAR(100) NOT NULL,
        department VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'PDF',
        file_size VARCHAR(50) DEFAULT '8.4 MB',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, resource_id)
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        course_code VARCHAR(100) NOT NULL,
        department VARCHAR(255) NOT NULL,
        level VARCHAR(50) NOT NULL,
        semester VARCHAR(50) NOT NULL DEFAULT 'First Semester',
        type VARCHAR(50) NOT NULL DEFAULT 'Lecture Note',
        medium VARCHAR(50) NOT NULL DEFAULT 'PDF',
        description TEXT,
        file_url TEXT,
        file_name VARCHAR(255),
        file_size VARCHAR(50),
        r2_key TEXT,
        cloudinary_public_id TEXT,
        youtube_url TEXT,
        youtube_video_id VARCHAR(50),
        thumbnail_url TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW',
        rejection_reason TEXT,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        reviewed_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
      CREATE INDEX IF NOT EXISTS idx_submissions_dept ON submissions(department);
      CREATE INDEX IF NOT EXISTS idx_submissions_course ON submissions(course_code);
      CREATE INDEX IF NOT EXISTS idx_saved_resources_user ON saved_resources(user_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_approved_filters ON submissions(status, department, level, medium, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_submissions_course_status ON submissions(course_code, status);

      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS downloads INT NOT NULL DEFAULT 0;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS session_year VARCHAR(30);

      CREATE TABLE IF NOT EXISTS reading_progress (
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        resource_id VARCHAR(255) NOT NULL,
        percentage INT NOT NULL DEFAULT 0,
        page INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, resource_id)
      );

      CREATE TABLE IF NOT EXISTS material_requests (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        requester_name VARCHAR(255) NOT NULL DEFAULT 'Student',
        course_code VARCHAR(100) NOT NULL,
        department VARCHAR(255) NOT NULL,
        level VARCHAR(50) NOT NULL DEFAULT '100L',
        type VARCHAR(100) NOT NULL DEFAULT 'Past Question',
        details TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS resource_reports (
        id VARCHAR(255) PRIMARY KEY,
        resource_id VARCHAR(255) NOT NULL,
        resource_title VARCHAR(255) NOT NULL,
        course_code VARCHAR(100) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        details TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    isPostgresInitialized = true;
  } catch (err) {
    console.warn("PostgreSQL initialization warning: operating in fallback mode until database is reachable.", err);
  }
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `SELECT id, name, email, password, department, level, avatar, role, created_at as "createdAt" FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch {
      // Fallback
    }
  }

  // Fallback to in-memory store
  return memoryUsers.get(email.toLowerCase()) || null;
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<DbUser | null> {
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `SELECT id, name, email, password, department, level, avatar, role, created_at as "createdAt" FROM users WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch {
      // Fallback
    }
  }

  for (const user of memoryUsers.values()) {
    if (user.id === id) return user;
  }
  return null;
}

/**
 * Create a new user
 */
export async function createUser(data: {
  id?: string;
  name: string;
  email: string;
  password: string;
  department: string;
  level?: string;
  avatar: string;
  role?: string;
}): Promise<DbUser> {
  const id = data.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const level = data.level || "100L";
  const role = data.role || "STUDENT";
  const createdAt = new Date().toISOString();

  const user: DbUser = {
    id,
    name: data.name,
    email: data.email.toLowerCase(),
    password: data.password,
    department: data.department,
    level,
    avatar: data.avatar,
    role,
    createdAt,
  };

  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      await db.query(
        `INSERT INTO users (id, name, email, password, department, level, avatar, role, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, user.name, user.email, user.password, user.department, user.level, user.avatar, user.role, createdAt]
      );
    } catch (e) {
      console.warn("Postgres insert failed, storing in memory fallback", e);
    }
  }

  memoryUsers.set(user.email, user);

  return user;
}

/**
 * Update user details
 */
export async function updateUser(
  id: string,
  data: Partial<Pick<DbUser, "name" | "department" | "level" | "avatar">>
): Promise<DbUser | null> {
  const existing = await findUserById(id);
  if (!existing) return null;

  const validUpdates: Partial<Pick<DbUser, "name" | "department" | "level" | "avatar">> = {};
  if (data.name !== undefined && data.name !== null) validUpdates.name = data.name;
  if (data.department !== undefined && data.department !== null) validUpdates.department = data.department;
  if (data.level !== undefined && data.level !== null) validUpdates.level = data.level;
  if (data.avatar !== undefined && data.avatar !== null) validUpdates.avatar = data.avatar;

  const updated: DbUser = {
    ...existing,
    ...validUpdates,
    name: validUpdates.name ?? existing.name ?? "Student",
  };

  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      await db.query(
        `UPDATE users SET name = $1, department = $2, level = $3, avatar = $4, updated_at = NOW() WHERE id = $5`,
        [updated.name, updated.department, updated.level, updated.avatar, id]
      );
    } catch {
      // Fallback
    }
  }

  memoryUsers.set(updated.email.toLowerCase(), updated);
  return updated;
}

/**
 * Update user password hash (for Change Password & Forgot Password Reset)
 */
export async function updateUserPassword(userId: string, hashedPassword: string): Promise<boolean> {
  await initDb();
  const existing = await findUserById(userId);
  if (!existing) return false;

  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      await db.query(
        `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`,
        [hashedPassword, userId]
      );
    } catch {
      // Fallback
    }
  }

  existing.password = hashedPassword;
  memoryUsers.set(existing.email.toLowerCase(), existing);
  return true;
}

/**
 * Get user saved resources enriched with full submission metadata (medium, fileUrl, video fields)
 */
export async function getSavedResources(userId: string): Promise<DbSavedResource[]> {
  await initDb();
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `SELECT sr.id,
                sr.user_id as "userId",
                sr.resource_id as "resourceId",
                COALESCE(s.title, sr.title) as title,
                COALESCE(s.course_code, sr.course_code) as "courseCode",
                COALESCE(s.department, sr.department) as department,
                COALESCE(s.type, sr.type) as type,
                COALESCE(s.file_size, sr.file_size) as "fileSize",
                sr.created_at as "createdAt",
                s.level,
                s.semester,
                s.session_year as "sessionYear",
                s.medium,
                s.description,
                s.file_url as "fileUrl",
                s.file_name as "fileName",
                s.youtube_url as "youtubeUrl",
                s.youtube_video_id as "youtubeVideoId",
                s.thumbnail_url as "thumbnailUrl",
                COALESCE(s.downloads, 0) as downloads
         FROM saved_resources sr
         LEFT JOIN submissions s ON s.id = sr.resource_id
         WHERE sr.user_id = $1
         ORDER BY sr.created_at DESC`,
        [userId]
      );
      return res.rows;
    } catch {
      // Fallback
    }
  }

  return memorySavedResources
    .filter((r) => r.userId === userId)
    .map((r) => {
      const sub = memorySubmissions.find((s) => s.id === r.resourceId);
      if (!sub) return r;
      return {
        ...r,
        title: sub.title || r.title,
        courseCode: sub.courseCode || r.courseCode,
        department: sub.department || r.department,
        type: sub.type || r.type,
        fileSize: sub.fileSize || r.fileSize,
        level: sub.level,
        semester: sub.semester,
        medium: sub.medium,
        description: sub.description,
        fileUrl: sub.fileUrl,
        fileName: sub.fileName,
        youtubeUrl: sub.youtubeUrl,
        youtubeVideoId: sub.youtubeVideoId,
        thumbnailUrl: sub.thumbnailUrl,
      };
    });
}

/**
 * Add a saved resource
 */
export async function addSavedResource(data: {
  userId: string;
  resourceId: string;
  title: string;
  courseCode: string;
  department: string;
  type?: string;
  fileSize?: string;
}): Promise<DbSavedResource> {
  const id = `sav_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const item: DbSavedResource = {
    id,
    userId: data.userId,
    resourceId: data.resourceId,
    title: data.title,
    courseCode: data.courseCode,
    department: data.department,
    type: data.type || "PDF",
    fileSize: data.fileSize || "8.4 MB",
    createdAt: new Date().toISOString(),
  };

  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      await db.query(
        `INSERT INTO saved_resources (id, user_id, resource_id, title, course_code, department, type, file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, resource_id) DO NOTHING`,
        [id, item.userId, item.resourceId, item.title, item.courseCode, item.department, item.type, item.fileSize]
      );
    } catch {
      // Fallback
    }
  }

  if (!isPostgresInitialized) {
    const existingIdx = memorySavedResources.findIndex(
      (r) => r.userId === item.userId && r.resourceId === item.resourceId
    );
    if (existingIdx === -1) {
      memorySavedResources.unshift(item);
    }
  }

  return item;
}

/**
 * Remove a saved resource
 */
export async function removeSavedResource(userId: string, resourceId: string): Promise<boolean> {
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      await db.query(`DELETE FROM saved_resources WHERE user_id = $1 AND resource_id = $2`, [
        userId,
        resourceId,
      ]);
    } catch {
      // Fallback
    }
  }

  const idx = memorySavedResources.findIndex(
    (r) => r.userId === userId && r.resourceId === resourceId
  );
  if (idx !== -1) {
    memorySavedResources.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * Get submissions by user ID
 */
export async function getUserSubmissions(userId: string): Promise<DbSubmission[]> {
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `SELECT id, user_id as "userId", title, course_code as "courseCode", department, level, semester, type, medium, description, file_url as "fileUrl", file_name as "fileName", file_size as "fileSize", cloudinary_public_id as "cloudinaryPublicId", youtube_url as "youtubeUrl", youtube_video_id as "youtubeVideoId", thumbnail_url as "thumbnailUrl", status, created_at as "createdAt"
         FROM submissions WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      if (res.rows.length > 0) return res.rows;
    } catch {
      // Fallback
    }
  }

  return memorySubmissions.filter((s) => s.userId === userId);
}

/**
 * Create a new student resource submission (PDF Document or YouTube Video)
 */
export async function createSubmission(data: {
  userId: string;
  title: string;
  courseCode: string;
  department: string;
  level: string;
  semester?: string;
  sessionYear?: string;
  type?: string;
  medium?: "PDF" | "YOUTUBE";
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  r2Key?: string;
  cloudinaryPublicId?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  status?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
}): Promise<DbSubmission> {
  const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const medium = data.medium || (data.youtubeUrl ? "YOUTUBE" : "PDF");
  const item: DbSubmission = {
    id,
    userId: data.userId,
    title: data.title,
    courseCode: data.courseCode,
    department: data.department,
    level: data.level,
    semester: data.semester || "First Semester",
    sessionYear: data.sessionYear || undefined,
    type: data.type || (medium === "YOUTUBE" ? "Video Tutorial" : "Lecture Note"),
    medium,
    description: data.description || "",
    fileUrl: data.fileUrl,
    fileName: data.fileName,
    fileSize: data.fileSize,
    r2Key: data.r2Key,
    cloudinaryPublicId: data.cloudinaryPublicId,
    youtubeUrl: data.youtubeUrl,
    youtubeVideoId: data.youtubeVideoId,
    thumbnailUrl: data.thumbnailUrl,
    status: data.status || "PENDING_REVIEW",
    downloads: 0,
    createdAt: new Date().toISOString(),
  };

  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      await db.query(
        `INSERT INTO submissions (id, user_id, title, course_code, department, level, semester, session_year, type, medium, description, file_url, file_name, file_size, r2_key, cloudinary_public_id, youtube_url, youtube_video_id, thumbnail_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          item.id,
          item.userId,
          item.title,
          item.courseCode,
          item.department,
          item.level,
          item.semester,
          item.sessionYear || null,
          item.type,
          item.medium,
          item.description,
          item.fileUrl || null,
          item.fileName || null,
          item.fileSize || null,
          item.r2Key || null,
          item.cloudinaryPublicId || null,
          item.youtubeUrl || null,
          item.youtubeVideoId || null,
          item.thumbnailUrl || null,
          item.status,
        ]
      );
    } catch {
      // Fallback
    }
  }

  if (!isPostgresInitialized) {
    memorySubmissions.unshift(item);
  }
  return item;
}

/**
 * Delete a submission by user ID and submission ID
 */
export async function deleteSubmission(userId: string, submissionId: string): Promise<boolean> {
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      await db.query(`DELETE FROM submissions WHERE user_id = $1 AND id = $2`, [
        userId,
        submissionId,
      ]);
    } catch {
      // Fallback
    }
  }

  const idx = memorySubmissions.findIndex((s) => s.userId === userId && s.id === submissionId);
  if (idx !== -1) {
    memorySubmissions.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * Get a single submission by its ID
 */
export async function getSubmissionById(submissionId: string): Promise<DbSubmission | null> {
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `SELECT id, user_id as "userId", title, course_code as "courseCode", department, level, semester,
                session_year as "sessionYear", COALESCE(downloads, 0) as downloads,
                type, medium, description, file_url as "fileUrl", file_name as "fileName", file_size as "fileSize",
                r2_key as "r2Key", cloudinary_public_id as "cloudinaryPublicId", youtube_url as "youtubeUrl",
                youtube_video_id as "youtubeVideoId", thumbnail_url as "thumbnailUrl", status,
                rejection_reason as "rejectionReason", reviewed_at as "reviewedAt", reviewed_by as "reviewedBy",
                created_at as "createdAt"
         FROM submissions WHERE id = $1 LIMIT 1`,
        [submissionId]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch {
      // Fallback
    }
  }

  return memorySubmissions.find((s) => s.id === submissionId) || null;
}

/**
 * Get a public academic resource by ID
 */
export async function getResourceById(resourceId: string): Promise<DbSubmission | null> {
  return getSubmissionById(resourceId);
}

/**
 * Update general fields on a submission (e.g. after upload completion)
 */
export async function updateSubmission(
  submissionId: string,
  updates: Partial<DbSubmission>
): Promise<DbSubmission | null> {
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      if (updates.fileUrl !== undefined) {
        fields.push(`file_url = $${i++}`);
        values.push(updates.fileUrl);
      }
      if (updates.r2Key !== undefined) {
        fields.push(`r2_key = $${i++}`);
        values.push(updates.r2Key);
      }
      if (updates.fileSize !== undefined) {
        fields.push(`file_size = $${i++}`);
        values.push(updates.fileSize);
      }
      if (updates.status !== undefined) {
        fields.push(`status = $${i++}`);
        values.push(updates.status);
      }

      if (fields.length > 0) {
        values.push(submissionId);
        const res = await db.query(
          `UPDATE submissions SET ${fields.join(", ")} WHERE id = $${i}
           RETURNING id, user_id as "userId", title, course_code as "courseCode", department, level, semester,
                     type, medium, description, file_url as "fileUrl", file_name as "fileName", file_size as "fileSize",
                     r2_key as "r2Key", cloudinary_public_id as "cloudinaryPublicId", youtube_url as "youtubeUrl",
                     youtube_video_id as "youtubeVideoId", thumbnail_url as "thumbnailUrl", status,
                     rejection_reason as "rejectionReason", reviewed_at as "reviewedAt", reviewed_by as "reviewedBy",
                     created_at as "createdAt"`,
          values
        );
        if (res.rows.length > 0) return res.rows[0];
      }
    } catch {
      // Fallback
    }
  }

  const item = memorySubmissions.find((s) => s.id === submissionId);
  if (!item) return null;

  Object.assign(item, updates);
  return item;
}

/**
 * Get all submissions across all users (with optional status filter) for Moderation
 */
export async function getAllSubmissions(status?: string): Promise<DbSubmission[]> {
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      let query = `
        SELECT id, user_id as "userId", title, course_code as "courseCode", department, level, semester,
               type, medium, description, file_url as "fileUrl", file_name as "fileName", file_size as "fileSize",
               cloudinary_public_id as "cloudinaryPublicId", youtube_url as "youtubeUrl", youtube_video_id as "youtubeVideoId",
               thumbnail_url as "thumbnailUrl", status, rejection_reason as "rejectionReason",
               reviewed_at as "reviewedAt", reviewed_by as "reviewedBy", created_at as "createdAt"
        FROM submissions
      `;
      const params: unknown[] = [];
      if (status && status !== "ALL") {
        query += ` WHERE status = $1`;
        params.push(status);
      }
      query += ` ORDER BY created_at DESC`;

      const res = await db.query(query, params);
      return res.rows;
    } catch {
      // Fallback
    }
  }

  if (status && status !== "ALL") {
    return memorySubmissions.filter((s) => s.status === status);
  }
  return [...memorySubmissions];
}

/**
 * Update the review status of a submission (Approve or Reject)
 */
export async function updateSubmissionStatus(
  submissionId: string,
  status: "APPROVED" | "REJECTED",
  options?: { rejectionReason?: string; reviewedBy?: string }
): Promise<DbSubmission | null> {
  const reviewedAt = new Date().toISOString();
  const rejectionReason = options?.rejectionReason || null;
  const reviewedBy = options?.reviewedBy || null;

  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `UPDATE submissions
         SET status = $1, rejection_reason = $2, reviewed_at = $3, reviewed_by = $4
         WHERE id = $5
         RETURNING id, user_id as "userId", title, course_code as "courseCode", department, level, semester,
                   type, medium, description, file_url as "fileUrl", file_name as "fileName", file_size as "fileSize",
                   cloudinary_public_id as "cloudinaryPublicId", youtube_url as "youtubeUrl", youtube_video_id as "youtubeVideoId",
                   thumbnail_url as "thumbnailUrl", status, rejection_reason as "rejectionReason",
                   reviewed_at as "reviewedAt", reviewed_by as "reviewedBy", created_at as "createdAt"`,
        [status, rejectionReason, reviewedAt, reviewedBy, submissionId]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch {
      // Fallback
    }
  }

  const item = memorySubmissions.find((s) => s.id === submissionId);
  if (!item) return null;

  item.status = status;
  if (rejectionReason) item.rejectionReason = rejectionReason;
  item.reviewedAt = reviewedAt;
  if (reviewedBy) item.reviewedBy = reviewedBy;

  return item;
}

/**
 * Get all registered users (sanitized, excluding passwords) for Admin management
 */
export async function getAllUsers(): Promise<Omit<DbUser, "password">[]> {
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `SELECT id, name, email, department, level, avatar, role, created_at as "createdAt"
         FROM users ORDER BY created_at DESC`
      );
      if (res.rows.length > 0) return res.rows;
    } catch {
      // Fallback
    }
  }

  const list: Omit<DbUser, "password">[] = [];
  for (const user of memoryUsers.values()) {
    list.push({
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      level: user.level,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt,
    });
  }
  return list;
}

/**
 * Update a user's role (STUDENT, MODERATOR, ADMIN)
 */
export async function updateUserRole(userId: string, role: string): Promise<DbUser | null> {
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, name, email, password, department, level, avatar, role, created_at as "createdAt"`,
        [role, userId]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch {
      // Fallback
    }
  }

  for (const user of memoryUsers.values()) {
    if (user.id === userId) {
      user.role = role;
      return user;
    }
  }
  return null;
}

/**
 * Retrieve verified courses with SQL aggregation (O(1) in DB) rather than scanning all rows in JS.
 */
export async function getApprovedCourses(): Promise<DbCourse[]> {
  await initDb();
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(`
        SELECT 
          course_code as "code",
          MAX(department) as "department",
          MAX(level) as "level",
          MAX(semester) as "semester",
          MAX(title) as "latestTitle",
          MAX(description) as "latestDescription",
          COUNT(*)::int as "resourceCount"
        FROM submissions
        WHERE status = 'APPROVED'
        GROUP BY course_code
        ORDER BY course_code ASC
      `);

      if (res.rows.length > 0) {
        return res.rows.map((row) => {
          const meta = resolveCourseMetadata(row.code, {
            title: row.latestTitle,
            department: row.department,
            level: row.level,
            semester: row.semester,
            description: row.latestDescription,
          });
          return {
            ...meta,
            resourceCount: row.resourceCount || 0,
          };
        });
      }
    } catch (err) {
      console.warn("SQL getApprovedCourses error, falling back:", err);
    }
  }

  // In-memory fallback
  const approvedSubmissions = memorySubmissions.filter((s) => s.status === "APPROVED");
  const courseMap = new Map<
    string,
    {
      count: number;
      latestSubmission: DbSubmission;
    }
  >();

  for (const sub of approvedSubmissions) {
    if (!sub.courseCode) continue;
    const code = sub.courseCode.trim().toUpperCase();
    const existing = courseMap.get(code);
    if (!existing) {
      courseMap.set(code, { count: 1, latestSubmission: sub });
    } else {
      existing.count += 1;
    }
  }

  const courses: DbCourse[] = [];
  for (const [code, { count, latestSubmission }] of courseMap.entries()) {
    const meta = resolveCourseMetadata(code, {
      title: latestSubmission.title,
      department: latestSubmission.department,
      level: latestSubmission.level,
      semester: latestSubmission.semester,
      description: latestSubmission.description,
    });

    courses.push({
      ...meta,
      resourceCount: count,
    });
  }

  return courses.sort((a, b) => a.code.localeCompare(b.code));
}

export interface GetResourcesOptions {
  department?: string | null;
  level?: string | null;
  semester?: string | null;
  medium?: string | null;
  category?: string | null;
  query?: string | null;
  page?: number;
  limit?: number;
}

export interface PaginatedResourcesResult {
  resources: DbSubmission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Fetch approved materials with SQL filtering, indexing, and pagination
 */
export async function getApprovedResourcesPaginated(
  options: GetResourcesOptions = {}
): Promise<PaginatedResourcesResult> {
  await initDb();
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(1000, Math.max(1, Number(options.limit) || 500));
  const offset = (page - 1) * limit;

  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const conditions: string[] = ["status = 'APPROVED'"];
      const params: unknown[] = [];
      let i = 1;

      if (options.department && options.department !== "All" && options.department !== "All Departments") {
        conditions.push(`LOWER(department) = LOWER($${i++})`);
        params.push(options.department);
      }
      if (options.level && options.level !== "All" && options.level !== "All Levels") {
        conditions.push(`level = $${i++}`);
        params.push(options.level);
      }
      if (options.semester && options.semester !== "All" && options.semester !== "All Semesters") {
        conditions.push(`LOWER(semester) = LOWER($${i++})`);
        params.push(options.semester);
      }
      if (options.medium && options.medium !== "All" && options.medium !== "ALL") {
        conditions.push(`medium = $${i++}`);
        params.push(options.medium.toUpperCase());
      }
      if (options.category && options.category !== "All" && options.category !== "All Categories") {
        conditions.push(`LOWER(type) LIKE LOWER($${i++})`);
        params.push(`%${options.category}%`);
      }
      if (options.query && options.query.trim()) {
        const q = `%${options.query.trim().toLowerCase()}%`;
        conditions.push(`(LOWER(title) LIKE $${i} OR LOWER(course_code) LIKE $${i} OR LOWER(description) LIKE $${i})`);
        params.push(q);
        i++;
      }

      const whereClause = conditions.join(" AND ");

      const countRes = await db.query(
        `SELECT COUNT(*)::int as total FROM submissions WHERE ${whereClause}`,
        params
      );
      const total = countRes.rows[0]?.total || 0;

      const dataParams = [...params, limit, offset];
      const dataRes = await db.query(
        `SELECT id, user_id as "userId", title, course_code as "courseCode", department, level, semester,
                session_year as "sessionYear", COALESCE(downloads, 0) as downloads,
                type, medium, description, file_url as "fileUrl", file_name as "fileName", file_size as "fileSize",
                cloudinary_public_id as "cloudinaryPublicId", youtube_url as "youtubeUrl", youtube_video_id as "youtubeVideoId",
                thumbnail_url as "thumbnailUrl", status, created_at as "createdAt"
         FROM submissions
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${i++} OFFSET $${i++}`,
        dataParams
      );

      return {
        resources: dataRes.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    } catch (err) {
      console.warn("SQL getApprovedResourcesPaginated error, falling back:", err);
    }
  }

  // In-memory fallback
  const allApproved = memorySubmissions.filter((s) => s.status === "APPROVED");
  const filtered = allApproved.filter((res) => {
    if (options.department && options.department !== "All" && options.department !== "All Departments") {
      if (res.department.toLowerCase() !== options.department.toLowerCase()) return false;
    }
    if (options.level && options.level !== "All" && options.level !== "All Levels") {
      if (res.level !== options.level) return false;
    }
    if (options.semester && options.semester !== "All" && options.semester !== "All Semesters") {
      if ((res.semester || "").toLowerCase() !== options.semester.toLowerCase()) return false;
    }
    if (options.medium && options.medium !== "All" && options.medium !== "ALL") {
      if (res.medium !== options.medium.toUpperCase()) return false;
    }
    if (options.category && options.category !== "All" && options.category !== "All Categories") {
      if (!res.type.toLowerCase().includes(options.category.toLowerCase())) return false;
    }
    if (options.query && options.query.trim()) {
      const q = options.query.trim().toLowerCase();
      const mTitle = res.title.toLowerCase().includes(q);
      const mCode = res.courseCode.toLowerCase().includes(q);
      const mDesc = (res.description || "").toLowerCase().includes(q);
      if (!mTitle && !mCode && !mDesc) return false;
    }
    return true;
  });

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    resources: paginated,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Student Material Requests (for missing textbooks, past questions, or handouts)
 */
export async function createMaterialRequest(data: {
  userId?: string;
  requesterName?: string;
  courseCode: string;
  department: string;
  level: string;
  type: string;
  details?: string;
}): Promise<DbMaterialRequest> {
  await initDb();
  const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const item: DbMaterialRequest = {
    id,
    userId: data.userId,
    requesterName: (data.requesterName || "Engineering Student").trim(),
    courseCode: data.courseCode.trim().toUpperCase(),
    department: data.department.trim(),
    level: data.level.trim() || "100L",
    type: data.type.trim() || "Past Question",
    details: (data.details || "").trim(),
    status: "OPEN",
    createdAt: new Date().toISOString(),
  };

  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      await db.query(
        `INSERT INTO material_requests (id, user_id, requester_name, course_code, department, level, type, details, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.id,
          item.userId || null,
          item.requesterName,
          item.courseCode,
          item.department,
          item.level,
          item.type,
          item.details,
          item.status,
          item.createdAt,
        ]
      );
      return item;
    } catch {
      // Fallback
    }
  }

  memoryMaterialRequests.unshift(item);
  return item;
}

export async function getMaterialRequests(status?: string): Promise<DbMaterialRequest[]> {
  await initDb();
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      let query = `
        SELECT id, user_id as "userId", requester_name as "requesterName",
               course_code as "courseCode", department, level, type, details,
               status, created_at as "createdAt"
        FROM material_requests
      `;
      const params: unknown[] = [];
      if (status && status !== "ALL") {
        query += ` WHERE status = $1`;
        params.push(status);
      }
      query += ` ORDER BY created_at DESC`;
      const res = await db.query(query, params);
      return res.rows;
    } catch {
      // Fallback
    }
  }

  if (status && status !== "ALL") {
    return memoryMaterialRequests.filter((r) => r.status === status);
  }
  return [...memoryMaterialRequests];
}

export async function updateMaterialRequestStatus(
  id: string,
  status: "OPEN" | "FULFILLED"
): Promise<DbMaterialRequest | null> {
  await initDb();
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `UPDATE material_requests
         SET status = $1
         WHERE id = $2
         RETURNING id, user_id as "userId", requester_name as "requesterName",
                   course_code as "courseCode", department, level, type, details,
                   status, created_at as "createdAt"`,
        [status, id]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch {
      // Fallback
    }
  }

  const found = memoryMaterialRequests.find((r) => r.id === id);
  if (!found) return null;
  found.status = status;
  return found;
}

/**
 * Resource Issue Reports (broken PDF, wrong course code, illegible scan)
 */
export async function createResourceReport(data: {
  resourceId: string;
  resourceTitle: string;
  courseCode: string;
  reason: string;
  details?: string;
}): Promise<DbResourceReport> {
  await initDb();
  const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const item: DbResourceReport = {
    id,
    resourceId: data.resourceId,
    resourceTitle: data.resourceTitle.trim(),
    courseCode: data.courseCode.trim().toUpperCase(),
    reason: data.reason.trim(),
    details: (data.details || "").trim(),
    status: "OPEN",
    createdAt: new Date().toISOString(),
  };

  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      await db.query(
        `INSERT INTO resource_reports (id, resource_id, resource_title, course_code, reason, details, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          item.id,
          item.resourceId,
          item.resourceTitle,
          item.courseCode,
          item.reason,
          item.details || null,
          item.status,
          item.createdAt,
        ]
      );
      return item;
    } catch {
      // Fallback
    }
  }

  memoryResourceReports.unshift(item);
  return item;
}

export async function getResourceReports(status?: string): Promise<DbResourceReport[]> {
  await initDb();
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      let query = `
        SELECT id, resource_id as "resourceId", resource_title as "resourceTitle",
               course_code as "courseCode", reason, details, status, created_at as "createdAt"
        FROM resource_reports
      `;
      const params: unknown[] = [];
      if (status && status !== "ALL") {
        query += ` WHERE status = $1`;
        params.push(status);
      }
      query += ` ORDER BY created_at DESC`;
      const res = await db.query(query, params);
      return res.rows;
    } catch {
      // Fallback
    }
  }

  if (status && status !== "ALL") {
    return memoryResourceReports.filter((r) => r.status === status);
  }
  return [...memoryResourceReports];
}

export async function resolveResourceReport(id: string): Promise<boolean> {
  await initDb();
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `UPDATE resource_reports SET status = 'RESOLVED' WHERE id = $1`,
        [id]
      );
      if ((res.rowCount || 0) > 0) return true;
    } catch {
      // Fallback
    }
  }

  const found = memoryResourceReports.find((r) => r.id === id);
  if (!found) return false;
  found.status = "RESOLVED";
  return true;
}

/**
 * Increment download counter for a resource submission
 */
export async function incrementResourceDownload(resourceId: string): Promise<number> {
  await initDb();
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `UPDATE submissions
         SET downloads = COALESCE(downloads, 0) + 1
         WHERE id = $1
         RETURNING downloads`,
        [resourceId]
      );
      if (res.rows.length > 0) {
        return Number(res.rows[0].downloads) || 1;
      }
    } catch {
      // Fallback
    }
  }

  const item = memorySubmissions.find((s) => s.id === resourceId);
  if (item) {
    item.downloads = (item.downloads || 0) + 1;
    return item.downloads;
  }
  return 0;
}

/**
 * Upsert reading progress for an authenticated user
 */
export async function upsertReadingProgress(
  userId: string,
  resourceId: string,
  percentage: number,
  page = 1
): Promise<DbReadingProgress> {
  await initDb();
  const clampedPct = Math.max(0, Math.min(100, Math.round(percentage)));
  const clampedPage = Math.max(1, Math.round(page));
  const updatedAt = new Date().toISOString();

  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      await db.query(
        `INSERT INTO reading_progress (user_id, resource_id, percentage, page, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, resource_id)
         DO UPDATE SET percentage = EXCLUDED.percentage, page = EXCLUDED.page, updated_at = EXCLUDED.updated_at`,
        [userId, resourceId, clampedPct, clampedPage, updatedAt]
      );
    } catch {
      // Fallback
    }
  }

  const record: DbReadingProgress = {
    userId,
    resourceId,
    percentage: clampedPct,
    page: clampedPage,
    updatedAt,
  };
  memoryReadingProgress.set(`${userId}:${resourceId}`, record);
  return record;
}

/**
 * Retrieve reading progress for an authenticated user
 */
export async function getUserReadingProgress(
  userId: string,
  resourceId: string
): Promise<DbReadingProgress | null> {
  await initDb();
  const db = getPool();
  if (db && isPostgresInitialized) {
    try {
      const res = await db.query(
        `SELECT user_id as "userId", resource_id as "resourceId", percentage, page, updated_at as "updatedAt"
         FROM reading_progress
         WHERE user_id = $1 AND resource_id = $2
         LIMIT 1`,
        [userId, resourceId]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch {
      // Fallback
    }
  }

  return memoryReadingProgress.get(`${userId}:${resourceId}`) || null;
}

/**
 * Health check helper for GET /api/health
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  mode: "postgresql" | "memory";
}> {
  const db = getPool();
  if (db) {
    try {
      await db.query("SELECT 1");
      return { connected: true, mode: "postgresql" };
    } catch {
      return { connected: false, mode: "memory" };
    }
  }
  return { connected: true, mode: "memory" };
}


