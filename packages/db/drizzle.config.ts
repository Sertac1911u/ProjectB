import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Supabase manages its own roles (anon, authenticated, ...).
  entities: { roles: { provider: "supabase" } },
});
