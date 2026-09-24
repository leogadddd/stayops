import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema";

const configuredBaseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const configuredHost = new URL(configuredBaseUrl).host;

export const auth = betterAuth({
  appName: "StayOps",
  secret: process.env.BETTER_AUTH_SECRET,
  // Vercel preview deployments receive a unique vercel.app hostname. A static
  // base URL rejects that origin during Better Auth's CSRF/origin validation,
  // which makes email/password sign-in fail on previews. Keep the allowlist
  // explicit while allowing Vercel's generated preview URLs. The fallback also
  // lets direct auth.api calls (such as the seed script) run without request
  // headers from which to resolve a host.
  baseURL: {
    fallback: configuredBaseUrl,
    allowedHosts: [
      "localhost:3000",
      configuredHost,
      "*.vercel.app",
    ],
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
});
