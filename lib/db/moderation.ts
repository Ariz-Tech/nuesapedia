import crypto from "node:crypto";
import { devStore, getReadyDb, isDevMemoryMode } from "./pool";
import type { DbMaterialRequest, DbResourceReport } from "./types";

export async function createMaterialRequest(data: {
  userId?: string;
  requesterName: string;
  courseCode: string;
  department: string;
  level: string;
  type: string;
  details: string;
}): Promise<DbMaterialRequest> {
  const id = `req_${crypto.randomBytes(8).toString("hex")}`;
  const createdAt = new Date().toISOString();

  const item: DbMaterialRequest = {
    id,
    userId: data.userId,
    requesterName: data.requesterName,
    courseCode: data.courseCode,
    department: data.department,
    level: data.level,
    type: data.type,
    details: data.details,
    status: "OPEN",
    createdAt,
  };

  if (isDevMemoryMode()) {
    devStore.materialRequests.unshift(item);
    return item;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `INSERT INTO material_requests (id, user_id, requester_name, course_code, department, level, type, details, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN')
     RETURNING id,
               user_id AS "userId",
               requester_name AS "requesterName",
               course_code AS "courseCode",
               department,
               level,
               type,
               details,
               status,
               created_at AS "createdAt"`,
    [
      item.id,
      item.userId ?? null,
      item.requesterName,
      item.courseCode,
      item.department,
      item.level,
      item.type,
      item.details,
    ]
  );

  const row = res.rows[0];
  return {
    id: String(row.id),
    userId: row.userId ? String(row.userId) : undefined,
    requesterName: String(row.requesterName),
    courseCode: String(row.courseCode),
    department: String(row.department),
    level: String(row.level),
    type: String(row.type),
    details: String(row.details),
    status: (row.status as "OPEN" | "FULFILLED") || "OPEN",
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

export async function getMaterialRequests(
  status?: string,
  options?: { limit?: number; offset?: number }
): Promise<DbMaterialRequest[]> {
  const limit = Math.min(Math.max(1, options?.limit ?? 100), 300);
  const offset = Math.max(0, options?.offset ?? 0);

  if (isDevMemoryMode()) {
    const filtered =
      status && status !== "ALL"
        ? devStore.materialRequests.filter((r) => r.status === status)
        : devStore.materialRequests;
    return filtered.slice(offset, offset + limit);
  }

  const db = await getReadyDb();
  const res =
    status && status !== "ALL"
      ? await db.query(
          `SELECT id,
                  user_id AS "userId",
                  requester_name AS "requesterName",
                  course_code AS "courseCode",
                  department,
                  level,
                  type,
                  details,
                  status,
                  created_at AS "createdAt"
           FROM material_requests
           WHERE status = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [status, limit, offset]
        )
      : await db.query(
          `SELECT id,
                  user_id AS "userId",
                  requester_name AS "requesterName",
                  course_code AS "courseCode",
                  department,
                  level,
                  type,
                  details,
                  status,
                  created_at AS "createdAt"
           FROM material_requests
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        );

  return res.rows.map((row) => ({
    id: String(row.id),
    userId: row.userId ? String(row.userId) : undefined,
    requesterName: String(row.requesterName),
    courseCode: String(row.courseCode),
    department: String(row.department),
    level: String(row.level),
    type: String(row.type),
    details: String(row.details),
    status: (row.status as "OPEN" | "FULFILLED") || "OPEN",
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  }));
}

export async function updateMaterialRequestStatus(
  id: string,
  status: "OPEN" | "FULFILLED"
): Promise<DbMaterialRequest | null> {
  if (isDevMemoryMode()) {
    const req = devStore.materialRequests.find((r) => r.id === id);
    if (!req) return null;
    req.status = status;
    return req;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `UPDATE material_requests
     SET status = $1
     WHERE id = $2
     RETURNING id,
               user_id AS "userId",
               requester_name AS "requesterName",
               course_code AS "courseCode",
               department,
               level,
               type,
               details,
               status,
               created_at AS "createdAt"`,
    [status, id]
  );

  if (!res.rows[0]) return null;
  const row = res.rows[0];
  return {
    id: String(row.id),
    userId: row.userId ? String(row.userId) : undefined,
    requesterName: String(row.requesterName),
    courseCode: String(row.courseCode),
    department: String(row.department),
    level: String(row.level),
    type: String(row.type),
    details: String(row.details),
    status: (row.status as "OPEN" | "FULFILLED") || "OPEN",
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

export async function createResourceReport(data: {
  resourceId: string;
  resourceTitle: string;
  courseCode: string;
  reason: string;
  details?: string;
}): Promise<DbResourceReport> {
  const id = `rep_${crypto.randomBytes(8).toString("hex")}`;
  const createdAt = new Date().toISOString();

  const item: DbResourceReport = {
    id,
    resourceId: data.resourceId,
    resourceTitle: data.resourceTitle,
    courseCode: data.courseCode,
    reason: data.reason,
    details: data.details,
    status: "OPEN",
    createdAt,
  };

  if (isDevMemoryMode()) {
    devStore.resourceReports.unshift(item);
    return item;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `INSERT INTO resource_reports (id, resource_id, resource_title, course_code, reason, details, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
     RETURNING id,
               resource_id AS "resourceId",
               resource_title AS "resourceTitle",
               course_code AS "courseCode",
               reason,
               details,
               status,
               created_at AS "createdAt"`,
    [
      item.id,
      item.resourceId,
      item.resourceTitle,
      item.courseCode,
      item.reason,
      item.details ?? null,
    ]
  );

  const row = res.rows[0];
  return {
    id: String(row.id),
    resourceId: String(row.resourceId),
    resourceTitle: String(row.resourceTitle),
    courseCode: String(row.courseCode),
    reason: String(row.reason),
    details: row.details ? String(row.details) : undefined,
    status: (row.status as "OPEN" | "RESOLVED") || "OPEN",
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

export async function getResourceReports(
  status?: string,
  options?: { limit?: number; offset?: number }
): Promise<DbResourceReport[]> {
  const limit = Math.min(Math.max(1, options?.limit ?? 100), 300);
  const offset = Math.max(0, options?.offset ?? 0);

  if (isDevMemoryMode()) {
    const filtered =
      status && status !== "ALL"
        ? devStore.resourceReports.filter((r) => r.status === status)
        : devStore.resourceReports;
    return filtered.slice(offset, offset + limit);
  }

  const db = await getReadyDb();
  const res =
    status && status !== "ALL"
      ? await db.query(
          `SELECT id,
                  resource_id AS "resourceId",
                  resource_title AS "resourceTitle",
                  course_code AS "courseCode",
                  reason,
                  details,
                  status,
                  created_at AS "createdAt"
           FROM resource_reports
           WHERE status = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [status, limit, offset]
        )
      : await db.query(
          `SELECT id,
                  resource_id AS "resourceId",
                  resource_title AS "resourceTitle",
                  course_code AS "courseCode",
                  reason,
                  details,
                  status,
                  created_at AS "createdAt"
           FROM resource_reports
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        );

  return res.rows.map((row) => ({
    id: String(row.id),
    resourceId: String(row.resourceId),
    resourceTitle: String(row.resourceTitle),
    courseCode: String(row.courseCode),
    reason: String(row.reason),
    details: row.details ? String(row.details) : undefined,
    status: (row.status as "OPEN" | "RESOLVED") || "OPEN",
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  }));
}

export async function resolveResourceReport(id: string): Promise<boolean> {
  if (isDevMemoryMode()) {
    const report = devStore.resourceReports.find((r) => r.id === id);
    if (!report) return false;
    report.status = "RESOLVED";
    return true;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `UPDATE resource_reports SET status = 'RESOLVED' WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

