import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

// Postgres NOTICEs ("schema drizzle already exists, skipping") are expected
// on every run; hide them so real errors stand out.
const client = postgres(connectionString, { max: 1, onnotice: () => {} });
const db = drizzle(client);

async function appliedCount(): Promise<number> {
  try {
    const [row] = await client<{ count: string }[]>`SELECT count(*) FROM drizzle.__drizzle_migrations`;
    return Number(row?.count ?? 0);
  } catch {
    return 0; // First run: the migrations table doesn't exist yet.
  }
}

async function main() {
  const url = new URL(connectionString!);
  console.log(`Migrating ${url.hostname}${url.pathname}`);
  const timeout = setTimeout(() => {
    console.error("Migration timed out after 60s.");
    process.exit(1);
  }, 60_000);

  try {
    const before = await appliedCount();
    await migrate(db, { migrationsFolder: "drizzle" });
    const applied = (await appliedCount()) - before;
    console.log(applied ? `Applied ${applied} migration${applied === 1 ? "" : "s"}.` : "Already up to date.");
  } catch (error) {
    // Drizzle wraps the Postgres error; its cause has the useful message.
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    console.error("Migration failed:", cause instanceof Error ? cause.message : cause);
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
    await client.end();
  }
}

void main();
