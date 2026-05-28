-- Tables are managed by TypeORM (synchronize: true in development).
-- This file is intentionally minimal — only tables NOT managed by TypeORM go here.
-- TypeORM manages: users, items
-- Vector index for ai search — created here because TypeORM does not emit ivfflat syntax.
-- The column itself is declared on the Item entity; this index is a post-creation optimisation.

-- Note: The items table must already exist (created by TypeORM on first boot).
-- This script runs at DB init time so the table may not exist yet.
-- Index is created idempotently from the seed service after TypeORM bootstraps.
SELECT 1; -- no-op placeholder
