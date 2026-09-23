import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and start the database with `npm run db:up`.",
  );
}

const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });
export { schema };
