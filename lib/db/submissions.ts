import crypto from "node:crypto";
import { cache } from "react";
import { COURSE_REGISTRY, resolveCourseMetadata } from "../courses";
import { parseSizeToBytes } from "../api-helpers";
import { devStore, getReadyDb, isDevMemoryMode } from "./pool";
import type {
  DbCourse,
  DbReadingProgress,
  DbSubmission,
  GetResourcesOptions,
  PaginatedResourcesResult,
  SubmissionStatus,
} from "./types";

export interface SubmissionAccessActor {
  userId: string;
  role: string;
}

/**
 * Enforces moderation boundaries: only APPROVED submissions are public.
 * Unapproved/rejected submissions are restricted to their uploader or moderators/admins.
 */
export function canAccessSubmission(
  submission: Pick<DbSubmission, "status" | "userId">,
  actor: SubmissionAccessActor | null | undefined
): boolean {
  if (submission.status === "APPROVED") return true;
  if (!actor) return false;
  if (actor.role === "ADMIN" || actor.role === "MODERATOR") return true;
  return actor.userId === submission.userId;
}

export function mapSubmissionRow(row: Record<string, unknown>): DbSubmission {
  const id = String(row.id);
  const medium = (row.medium === "YOUTUBE" ? "YOUTUBE" : "PDF") as "PDF" | "YOUTUBE";
  const r2Key = row.r2_key ? String(row.r2_key) : row.r2Key ? String(row.r2Key) : undefined;
  const rawFileUrl = row.file_url
    ? String(row.file_url)
    : row.fileUrl
      ? String(row.fileUrl)
      : undefined;

  // Never expose stale/expiring pre-signed S3 URLs stored in DB rows;
  // route all R2-backed PDFs through the status-checked on-demand view endpoint.
  const canonicalFileUrl =
    medium === "PDF" && r2Key ? `/api/resources/${id}/view` : rawFileUrl;

  const bytesVal = row.file_size_bytes ?? row.fileSizeBytes;
  const fileSizeBytes =
    bytesVal !== null && bytesVal !== undefined && Number.isFinite(Number(bytesVal))
      ? Number(bytesVal)
      : null;

  return {
    id,
    userId: String(row.user_id ?? row.userId ?? ""),
    title: String(row.title ?? ""),
    courseCode: String(row.course_code ?? row.courseCode ?? ""),
    department: String(row.department ?? ""),
    level: String(row.level ?? ""),
    semester: String(row.semester ?? "First Semester"),
    sessionYear: row.session_year
      ? String(row.session_year)
      : row.sessionYear
        ? String(row.sessionYear)
        : "2025/2026",
    type: String(row.type ?? "Lecture Notes"),
    medium,
    description: row.description ? String(row.description) : undefined,
    fileUrl: canonicalFileUrl,
    fileName: row.file_name
      ? String(row.file_name)
      : row.fileName
        ? String(row.fileName)
        : undefined,
    fileSize: row.file_size
      ? String(row.file_size)
      : row.fileSize
        ? String(row.fileSize)
        : undefined,
    fileSizeBytes,
    r2Key,
    cloudinaryPublicId: row.cloudinary_public_id
      ? String(row.cloudinary_public_id)
      : row.cloudinaryPublicId
        ? String(row.cloudinaryPublicId)
        : undefined,
    youtubeUrl: row.youtube_url
      ? String(row.youtube_url)
      : row.youtubeUrl
        ? String(row.youtubeUrl)
        : undefined,
    youtubeVideoId: row.youtube_video_id
      ? String(row.youtube_video_id)
      : row.youtubeVideoId
        ? String(row.youtubeVideoId)
        : undefined,
    thumbnailUrl: row.thumbnail_url
      ? String(row.thumbnail_url)
      : row.thumbnailUrl
        ? String(row.thumbnailUrl)
        : undefined,
    status: (row.status as SubmissionStatus) || "PENDING_REVIEW",
    rejectionReason: row.rejection_reason
      ? String(row.rejection_reason)
      : row.rejectionReason
        ? String(row.rejectionReason)
        : undefined,
    reviewedAt:
      row.reviewed_at instanceof Date
        ? row.reviewed_at.toISOString()
        : row.reviewed_at
          ? String(row.reviewed_at)
          : row.reviewedAt
            ? String(row.reviewedAt)
            : undefined,
    reviewedBy: row.reviewed_by
      ? String(row.reviewed_by)
      : row.reviewedBy
        ? String(row.reviewedBy)
        : undefined,
    reviewedById: row.reviewed_by_id
      ? String(row.reviewed_by_id)
      : row.reviewedById
        ? String(row.reviewedById)
        : null,
    downloads: Number(row.downloads ?? 0),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

export async function getUserSubmissions(userId: string): Promise<DbSubmission[]> {
  if (isDevMemoryMode()) {
    return devStore.submissions.filter(
      (s) => s.userId === userId && s.status !== "UPLOADING"
    );
  }

  const db = await getReadyDb();
  const res = await db.query(
    `SELECT * FROM submissions
     WHERE user_id = $1 AND status <> 'UPLOADING'
     ORDER BY created_at DESC
     LIMIT 200`,
    [userId]
  );

  return res.rows.map(mapSubmissionRow);
}

export async function createSubmission(data: {
  id?: string;
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
  fileSizeBytes?: number | null;
  r2Key?: string;
  cloudinaryPublicId?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  status?: SubmissionStatus;
}): Promise<DbSubmission> {
  const id = data.id || `sub_${crypto.randomBytes(8).toString("hex")}`;
  const createdAt = new Date().toISOString();
  const status: SubmissionStatus = data.status || "PENDING_REVIEW";
  const fileSizeBytes =
    data.fileSizeBytes ?? parseSizeToBytes(data.fileSize) ?? null;

  const canonicalFileUrl =
    data.medium === "PDF" && data.r2Key
      ? `/api/resources/${id}/view`
      : data.fileUrl;

  const item: DbSubmission = {
    id,
    userId: data.userId,
    title: data.title,
    courseCode: data.courseCode,
    department: data.department,
    level: data.level,
    semester: data.semester,
    sessionYear: data.sessionYear || "2025/2026",
    type: data.type,
    medium: data.medium,
    description: data.description,
    fileUrl: canonicalFileUrl,
    fileName: data.fileName,
    fileSize: data.fileSize,
    fileSizeBytes,
    r2Key: data.r2Key,
    cloudinaryPublicId: data.cloudinaryPublicId,
    youtubeUrl: data.youtubeUrl,
    youtubeVideoId: data.youtubeVideoId,
    thumbnailUrl: data.thumbnailUrl,
    status,
    downloads: 0,
    createdAt,
  };

  if (isDevMemoryMode()) {
    devStore.submissions.unshift(item);
    return item;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `INSERT INTO submissions (
      id, user_id, title, course_code, department, level, semester, session_year, type, medium,
      description, file_url, file_name, file_size, file_size_bytes, r2_key, cloudinary_public_id,
      youtube_url, youtube_video_id, thumbnail_url, status, downloads
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17,
      $18, $19, $20, $21, 0
    )
    RETURNING *`,
    [
      item.id,
      item.userId,
      item.title,
      item.courseCode,
      item.department,
      item.level,
      item.semester,
      item.sessionYear,
      item.type,
      item.medium,
      item.description ?? null,
      item.fileUrl ?? null,
      item.fileName ?? null,
      item.fileSize ?? null,
      item.fileSizeBytes ?? null,
      item.r2Key ?? null,
      item.cloudinaryPublicId ?? null,
      item.youtubeUrl ?? null,
      item.youtubeVideoId ?? null,
      item.thumbnailUrl ?? null,
      item.status,
    ]
  );

  return mapSubmissionRow(res.rows[0]);
}

export interface DeleteSubmissionResult {
  deleted: boolean;
  r2Key?: string;
  reason?: "NOT_FOUND" | "FORBIDDEN" | "ALREADY_APPROVED";
}

export async function deleteSubmissionWithChecks(
  actor: SubmissionAccessActor,
  submissionId: string
): Promise<DeleteSubmissionResult> {
  const existing = await getSubmissionById(submissionId);
  if (!existing) {
    return { deleted: false, reason: "NOT_FOUND" };
  }

  const isPrivileged = actor.role === "ADMIN" || actor.role === "MODERATOR";
  if (!isPrivileged) {
    if (existing.userId !== actor.userId) {
      return { deleted: false, reason: "FORBIDDEN" };
    }
    if (existing.status === "APPROVED") {
      return { deleted: false, reason: "ALREADY_APPROVED" };
    }
  }

  if (isDevMemoryMode()) {
    const idx = devStore.submissions.findIndex((s) => s.id === submissionId);
    if (idx !== -1) devStore.submissions.splice(idx, 1);
    // Cascade delete related records in dev memory mode
    devStore.savedResources = devStore.savedResources.filter((s) => s.resourceId !== submissionId);
    for (const [key, prog] of devStore.readingProgress.entries()) {
      if (prog.resourceId === submissionId) devStore.readingProgress.delete(key);
    }
    devStore.resourceReports = devStore.resourceReports.filter((r) => r.resourceId !== submissionId);
    return { deleted: true, r2Key: existing.r2Key };
  }

  const db = await getReadyDb();
  await db.query(`DELETE FROM saved_resources WHERE resource_id = $1`, [submissionId]);
  await db.query(`DELETE FROM reading_progress WHERE resource_id = $1`, [submissionId]);
  await db.query(`DELETE FROM resource_reports WHERE resource_id = $1`, [submissionId]);

  const res = await db.query(
    `DELETE FROM submissions WHERE id = $1 RETURNING id`,
    [submissionId]
  );

  return {
    deleted: (res.rowCount ?? 0) > 0,
    r2Key: existing.r2Key,
  };
}

/**
 * Prunes orphaned upload sessions stuck in 'UPLOADING' state past maxAgeMinutes.
 * Returns the storage keys so the caller can garbage-collect associated R2 objects.
 */
export async function pruneStaleUploads(maxAgeMinutes: number = 120): Promise<string[]> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

  if (isDevMemoryMode()) {
    const prunedKeys: string[] = [];
    devStore.submissions = devStore.submissions.filter((s) => {
      if (s.status === "UPLOADING" && s.createdAt < cutoff) {
        if (s.r2Key) prunedKeys.push(s.r2Key);
        return false;
      }
      return true;
    });
    return prunedKeys;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `DELETE FROM submissions
     WHERE status = 'UPLOADING'
       AND created_at < $1::timestamptz
     RETURNING r2_key`,
    [cutoff]
  );

  return res.rows
    .map((r) => r.r2_key)
    .filter((k): k is string => typeof k === "string" && k.length > 0);
}

export async function deleteSubmission(
  userId: string,
  submissionId: string
): Promise<boolean> {
  const result = await deleteSubmissionWithChecks(
    { userId, role: "STUDENT" },
    submissionId
  );
  return result.deleted;
}

export const getSubmissionById = cache(async function getSubmissionById(
  submissionId: string
): Promise<DbSubmission | null> {
  if (isDevMemoryMode()) {
    return devStore.submissions.find((s) => s.id === submissionId) || null;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `SELECT * FROM submissions WHERE id = $1 LIMIT 1`,
    [submissionId]
  );

  return res.rows[0] ? mapSubmissionRow(res.rows[0]) : null;
});

export async function getResourceById(
  resourceId: string
): Promise<DbSubmission | null> {
  return getSubmissionById(resourceId);
}

export async function updateSubmission(
  submissionId: string,
  updates: Partial<{
    title: string;
    courseCode: string;
    department: string;
    level: string;
    semester: string;
    sessionYear: string;
    type: string;
    description: string;
    fileUrl: string;
    fileName: string;
    fileSize: string;
    fileSizeBytes: number | null;
    r2Key: string;
    status: SubmissionStatus;
  }>
): Promise<DbSubmission | null> {
  if (isDevMemoryMode()) {
    const idx = devStore.submissions.findIndex((s) => s.id === submissionId);
    if (idx === -1) return null;
    const current = devStore.submissions[idx];
    const updated: DbSubmission = {
      ...current,
      ...updates,
    };
    if (updated.medium === "PDF" && updated.r2Key) {
      updated.fileUrl = `/api/resources/${updated.id}/view`;
    }
    devStore.submissions[idx] = updated;
    return updated;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `UPDATE submissions
     SET title = COALESCE($1, title),
         course_code = COALESCE($2, course_code),
         department = COALESCE($3, department),
         level = COALESCE($4, level),
         semester = COALESCE($5, semester),
         session_year = COALESCE($6, session_year),
         type = COALESCE($7, type),
         description = COALESCE($8, description),
         file_url = COALESCE($9, file_url),
         file_name = COALESCE($10, file_name),
         file_size = COALESCE($11, file_size),
         file_size_bytes = COALESCE($12, file_size_bytes),
         r2_key = COALESCE($13, r2_key),
         status = COALESCE($14, status)
     WHERE id = $15
     RETURNING *`,
    [
      updates.title ?? null,
      updates.courseCode ?? null,
      updates.department ?? null,
      updates.level ?? null,
      updates.semester ?? null,
      updates.sessionYear ?? null,
      updates.type ?? null,
      updates.description ?? null,
      updates.fileUrl ?? null,
      updates.fileName ?? null,
      updates.fileSize ?? null,
      updates.fileSizeBytes ?? null,
      updates.r2Key ?? null,
      updates.status ?? null,
      submissionId,
    ]
  );

  return res.rows[0] ? mapSubmissionRow(res.rows[0]) : null;
}

export async function getAllSubmissions(
  status?: string,
  options?: { limit?: number; offset?: number }
): Promise<DbSubmission[]> {
  const limit = Math.min(Math.max(1, options?.limit ?? 200), 500);
  const offset = Math.max(0, options?.offset ?? 0);

  if (isDevMemoryMode()) {
    const filtered =
      status && status !== "ALL"
        ? devStore.submissions.filter((s) => s.status === status)
        : devStore.submissions.filter((s) => s.status !== "UPLOADING");
    return filtered.slice(offset, offset + limit);
  }

  const db = await getReadyDb();
  const res =
    status && status !== "ALL"
      ? await db.query(
          `SELECT * FROM submissions
           WHERE status = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [status, limit, offset]
        )
      : await db.query(
          `SELECT * FROM submissions
           WHERE status <> 'UPLOADING'
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        );

  return res.rows.map(mapSubmissionRow);
}

export async function updateSubmissionStatus(
  id: string,
  status: "APPROVED" | "REJECTED",
  reviewedBy: string,
  rejectionReason?: string,
  reviewedById?: string
): Promise<DbSubmission | null> {
  const reviewedAt = new Date().toISOString();

  if (isDevMemoryMode()) {
    const idx = devStore.submissions.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    devStore.submissions[idx] = {
      ...devStore.submissions[idx],
      status,
      reviewedBy,
      reviewedById: reviewedById ?? null,
      reviewedAt,
      rejectionReason: status === "REJECTED" ? rejectionReason : undefined,
      r2Key: devStore.submissions[idx].r2Key,
    };
    return devStore.submissions[idx];
  }

  const db = await getReadyDb();
  const res = await db.query(
    `UPDATE submissions
     SET status = $1,
         reviewed_by = $2,
         reviewed_by_id = $3,
         reviewed_at = $4::timestamptz,
         rejection_reason = $5
     WHERE id = $6
     RETURNING *`,
    [
      status,
      reviewedBy,
      reviewedById ?? null,
      reviewedAt,
      status === "REJECTED" ? rejectionReason ?? null : null,
      id,
    ]
  );

  return res.rows[0] ? mapSubmissionRow(res.rows[0]) : null;
}

/**
 * Returns courses derived strictly from approved uploaded materials.
 */
export async function getApprovedCourses(): Promise<DbCourse[]> {
  const courseMap = new Map<string, DbCourse>();

  if (isDevMemoryMode()) {
    const approved = devStore.submissions.filter((s) => s.status === "APPROVED");
    for (const s of approved) {
      const normalized = s.courseCode.trim().toUpperCase();
      const existing = courseMap.get(normalized);
      if (existing) {
        existing.resourceCount += 1;
      } else {
        const resolved = resolveCourseMetadata(s.courseCode, {
          department: s.department,
          level: s.level,
          semester: s.semester,
          title: s.title,
        });
        courseMap.set(normalized, { ...resolved, resourceCount: 1 });
      }
    }
    return Array.from(courseMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  }

  const db = await getReadyDb();
  const res = await db.query(
    `WITH counts AS (
       SELECT UPPER(TRIM(course_code)) AS norm_code,
              COUNT(*)::int AS resource_count
       FROM submissions
       WHERE status = 'APPROVED'
       GROUP BY UPPER(TRIM(course_code))
     ),
     latest AS (
       SELECT DISTINCT ON (UPPER(TRIM(course_code)))
              UPPER(TRIM(course_code)) AS norm_code,
              course_code,
              title AS latest_title,
              department,
              level,
              semester
       FROM submissions
       WHERE status = 'APPROVED'
       ORDER BY UPPER(TRIM(course_code)), created_at DESC
     )
     SELECT latest.course_code AS "courseCode",
            latest.latest_title AS "latestTitle",
            latest.department,
            latest.level,
            latest.semester,
            counts.resource_count AS "resourceCount"
     FROM latest
     JOIN counts ON counts.norm_code = latest.norm_code
     ORDER BY latest.norm_code ASC`
  );

  for (const row of res.rows) {
    const resolved = resolveCourseMetadata(String(row.courseCode), {
      department: String(row.department),
      level: String(row.level),
      semester: String(row.semester),
      title: String(row.latestTitle),
    });
    const key = resolved.code.toUpperCase();
    const existing = courseMap.get(key);
    if (existing) {
      existing.resourceCount = Number(row.resourceCount) || 0;
    } else {
      courseMap.set(key, {
        ...resolved,
        resourceCount: Number(row.resourceCount) || 0,
      });
    }
  }

  return Array.from(courseMap.values()).sort((a, b) => a.code.localeCompare(b.code));
}

export async function getApprovedResourcesPaginated(
  options: GetResourcesOptions = {}
): Promise<PaginatedResourcesResult> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 24));
  const offset = (page - 1) * limit;

  if (isDevMemoryMode()) {
    let items = devStore.submissions.filter((s) => s.status === "APPROVED");
    if (options.department && options.department !== "ALL" && options.department !== "All") {
      const dept = options.department.toLowerCase();
      items = items.filter((s) => s.department.toLowerCase() === dept);
    }
    if (options.level && options.level !== "ALL" && options.level !== "All") {
      items = items.filter((s) => s.level.toLowerCase() === options.level!.toLowerCase());
    }
    if (options.semester && options.semester !== "ALL" && options.semester !== "All") {
      items = items.filter(
        (s) => s.semester.toLowerCase() === options.semester!.toLowerCase()
      );
    }
    if (options.courseCode && options.courseCode !== "ALL") {
      const code = options.courseCode.trim().toLowerCase();
      items = items.filter((s) => s.courseCode.trim().toLowerCase() === code);
    }
    if (options.type && options.type !== "ALL" && options.type !== "All") {
      items = items.filter((s) => s.type.toLowerCase() === options.type!.toLowerCase());
    }
    if (options.medium && options.medium !== "ALL" && options.medium !== "All") {
      items = items.filter((s) => s.medium === options.medium);
    }
    if (options.query && options.query.trim()) {
      const q = options.query.trim().toLowerCase();
      items = items.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.courseCode.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q))
      );
    }

    if (options.sortBy === "popular") {
      items.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    } else if (options.sortBy === "title") {
      items.sort((a, b) => a.title.localeCompare(b.title));
    } else if (options.sortBy === "course") {
      items.sort((a, b) => a.courseCode.localeCompare(b.courseCode));
    } else {
      items.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    const total = items.length;
    return {
      resources: items.slice(offset, offset + limit),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  const db = await getReadyDb();
  const conditions: string[] = ["status = 'APPROVED'"];
  const params: unknown[] = [];

  if (options.department && options.department !== "ALL" && options.department !== "All") {
    params.push(options.department.trim());
    conditions.push(`LOWER(department) = LOWER($${params.length})`);
  }
  if (options.level && options.level !== "ALL" && options.level !== "All") {
    params.push(options.level.trim());
    conditions.push(`level = $${params.length}`);
  }
  if (options.semester && options.semester !== "ALL" && options.semester !== "All") {
    params.push(options.semester.trim());
    conditions.push(`semester = $${params.length}`);
  }
  if (options.courseCode && options.courseCode !== "ALL") {
    params.push(options.courseCode.trim());
    conditions.push(`LOWER(course_code) = LOWER($${params.length})`);
  }
  if (options.type && options.type !== "ALL" && options.type !== "All") {
    params.push(options.type.trim());
    conditions.push(`type = $${params.length}`);
  }
  if (options.medium && options.medium !== "ALL" && options.medium !== "All") {
    params.push(options.medium.trim().toUpperCase());
    conditions.push(`medium = $${params.length}`);
  }
  if (options.query && options.query.trim()) {
    const q = options.query.trim();
    params.push(q);
    const ftsParam = `$${params.length}`;
    params.push(`${q.toLowerCase()}%`);
    const prefixParam = `$${params.length}`;
    conditions.push(
      `(
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(course_code, '') || ' ' || coalesce(description, ''))
          @@ plainto_tsquery('english', ${ftsParam})
        OR LOWER(course_code) LIKE ${prefixParam}
        OR LOWER(title) LIKE ${prefixParam}
      )`
    );
  }

  const whereClause = conditions.join(" AND ");
  let orderClause = "created_at DESC";
  if (options.sortBy === "popular") orderClause = "downloads DESC, created_at DESC";
  else if (options.sortBy === "title") orderClause = "title ASC";
  else if (options.sortBy === "course") orderClause = "course_code ASC, created_at DESC";

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM submissions WHERE ${whereClause}`,
    params
  );
  const total = Number(countRes.rows[0]?.total ?? 0);

  const listParams = [...params, limit, offset];
  const rowsRes = await db.query(
    `SELECT * FROM submissions
     WHERE ${whereClause}
     ORDER BY ${orderClause}
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return {
    resources: rowsRes.rows.map(mapSubmissionRow),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function incrementResourceDownload(resourceId: string): Promise<number> {
  if (isDevMemoryMode()) {
    const sub = devStore.submissions.find((s) => s.id === resourceId);
    if (!sub) return 0;
    sub.downloads = (sub.downloads || 0) + 1;
    return sub.downloads;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `UPDATE submissions
     SET downloads = COALESCE(downloads, 0) + 1
     WHERE id = $1
     RETURNING downloads`,
    [resourceId]
  );

  return Number(res.rows[0]?.downloads ?? 0);
}

export async function upsertReadingProgress(
  userId: string,
  resourceId: string,
  percentage: number,
  page: number
): Promise<DbReadingProgress> {
  const clampedPct = Math.max(0, Math.min(100, Math.round(percentage)));
  const clampedPage = Math.max(1, Math.round(page));
  const updatedAt = new Date().toISOString();

  if (isDevMemoryMode()) {
    const record: DbReadingProgress = {
      userId,
      resourceId,
      percentage: clampedPct,
      page: clampedPage,
      updatedAt,
    };
    devStore.readingProgress.set(`${userId}:${resourceId}`, record);
    return record;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `INSERT INTO reading_progress (user_id, resource_id, percentage, page, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, resource_id)
     DO UPDATE SET
       percentage = GREATEST(reading_progress.percentage, EXCLUDED.percentage),
       page = EXCLUDED.page,
       updated_at = CURRENT_TIMESTAMP
     RETURNING user_id AS "userId", resource_id AS "resourceId", percentage, page, updated_at AS "updatedAt"`,
    [userId, resourceId, clampedPct, clampedPage]
  );

  const row = res.rows[0];
  return {
    userId: String(row.userId),
    resourceId: String(row.resourceId),
    percentage: Number(row.percentage),
    page: Number(row.page),
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

export async function getUserReadingProgress(
  userId: string
): Promise<DbReadingProgress[]> {
  if (isDevMemoryMode()) {
    return Array.from(devStore.readingProgress.values()).filter(
      (p) => p.userId === userId
    );
  }

  const db = await getReadyDb();
  const res = await db.query(
    `SELECT user_id AS "userId", resource_id AS "resourceId", percentage, page, updated_at AS "updatedAt"
     FROM reading_progress
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 500`,
    [userId]
  );

  return res.rows.map((row) => ({
    userId: String(row.userId),
    resourceId: String(row.resourceId),
    percentage: Number(row.percentage),
    page: Number(row.page),
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  }));
}
