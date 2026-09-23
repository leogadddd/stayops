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
| `npm run db:generate` / `db:migrate` | Drizzle migration workflow |
| `npm run db:seed` | Idempotent fake demo data |

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
- [x] **1 · Inventory & availability** — properties, units, blocks, calendar
- [x] **2 · Reservations** — guests, holds, confirmation, guest link
- [x] **3 · Money** — payments, security deposits, refunds, expenses
- [x] **4 · Stay operations** — check-in/out, turnover tasks, damage
- [ ] **5 · Reports & hardening** — reports, audit, owner/staff permissions and automated tests implemented; 375px/keyboard browser QA remains pending because browser automation was denied.

Reports use an explicitly labeled Asia/Manila cash-period basis across all
property filters. Occupancy uses currently active inventory minus blocked
nights; historical unit status changes are not reconstructed. Booked value
spreads accommodation charges across actual stay nights and excludes deposits.
Staff must register an account before the owner can add them by email; no
invitation email is sent. Staff can place holds at server-calculated default
prices but cannot view financial details, edit prices, or confirm bookings.
