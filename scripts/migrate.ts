import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function main() {
  const timeout = setTimeout(() => {
    console.error("Migration timed out after 60s.");
    process.exit(1);
  }, 60_000);

  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migrations applied.");
  } finally {
    clearTimeout(timeout);
    await client.end();
  }
}

void main();
