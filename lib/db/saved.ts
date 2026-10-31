import crypto from "node:crypto";
import { devStore, getReadyDb, isDevMemoryMode } from "./pool";
import type { DbSavedResource } from "./types";

export async function getSavedResources(userId: string): Promise<DbSavedResource[]> {
  if (isDevMemoryMode()) {
    return devStore.savedResources
      .filter((s) => s.userId === userId)
      .map((saved) => {
        const sub = devStore.submissions.find((x) => x.id === saved.resourceId);
        if (!sub) return saved;
        return {
          ...saved,
          title: sub.title,
          courseCode: sub.courseCode,
          department: sub.department,
          type: sub.type,
          fileSize: sub.fileSize || saved.fileSize,
          level: sub.level,
          semester: sub.semester,
          sessionYear: sub.sessionYear,
          medium: sub.medium,
          description: sub.description,
          fileUrl:
            sub.medium === "PDF" && sub.r2Key
              ? `/api/resources/${sub.id}/view`
              : sub.fileUrl,
          fileName: sub.fileName,
          youtubeUrl: sub.youtubeUrl,
          youtubeVideoId: sub.youtubeVideoId,
          thumbnailUrl: sub.thumbnailUrl,
          downloads: sub.downloads,
        };
      });
  }

  const db = await getReadyDb();
  const res = await db.query(
    `SELECT sr.id,
            sr.user_id AS "userId",
            sr.resource_id AS "resourceId",
            COALESCE(sub.title, sr.title) AS title,
            COALESCE(sub.course_code, sr.course_code) AS "courseCode",
            COALESCE(sub.department, sr.department) AS department,
            COALESCE(sub.type, sr.type) AS type,
            COALESCE(sub.file_size, sr.file_size) AS "fileSize",
            sr.created_at AS "createdAt",
            sub.level,
            sub.semester,
            sub.session_year AS "sessionYear",
            sub.medium,
            sub.description,
            sub.file_url AS "rawFileUrl",
            sub.r2_key AS "r2Key",
            sub.file_name AS "fileName",
            sub.youtube_url AS "youtubeUrl",
            sub.youtube_video_id AS "youtubeVideoId",
            sub.thumbnail_url AS "thumbnailUrl",
            sub.downloads
     FROM saved_resources sr
     LEFT JOIN submissions sub
       ON sub.id = sr.resource_id AND sub.status = 'APPROVED'
     WHERE sr.user_id = $1
     ORDER BY sr.created_at DESC
     LIMIT 300`,
    [userId]
  );

  return res.rows.map((row) => {
    const resourceId = String(row.resourceId);
    const medium = (row.medium === "YOUTUBE" ? "YOUTUBE" : row.medium === "PDF" ? "PDF" : undefined) as
      | "PDF"
      | "YOUTUBE"
      | undefined;
    const r2Key = row.r2Key ? String(row.r2Key) : undefined;
    const fileUrl =
      medium === "PDF" && r2Key
        ? `/api/resources/${resourceId}/view`
        : row.rawFileUrl
          ? String(row.rawFileUrl)
          : undefined;

    return {
      id: String(row.id),
      userId: String(row.userId),
      resourceId,
      title: String(row.title),
      courseCode: String(row.courseCode),
      department: String(row.department),
      type: String(row.type),
      fileSize: String(row.fileSize || "PDF Document"),
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      level: row.level ? String(row.level) : undefined,
      semester: row.semester ? String(row.semester) : undefined,
      sessionYear: row.sessionYear ? String(row.sessionYear) : undefined,
      medium,
      description: row.description ? String(row.description) : undefined,
      fileUrl,
      fileName: row.fileName ? String(row.fileName) : undefined,
      youtubeUrl: row.youtubeUrl ? String(row.youtubeUrl) : undefined,
      youtubeVideoId: row.youtubeVideoId ? String(row.youtubeVideoId) : undefined,
      thumbnailUrl: row.thumbnailUrl ? String(row.thumbnailUrl) : undefined,
      downloads: row.downloads !== null && row.downloads !== undefined ? Number(row.downloads) : undefined,
    };
  });
}

export async function addSavedResource(data: {
  userId: string;
  resourceId: string;
  title: string;
  courseCode: string;
  department: string;
  type: string;
  fileSize?: string;
}): Promise<DbSavedResource> {
  const id = `sav_${crypto.randomBytes(8).toString("hex")}`;
  const createdAt = new Date().toISOString();
  const fileSize = data.fileSize || "PDF Document";

  if (isDevMemoryMode()) {
    const existing = devStore.savedResources.find(
      (s) => s.userId === data.userId && s.resourceId === data.resourceId
    );
    if (existing) return existing;
    const item: DbSavedResource = {
      id,
      userId: data.userId,
      resourceId: data.resourceId,
      title: data.title,
      courseCode: data.courseCode,
      department: data.department,
      type: data.type,
      fileSize,
      createdAt,
    };
    devStore.savedResources.unshift(item);
    return item;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `INSERT INTO saved_resources (id, user_id, resource_id, title, course_code, department, type, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, resource_id)
     DO UPDATE SET title = EXCLUDED.title
     RETURNING id,
               user_id AS "userId",
               resource_id AS "resourceId",
               title,
               course_code AS "courseCode",
               department,
               type,
               file_size AS "fileSize",
               created_at AS "createdAt"`,
    [
      id,
      data.userId,
      data.resourceId,
      data.title,
      data.courseCode,
      data.department,
      data.type,
      fileSize,
    ]
  );

  const row = res.rows[0];
  return {
    id: String(row.id),
    userId: String(row.userId),
    resourceId: String(row.resourceId),
    title: String(row.title),
    courseCode: String(row.courseCode),
    department: String(row.department),
    type: String(row.type),
    fileSize: String(row.fileSize),
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

export async function removeSavedResource(
  userId: string,
  resourceId: string
): Promise<boolean> {
  if (isDevMemoryMode()) {
    const idx = devStore.savedResources.findIndex(
      (s) => s.userId === userId && s.resourceId === resourceId
    );
    if (idx === -1) return false;
    devStore.savedResources.splice(idx, 1);
    return true;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `DELETE FROM saved_resources WHERE user_id = $1 AND resource_id = $2`,
    [userId, resourceId]
  );
  return (res.rowCount ?? 0) > 0;
}

