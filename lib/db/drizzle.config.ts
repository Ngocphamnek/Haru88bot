import { defineConfig } from "drizzle-kit";
import path from "path";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.RENDER_INTERNAL_DATABASE_URL ||
  process.env.RENDER_EXTERNAL_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set, or use RENDER_INTERNAL_DATABASE_URL / RENDER_EXTERNAL_DATABASE_URL.",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
