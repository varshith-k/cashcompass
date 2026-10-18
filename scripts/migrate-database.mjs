import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import pg from "pg";
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info() {}, error() {} });
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is missing; no migration was attempted."); process.exit(1); }
const url = new URL(process.env.DATABASE_URL);
const localPlaintext = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.searchParams.get("sslmode") === "disable";
url.searchParams.delete("sslmode");
const client = new pg.Client({ connectionString: url.toString(), ssl: localPlaintext ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  console.log("Database schema is ready.");
} catch (error) {
  // Connection errors can contain DSNs. Report only the non-sensitive error class/code.
  console.error(`Database migration failed (${error.code || error.name || "unknown"}). No credential values were logged.`);
  process.exitCode = 1;
} finally { await client.end(); }
