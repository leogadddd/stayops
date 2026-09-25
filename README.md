# StayOps

A calmer way to run your stays. StayOps takes a direct booking from inquiry
to checkout and shows the work and money attached to that stay — built for
small Philippine short-stay operators (1–20 units).

Built to the spec in [`StayOps-PRD-for-Qoder.md`](./StayOps-PRD-for-Qoder.md),
delivered in vertical slices (0–5). Brand palette: Pine `#203A35`, Paper
`#F6F3ED`, Sage `#CFDDD3`, Clay `#A64E37`.

## Stack

- Next.js (App Router) + TypeScript strict
- PostgreSQL 16 via Docker Compose
- Drizzle ORM + drizzle-kit migrations
- Better Auth (email + password)
- Tailwind CSS v4 · Vitest

## Getting started

```bash
cp .env.example .env            # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm install
npm run db:setup                # docker compose up + migrations + seed
npm run dev                     # http://localhost:3000
```

Already have a local database? After pulling schema changes, apply the latest
migrations before starting the app:

```bash
npm run db:migrate
```

Demo credentials (from the seed, clearly fake):

- email: `owner@stayops.dev`
- password: `stayops-demo-1234`

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js app |
| `npm run lint` / `typecheck` / `test` | Quality gates |
| `npm run test:integration` | Real PostgreSQL acceptance tests (dedicated `stayops_test` database) |
| `npm run db:up` / `db:down` | Start/stop PostgreSQL |
| `npm run db:generate` / `db:migrate` | Drizzle migration workflow (see *Database schema changes* in `CLAUDE.md`) |
| `npm run db:seed` | Idempotent fake demo data |
| `npm run db:reset-demo` | Delete and recreate only the shared demo workspace |
| `npm run db:reset` | Interactively confirm, then erase the database, migrate it, and seed demo data |

## Nightly demo reset

Vercel Cron calls `/api/cron/reset-demo` every day at 16:05 UTC (00:05 in
Asia/Manila). It deletes only the `owner@stayops.dev` demo user and its `Demo
Stay Operations` workspace, then recreates the fake baseline data.

Before deploying, add a random `CRON_SECRET` to the Vercel project’s
Production environment variables. Vercel sends it in the request’s
`Authorization` header, and the endpoint rejects calls without it. The cron
job is created after the next production deployment. `npm run db:reset-demo`
remains available for a deliberate local reset; do not run either reset against
a production account that reuses the demo email or organization name.

## Inventory and availability

- **Properties and units** support a single cover-photo upload. Supported
  files are JPG, PNG, and WebP up to 4 MB; the image is stored with the
  inventory record and appears in the relevant management views.
- **Check availability** searches every active unit by check-in, check-out,
  and guest count. It excludes units that are too small or have an overlapping
  reservation, active hold, out-of-service block, or turnover period.
- Each matching unit links directly to its filtered calendar and a prefilled
  new-reservation form. The final reservation save still performs the
  authoritative conflict check.

## Integration tests

Create the isolated database once, then run the suite:

```bash
docker exec stayops-db createdb -U stayops stayops_test
npm run test:integration
```

The suite applies migrations and truncates the test database between files.
It ignores application `DATABASE_URL`; use `TEST_DATABASE_URL` to override the
connection, always pointing to a dedicated database named `stayops_test`.
Never point it at a database with data you want to keep. The lifecycle test
exercises services against PostgreSQL; it is not a browser end-to-end test.

## Conventions

- Money is integer **centavos** everywhere except render boundaries (`src/lib/money.ts`).
- Nights are **date-only** `yyyy-mm-dd` ranges in the property timezone; check-out is exclusive (`src/lib/dates.ts`).
- Every tenant-owned record carries `organization_id`; all reads are scoped by membership (`src/lib/auth/session.ts`).
- Server actions/route handlers are thin; rules live in `src/server/*/service.ts`.

## Slice status

- [x] **0 · Foundation** — auth, organizations, app shell, seed
- [x] **1 · Inventory & availability** — properties and unit photos, capacity-aware availability search, blocks, calendar
- [x] **2 · Reservations** — guests, holds, confirmation, guest link
- [x] **3 · Money** — payments, security deposits, refunds, expenses
- [x] **4 · Stay operations** — check-in/out, turnover tasks, damage
- [x] **5 · Reports & hardening** — reports, audit, owner/staff permissions, and automated tests.

Reports use an explicitly labeled Asia/Manila cash-period basis across all
property filters. Occupancy uses currently active inventory minus blocked
nights; historical unit status changes are not reconstructed. Booked value
spreads accommodation charges across actual stay nights and excludes deposits.
Staff must register an account before the owner can add them by email; no
invitation email is sent. Staff can place holds at server-calculated default
prices but cannot view financial details, edit prices, or confirm bookings.
