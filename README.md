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
| `npm run db:up` / `db:down` | Start/stop PostgreSQL |
| `npm run db:generate` / `db:migrate` | Drizzle migration workflow |
| `npm run db:seed` | Idempotent fake demo data |

## Conventions

- Money is integer **centavos** everywhere except render boundaries (`src/lib/money.ts`).
- Nights are **date-only** `yyyy-mm-dd` ranges in the property timezone; check-out is exclusive (`src/lib/dates.ts`).
- Every tenant-owned record carries `organization_id`; all reads are scoped by membership (`src/lib/auth/session.ts`).
- Server actions/route handlers are thin; rules live in `src/server/*/service.ts`.

## Slice status

- [x] **0 · Foundation** — auth, organizations, app shell, seed
- [ ] **1 · Inventory & availability** — properties, units, blocks, calendar
- [ ] **2 · Reservations** — guests, holds, confirmation, guest link
- [ ] **3 · Money** — payments, security deposits, refunds, expenses
- [ ] **4 · Stay operations** — check-in/out, turnover tasks, damage
- [ ] **5 · Reports & hardening** — reports, audit, permissions, tests
