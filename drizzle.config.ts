import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  // drizzle-kit loads .env automatically; fall back to the docker-compose dev database
  process.env.DATABASE_URL =
    "postgres://stayops:stayops@localhost:5432/stayops";
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  // Index prefixes collided because 0004 was never generated; timestamps
  // keep new migration and snapshot file names unique.
  migrations: { prefix: "timestamp" },
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
