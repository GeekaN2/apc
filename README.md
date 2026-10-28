# Albion Profit Calculator

Profit calculators for the Albion Online economy: crafting, refining, food & potions, transmutations, artifacts and transportations. Item and recipe data is generated from [ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps), prices come from the [Albion Online Data Project](https://www.albion-online-data.com/).

See [docs/ROADMAP.md](docs/ROADMAP.md) for the rewrite plan.

## Structure

```
apps/
  web/        frontend: React, Vite, HeroUI, Tailwind, Zustand
  api/        HTTP API: Hono
  ingest/     market orders from Albion Online Data NATS into Postgres
packages/
  game-data/  item catalog generated from ao-bin-dumps
  calc/       profit calculations over the catalog
  db/         Postgres schema, migrations and queries: Drizzle
```

## Backend

A local Postgres runs on PGlite, no Docker needed:

```bash
# Postgres on 127.0.0.1:5432, data in .dev/pglite
pnpm --filter @apc/db db:dev
```

```bash
# apply migrations and add the public Albion Online Data servers
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres pnpm --filter @apc/db db:migrate
```

```bash
# market orders ingest and the API on 127.0.0.1:4000
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres pnpm --filter @apc/ingest start
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres pnpm --filter @apc/api start
```

After a schema change, generate a migration with `pnpm --filter @apc/db db:generate`.

## Development

Requires Node 24 (see `.nvmrc`) and pnpm via corepack.

```bash
corepack enable
pnpm install

# frontend at localhost:5173
pnpm dev

pnpm lint
pnpm typecheck
pnpm test
pnpm build

# format code
pnpm format
```

## Game data

The catalog in `packages/game-data/generated` is committed. To rebuild it after a game patch:

```bash
# pin the latest ao-bin-dumps commit in packages/game-data/dumps.json
pnpm data:update

# download the pinned dumps (~140 MB, cached) and regenerate the catalog
pnpm data:build
```

To skip the download, point `AO_BIN_DUMPS_DIR` to a local ao-bin-dumps clone checked out at the pinned commit.
