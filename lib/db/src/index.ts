import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.RENDER_INTERNAL_DATABASE_URL ||
    process.env.RENDER_EXTERNAL_DATABASE_URL
  );
}

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set, or use RENDER_INTERNAL_DATABASE_URL / RENDER_EXTERNAL_DATABASE_URL.",
  );
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });

export * from "./schema";
