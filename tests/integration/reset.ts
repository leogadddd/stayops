import { beforeAll } from "vitest";
import postgres from "postgres";

// Test files run sequentially to avoid truncating another file's fixtures.
beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url || new URL(url).pathname !== "/stayops_test") {
    throw new Error("Refusing to reset any database except stayops_test.");
  }
  const sql = postgres(url, { max: 1 });
  const tables = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  if (tables.length > 0) {
    const names = tables.map((t) => `"${t.tablename}"`).join(", ");
    await sql.unsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
  }
  await sql.end();
});
