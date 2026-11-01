import { getPool, getReadyDb, isDatabaseConfigured, isDevMemoryMode } from "./db/pool";

export { getPool, getReadyDb, isDatabaseConfigured, isDevMemoryMode };
export * from "./db/types";
export * from "./db/users";
export * from "./db/submissions";
export * from "./db/saved";
export * from "./db/moderation";

export async function initDb(): Promise<void> {
  if (isDevMemoryMode()) return;
  await getReadyDb();
}

export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  mode: "postgres" | "dev_memory" | "unconfigured";
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();

  if (!isDatabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return {
        connected: false,
        mode: "unconfigured",
        latencyMs: Date.now() - start,
        error: "DATABASE_URL is not configured in production.",
      };
    }
    return {
      connected: true,
      mode: "dev_memory",
      latencyMs: Date.now() - start,
    };
  }

  try {
    const db = getPool();
    await db.query("SELECT 1");
    return {
      connected: true,
      mode: "postgres",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      connected: false,
      mode: "postgres",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Database connection failed",
    };
  }
}
