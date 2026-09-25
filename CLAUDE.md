# StayOps

## Database schema changes

Every change to `src/lib/db/schema/*` (new column, table, index, enum value,
default, constraint) ships with a migration in the same change. A schema edit
without a migration makes queries fail at runtime with errors like
`column "x" does not exist`.

1. Edit the schema in `src/lib/db/schema/`.
2. Generate the migration: `npm run db:generate -- --name <what_changed>`
   (e.g. `add_unit_wifi_password`). Never hand-write a migration without also
   committing the matching `drizzle/meta/NNNN_snapshot.json`; drizzle-kit
   diffs against the latest snapshot, so a missing one makes the next
   generate re-create things that already exist.
3. Read the generated SQL. New `NOT NULL` columns on existing tables need a
   `DEFAULT` or a backfill, or the migration fails on tables with data.
   Also check the ordering: a composite foreign key needs its target unique
   index created first. drizzle-kit may emit `CREATE UNIQUE INDEX` after the
   `ADD CONSTRAINT ... FOREIGN KEY` that depends on it (0012_amenities had
   to be reordered by hand).
4. Check the new `drizzle/meta/_journal.json` entry: its `when` must be larger
   than every earlier entry's. The migrator silently skips a migration older
   than the last applied one, and 0008–0011 were hand-dated into late
   September 2026, so bump `when` past 1790668800000 until the real clock
   passes it.
5. Apply it: `npm run db:migrate`. It must succeed against the local database.
   `drizzle-kit migrate` can exit 1 without printing the error; run
   `npx tsx --tsconfig tsconfig.scripts.json scripts/migrate.ts` to see it.
6. Check nothing is left over: run `npm run db:generate` again. It must print
   `No schema changes, nothing to migrate`.
7. Run `npm run test:integration` (applies all migrations to `stayops_test`
   from scratch) and exercise the affected pages in `npm run dev`.

Commit the schema edit, the `.sql` file, `drizzle/meta/_journal.json`, and the
new snapshot together. New migrations use timestamp file prefixes (see
`drizzle.config.ts`) because index prefixes collided after 0004 was skipped.
Don't edit a migration that has already been applied anywhere; add a new
one. Don't use `db:push` for real changes, since it skips the migration
history.
