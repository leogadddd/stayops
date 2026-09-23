import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ??
    "postgres://stayops:stayops@localhost:5432/stayops_test";
  if (new URL(url).pathname !== "/stayops_test") {
    throw new Error("Integration tests require a dedicated stayops_test database.");
  }
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle"),
    });
  } finally {
    await client.end();
  }
}
