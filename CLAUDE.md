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
4. Apply it: `npm run db:migrate`. It must succeed against the local database.
5. Check nothing is left over: run `npm run db:generate` again. It must print
   `No schema changes, nothing to migrate`.
6. Run `npm run test:integration` (applies all migrations to `stayops_test`
   from scratch) and exercise the affected pages in `npm run dev`.

Commit the schema edit, the `.sql` file, `drizzle/meta/_journal.json`, and the
new snapshot together. Don't edit a migration that has already been applied
anywhere; add a new one. Don't use `db:push` for real changes, since it skips
the migration history.
