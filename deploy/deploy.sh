#!/usr/bin/env bash
# Deploys main: pulls, installs, migrates, publishes the web build and restarts
# the API and the ingest. Run as the deploy user from anywhere.
set -euo pipefail

export PATH="$HOME/.local/node/bin:$PATH"

REPO="$HOME/apc"
WWW="$HOME/www/apc-dev"
RELEASE="$WWW/releases/$(date +%Y%m%d-%H%M%S)"

# corepack picks the pnpm version from package.json of the current directory
cd "$REPO"
git pull --ff-only
pnpm install --frozen-lockfile

# Migrations read DATABASE_URL from the API settings
(set -a && source apps/api/.env && pnpm --filter @apc/db db:migrate)

pnpm --filter @apc/web build
mkdir -p "$WWW/releases"
cp -r apps/web/dist "$RELEASE"
ln -sfn "$RELEASE" "$WWW/current.tmp"
mv -T "$WWW/current.tmp" "$WWW/current"
# Keep the last 3 releases
ls -1d "$WWW"/releases/* | head -n -3 | xargs -r rm -rf

systemctl --user restart apc-api apc-ingest

echo "Deployed $(git rev-parse --short HEAD)"
