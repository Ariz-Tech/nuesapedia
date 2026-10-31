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
    "ERROR: DATABASE_URL is not set. Set DATABASE_URL to a running PostgreSQL instance before running `npm run db:migrate` (or run `npm run dev` directly for local in-memory mode)."
  );
  process.exit(1);
}

const schemaPath = path.join(rootDir, "lib", "db", "schema.sql");
const sql = fs.readFileSync(schemaPath, "utf8");

const pool = new pg.Pool({
  connectionString,
  ssl:
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
});

try {
  console.log("Applying NUESApedia database migrations...");
  await pool.query(sql);
  console.log("Database migrations applied successfully.");
} catch (err) {
  const details =
    err && typeof err === "object" && Array.isArray(err.errors)
      ? err.errors.map((e) => e?.message || String(e)).join("; ")
      : err?.message || String(err);
  console.error(`Migration failed: ${details}`);
  if (err?.code === "ECONNREFUSED") {
    console.error(
      "Hint: PostgreSQL is not reachable at DATABASE_URL. Start your PostgreSQL server first, or leave DATABASE_URL empty in .env to run `npm run dev` in local in-memory mode."
    );
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
