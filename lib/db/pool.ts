import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import type {
  DbMaterialRequest,
  DbReadingProgress,
  DbResourceReport,
  DbSavedResource,
  DbSubmission,
  DbUser,
} from "./types";

interface GlobalDbState {
  pool: Pool | null;
  poolUrl: string | null;
  schemaEnsurePromise: Promise<void> | null;
  devStore: {
    users: Map<string, DbUser>;
    savedResources: DbSavedResource[];
    submissions: DbSubmission[];
    readingProgress: Map<string, DbReadingProgress>;
    materialRequests: DbMaterialRequest[];
    resourceReports: DbResourceReport[];
    resetTokens: Map<
      string,
      { id: string; userId: string; tokenHash: string; expiresAt: number; usedAt: number | null }
    >;
  };
}

const globalForDb = globalThis as unknown as {
  __nuesapediaDbState?: GlobalDbState;
};

const dbState: GlobalDbState =
  globalForDb.__nuesapediaDbState ??
  (globalForDb.__nuesapediaDbState = {
    pool: null,
    poolUrl: null,
    schemaEnsurePromise: null,
    devStore: {
      users: new Map<string, DbUser>(),
      savedResources: [] as DbSavedResource[],
      submissions: [] as DbSubmission[],
      readingProgress: new Map<string, DbReadingProgress>(),
      materialRequests: [] as DbMaterialRequest[],
      resourceReports: [] as DbResourceReport[],
      resetTokens: new Map<
        string,
        { id: string; userId: string; tokenHash: string; expiresAt: number; usedAt: number | null }
      >(),
    },
  });

/**
 * Isolated development-only in-memory store.
 * NEVER used in production and NEVER used as a fallback when DATABASE_URL is configured.
 */
export const devStore = dbState.devStore;

/**
 * Converts Node.js / pg `AggregateError` instances (such as dual-stack IPv6/IPv4
 * `ECONNREFUSED` when PostgreSQL is unreachable) into a flat `Error` with a readable
 * message. This also prevents a React 19 / Next.js 16 Turbopack Flight dev-mode crash
 * where `AggregateError.errors` is truncated to `null` during debug serialization and
 * throws `TypeError: object null is not iterable at AggregateError`.
 */
export function normalizeDbError(err: unknown): Error {
  if (err && typeof err === "object") {
    const maybeAgg = err as {
      message?: unknown;
      code?: unknown;
      errors?: unknown;
    };

    if (err instanceof AggregateError || Array.isArray(maybeAgg.errors)) {
      const subErrors = Array.isArray(maybeAgg.errors) ? maybeAgg.errors : [];
      const details = subErrors
        .map((sub) => (sub instanceof Error ? sub.message : String(sub)))
        .filter(Boolean)
        .join("; ");
      const firstCode =
        typeof maybeAgg.code === "string" && maybeAgg.code
          ? maybeAgg.code
          : subErrors.find(
              (s): s is { code: string } =>
                Boolean(
                  s &&
                    typeof s === "object" &&
                    typeof (s as { code?: unknown }).code === "string"
                )
            )?.code;
      const baseMsg =
        typeof maybeAgg.message === "string" && maybeAgg.message.trim().length > 0
          ? maybeAgg.message.trim()
          : details || "PostgreSQL connection failed";
      const prefix = firstCode ? `PostgreSQL error (${firstCode})` : "PostgreSQL error";
      const normalized = new Error(
        firstCode && baseMsg.includes(firstCode) ? baseMsg : `${prefix}: ${baseMsg}`
      ) as NodeJS.ErrnoException;
      if (firstCode) {
        normalized.code = firstCode;
      }
      return normalized;
    }

    if (err instanceof Error) {
      if (!err.message || err.message.trim().length === 0) {
        const code = (err as NodeJS.ErrnoException).code;
        err.message = code
          ? `PostgreSQL connection failed (${code})`
          : "PostgreSQL query failed";
      }
      return err;
    }
  }

  return new Error(typeof err === "string" && err ? err : "Unknown database error");
}

export function isTransientConnectionError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code;
  return (
    msg.includes("Connection terminated unexpectedly") ||
    msg.includes("Connection terminated due to connection timeout") ||
    msg.includes("timeout exceeded when trying to connect") ||
    msg.includes("terminating connection due to administrator command") ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03"
  );
}

