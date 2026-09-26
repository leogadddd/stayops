import "dotenv/config";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemAdmins, user } from "@/lib/db/schema";

/**
 * Manages L1 operators, who act as owner in every organization.
 *
 *   npm run l1 -- list
 *   npm run l1 -- grant <email>
 *   npm run l1 -- revoke <email>
 *
 * The user must have signed up first. Check the database host this prints:
 * `.env` decides which database it touches.
 */
async function main() {
  const [command, email] = process.argv.slice(2);
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unknown").host;
  console.log(`Database: ${host}`);

  if (command === "list") {
    const rows = await db
      .select({ email: user.email, name: user.name, since: systemAdmins.createdAt })
      .from(systemAdmins)
      .innerJoin(user, eq(systemAdmins.userId, user.id))
      .orderBy(asc(user.email));
    if (!rows.length) console.log("No L1 operators.");
    for (const row of rows) console.log(`${row.email} (${row.name}) since ${row.since.toISOString()}`);
    return;
  }

  if ((command !== "grant" && command !== "revoke") || !email) {
    throw new Error("Usage: npm run l1 -- list | grant <email> | revoke <email>");
  }
  const [account] = await db.select({ id: user.id }).from(user).where(eq(user.email, email.trim().toLowerCase())).limit(1);
  if (!account) throw new Error(`No user with the email ${email}. They need to sign up first.`);

  if (command === "grant") {
    const added = await db.insert(systemAdmins).values({ userId: account.id }).onConflictDoNothing().returning();
    console.log(added.length ? `${email} is now L1.` : `${email} was already L1.`);
  } else {
    const removed = await db.delete(systemAdmins).where(eq(systemAdmins.userId, account.id)).returning();
    console.log(removed.length ? `${email} is no longer L1.` : `${email} wasn't L1.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
