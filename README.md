# Albion Profit Calculator

Profit calculators for the Albion Online economy: crafting, refining, food & potions, transmutations, artifacts and transportations. Item and recipe data is generated from [ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps), prices come from the [Albion Online Data Project](https://www.albion-online-data.com/).

See [docs/ROADMAP.md](docs/ROADMAP.md) for the rewrite plan.

## Structure

```
apps/
  web/    frontend: React, Vite, HeroUI, Tailwind, Zustand
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
