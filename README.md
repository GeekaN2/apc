# Albion Profit Calculator

Profit calculators for the Albion Online economy: crafting, refining, food & potions, transmutations, artifacts and transportations. Item and recipe data is generated from [ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps), prices come from the [Albion Online Data Project](https://www.albion-online-data.com/).

See [docs/ROADMAP.md](docs/ROADMAP.md) for the rewrite plan.

## Structure

```
apps/
  web/        frontend: React, Vite, HeroUI, Tailwind, Zustand
packages/
  game-data/  item catalog generated from ao-bin-dumps
  calc/       profit calculations over the catalog
```

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
