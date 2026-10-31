import crypto from "node:crypto";
import { devStore, getReadyDb, isDevMemoryMode } from "./pool";
import type { DbUser } from "./types";

function mapUserRow(row: Record<string, unknown>): DbUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    password: String(row.password ?? ""),
    department: String(row.department),
    level: String(row.level),
    avatar: String(row.avatar),
    role: String(row.role || "STUDENT"),
    sessionVersion: Number(row.session_version ?? row.sessionVersion ?? 1),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

export function isConfiguredAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.trim().toLowerCase());
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (isDevMemoryMode()) {
    return devStore.users.get(normalizedEmail) || null;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `SELECT id, name, email, password, department, level, avatar, role, session_version, created_at
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [normalizedEmail]
  );

  return res.rows[0] ? mapUserRow(res.rows[0]) : null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
  if (isDevMemoryMode()) {
    for (const user of devStore.users.values()) {
      if (user.id === id) return user;
    }
    return null;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `SELECT id, name, email, password, department, level, avatar, role, session_version, created_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  return res.rows[0] ? mapUserRow(res.rows[0]) : null;
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  department: string;
  level: string;
  avatar: string;
  role?: string;
}): Promise<DbUser> {
  const id = `usr_${crypto.randomBytes(8).toString("hex")}`;
  const normalizedEmail = data.email.trim().toLowerCase();
  const createdAt = new Date().toISOString();
  const effectiveRole = isConfiguredAdminEmail(normalizedEmail)
    ? "ADMIN"
    : data.role || "STUDENT";

  const newUser: DbUser = {
    id,
    name: data.name.trim(),
    email: normalizedEmail,
    password: data.password,
    department: data.department,
    level: data.level,
    avatar: data.avatar,
    role: effectiveRole,
    sessionVersion: 1,
    createdAt,
  };

  if (isDevMemoryMode()) {
    devStore.users.set(normalizedEmail, newUser);
    return newUser;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `INSERT INTO users (id, name, email, password, department, level, avatar, role, session_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
     RETURNING id, name, email, password, department, level, avatar, role, session_version, created_at`,
    [
      newUser.id,
      newUser.name,
      newUser.email,
      newUser.password,
      newUser.department,
      newUser.level,
      newUser.avatar,
      newUser.role,
    ]
  );

  return mapUserRow(res.rows[0]);
}

export async function updateUser(
  id: string,
  updates: Partial<{ name: string; department: string; level: string; avatar: string }>
): Promise<DbUser | null> {
  if (isDevMemoryMode()) {
    for (const [key, user] of devStore.users.entries()) {
      if (user.id === id) {
        const updated: DbUser = {
          ...user,
          name: updates.name ?? user.name,
          department: updates.department ?? user.department,
          level: updates.level ?? user.level,
          avatar: updates.avatar ?? user.avatar,
        };
        devStore.users.set(key, updated);
        return updated;
      }
    }
    return null;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `UPDATE users
     SET name = COALESCE($1, name),
         department = COALESCE($2, department),
         level = COALESCE($3, level),
         avatar = COALESCE($4, avatar)
     WHERE id = $5
     RETURNING id, name, email, password, department, level, avatar, role, session_version, created_at`,
    [
      updates.name ?? null,
      updates.department ?? null,
      updates.level ?? null,
      updates.avatar ?? null,
      id,
    ]
  );

  return res.rows[0] ? mapUserRow(res.rows[0]) : null;
}

/**
 * Updates password and increments `session_version` to revoke all prior sessions.
 */
export async function updateUserPassword(
  userId: string,
  hashedPassword: string
): Promise<DbUser | null> {
  if (isDevMemoryMode()) {
    for (const [key, user] of devStore.users.entries()) {
      if (user.id === userId) {
        const updated: DbUser = {
          ...user,
          password: hashedPassword,
          sessionVersion: user.sessionVersion + 1,
        };
        devStore.users.set(key, updated);
        return updated;
      }
    }
    return null;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `UPDATE users
     SET password = $1,
         session_version = session_version + 1
     WHERE id = $2
     RETURNING id, name, email, password, department, level, avatar, role, session_version, created_at`,
    [hashedPassword, userId]
  );

  return res.rows[0] ? mapUserRow(res.rows[0]) : null;
}