function wrapPoolErrors(instance: Pool): Pool {
  const rawQuery = instance.query.bind(instance) as (...args: unknown[]) => unknown;
  const rawConnect = instance.connect.bind(instance) as (...args: unknown[]) => unknown;

  instance.query = (async (...args: unknown[]) => {
    const lastArg = args[args.length - 1];
    if (typeof lastArg === "function") {
      const cb = lastArg as (err: Error | null, res?: unknown) => void;
      args[args.length - 1] = (err: unknown, res: unknown) => {
        cb(err ? normalizeDbError(err) : null, res);
      };
      return rawQuery(...args);
    }

    try {
      return await (rawQuery(...args) as Promise<unknown>);
    } catch (err) {
      if (isTransientConnectionError(err)) {
        console.warn(
          "[db] Transient PostgreSQL connection error caught, retrying query once with fresh connection:",
          normalizeDbError(err).message
        );
        await new Promise((r) => setTimeout(r, 150));
        try {
          return await (rawQuery(...args) as Promise<unknown>);
        } catch (retryErr) {
          throw normalizeDbError(retryErr);
        }
      }
      throw normalizeDbError(err);
    }
  }) as Pool["query"];

  instance.connect = ((...args: unknown[]) => {
    const lastArg = args[args.length - 1];
    if (typeof lastArg === "function") {
      const cb = lastArg as (err: Error | undefined, client?: unknown, done?: unknown) => void;
      args[args.length - 1] = (err: unknown, client: unknown, done: unknown) => {
        cb(err ? normalizeDbError(err) : undefined, client, done);
      };
      return rawConnect(...args);
    }
    const result = rawConnect(...args);
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      return (result as Promise<unknown>).catch((err: unknown) => {
        throw normalizeDbError(err);
      });
    }
    return result;
  }) as Pool["connect"];

  return instance;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function isDevMemoryMode(): boolean {
  return process.env.NODE_ENV !== "production" && !isDatabaseConfigured();
}

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not configured. PostgreSQL is required in production."
    );
  }

  if (!dbState.pool || dbState.poolUrl !== connectionString) {
    if (dbState.pool) {
      dbState.pool.end().catch(() => {});
    }
    dbState.schemaEnsurePromise = null;

    const isLocal =
      connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

    const rejectUnauthorized =
      process.env.PG_SSL_REJECT_UNAUTHORIZED !== undefined
        ? process.env.PG_SSL_REJECT_UNAUTHORIZED === "true"
        : process.env.NODE_ENV === "production";

    const nextPool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX) || 5,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: isLocal ? false : { rejectUnauthorized },
    });

    nextPool.on("error", (err) => {
      console.error("[db] Unexpected idle PostgreSQL client error:", normalizeDbError(err).message);
    });

    dbState.pool = wrapPoolErrors(nextPool);
    dbState.poolUrl = connectionString;
  }

  return dbState.pool;
}

/**
 * Ensures schema tables exist once per worker lifecycle unless `SKIP_SCHEMA_ENSURE=true`
 * (prefer running `npm run db:migrate` in CI/CD). Deduplicates concurrent cold-start calls
 * and NEVER swallows database errors.
 */
export async function getReadyDb(): Promise<Pool> {
  const db = getPool();

  // In production, migrations should be applied before deployment (via npm run db:migrate).
  // Schema auto-ensure runs only in development/test unless explicitly opted-in via ENSURE_SCHEMA_ON_BOOT=true.
  const shouldSkipEnsure =
    process.env.SKIP_SCHEMA_ENSURE === "true" ||
    (process.env.NODE_ENV === "production" && process.env.ENSURE_SCHEMA_ON_BOOT !== "true");

  if (shouldSkipEnsure) {
    return db;
  }

  if (!dbState.schemaEnsurePromise) {
    dbState.schemaEnsurePromise = (async () => {
      try {
        const schemaPath = path.join(process.cwd(), "lib", "db", "schema.sql");
        if (fs.existsSync(schemaPath)) {
          const sql = fs.readFileSync(schemaPath, "utf8");
          await db.query(sql);
        }
      } catch (err) {
        dbState.schemaEnsurePromise = null;
        throw normalizeDbError(err);
      }
    })();
  }

  await dbState.schemaEnsurePromise;
  return db;
}

