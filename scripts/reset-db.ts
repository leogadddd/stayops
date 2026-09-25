import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { seedDemoData } from "./seed";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}
const databaseUrl = connectionString;

async function confirmReset(databaseName: string): Promise<boolean> {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Database reset requires an interactive terminal confirmation.");
  }

  const confirmation = `RESET ${databaseName}`;
  console.warn(`\nThis permanently deletes every table and record in database "${databaseName}".`);
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question(`Type ${confirmation} to continue: `);
    return answer === confirmation;
  } finally {
    prompt.close();
  }
}

async function main() {
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.slice(1)) || "the configured database";
  if (!await confirmReset(databaseName)) {
    console.log("Database reset cancelled.");
    return;
  }

  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const db = drizzle(client);
  try {
    console.log(`Resetting ${url.hostname}/${databaseName}…`);
    // Drizzle records applied migrations outside public. Both schemas must be
    // removed; otherwise migrate() sees the old ledger and skips rebuilding
    // the newly emptied public schema.
    await client.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await client.unsafe("CREATE SCHEMA public AUTHORIZATION CURRENT_USER");
    await migrate(db, { migrationsFolder: "drizzle" });
    await seedDemoData();
    console.log("Database reset, migrated, and seeded with demo data.");
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error("Database reset failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => {
  // seedDemoData uses the application's shared database pool.
  setTimeout(() => process.exit(process.exitCode ?? 0), 250);
});