export async function getAllUsers(options?: {
  limit?: number;
  offset?: number;
}): Promise<Omit<DbUser, "password">[]> {
  const limit = Math.min(Math.max(1, options?.limit ?? 200), 500);
  const offset = Math.max(0, options?.offset ?? 0);

  if (isDevMemoryMode()) {
    return Array.from(devStore.users.values())
      .slice(offset, offset + limit)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department,
        level: u.level,
        avatar: u.avatar,
        role: u.role,
        sessionVersion: u.sessionVersion,
        createdAt: u.createdAt,
      }));
  }

  const db = await getReadyDb();
  const res = await db.query(
    `SELECT id, name, email, department, level, avatar, role, session_version, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return res.rows.map((row) => {
    const mapped = mapUserRow(row);
    return {
      id: mapped.id,
      name: mapped.name,
      email: mapped.email,
      department: mapped.department,
      level: mapped.level,
      avatar: mapped.avatar,
      role: mapped.role,
      sessionVersion: mapped.sessionVersion,
      createdAt: mapped.createdAt,
    };
  });
}

/**
 * Updates user role and increments `session_version` so demoted users
 * lose privileged cookie tokens immediately.
 */
export async function updateUserRole(
  userId: string,
  role: string
): Promise<DbUser | null> {
  if (isDevMemoryMode()) {
    for (const [key, user] of devStore.users.entries()) {
      if (user.id === userId) {
        const updated: DbUser = {
          ...user,
          role,
          sessionVersion: user.sessionVersion + 1,
        };
        devStore.users.set(key, updated);
        return updated;
      }
    }
    return null;
  }

  const db = await getReadyDb();
  const res = await db.query(
    `UPDATE users
     SET role = $1,
         session_version = session_version + 1
     WHERE id = $2
     RETURNING id, name, email, password, department, level, avatar, role, session_version, created_at`,
    [role, userId]
  );

  return res.rows[0] ? mapUserRow(res.rows[0]) : null;
}

export async function createPasswordResetToken(
  userId: string,
  tokenHash: string,
  ttlMinutes: number = 15
): Promise<void> {
  const id = `prt_${crypto.randomBytes(10).toString("hex")}`;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  if (isDevMemoryMode()) {
    devStore.resetTokens.set(tokenHash, {
      id,
      userId,
      tokenHash,
      expiresAt: expiresAt.getTime(),
      usedAt: null,
    });
    return;
  }

  const db = await getReadyDb();
  // Invalidate previous unused tokens for this user before issuing a new one
  await db.query(
    `UPDATE password_reset_tokens
     SET used_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
  await db.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [id, userId, tokenHash, expiresAt.toISOString()]
  );
}

/**
 * Atomically consumes a single-use unexpired reset token, updates the user's password,
 * and increments `session_version` to revoke all existing sessions.
 */
export async function consumePasswordResetToken(
  tokenHash: string,
  newHashedPassword: string
): Promise<DbUser | null> {
  if (isDevMemoryMode()) {
    const entry = devStore.resetTokens.get(tokenHash);
    if (!entry || entry.usedAt !== null || entry.expiresAt <= Date.now()) {
      return null;
    }
    entry.usedAt = Date.now();
    return updateUserPassword(entry.userId, newHashedPassword);
  }

  const db = await getReadyDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const tokenRes = await client.query(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       RETURNING user_id`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const userId = String(tokenRes.rows[0].user_id);

    const userRes = await client.query(
      `UPDATE users
       SET password = $1,
           session_version = session_version + 1
       WHERE id = $2
       RETURNING id, name, email, password, department, level, avatar, role, session_version, created_at`,
      [newHashedPassword, userId]
    );

    await client.query("COMMIT");
    return userRes.rows[0] ? mapUserRow(userRes.rows[0]) : null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

