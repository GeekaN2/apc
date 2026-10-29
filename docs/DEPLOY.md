# Deploy

Beta runs on the old production server next to the old calculator: Ubuntu 18.04,
nginx, MongoDB and the old Nuxt site and API under root's pm2. Everything of APC
runs as the `gpt` user:

| Part          | Where                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Code          | `~/apc` (main)                                                        |
| Node 24       | `~/.local/node` (glibc 2.17 build, Ubuntu 18.04 has glibc 2.27)       |
| Web           | `~/www/apc-dev/current`, served by nginx                              |
| API           | user service `apc-api` on 127.0.0.1:4100 (the old API has 4000)       |
| Ingest        | user service `apc-ingest`                                             |
| PostgreSQL 15 | local socket, port 5433, database `apc`, peer authentication as `gpt` |

## Once, as root

```bash
# PostgreSQL 15 from the PGDG archive: Ubuntu 18.04 itself has only 10
echo "deb https://apt-archive.postgresql.org/pub/repos/apt bionic-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt-get update && apt-get install -y postgresql-15

# Modest memory next to MongoDB; only local connections
cat > /etc/postgresql/15/main/conf.d/apc.conf <<'EOF'
listen_addresses = 'localhost'
max_connections = 50
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB
EOF
systemctl restart postgresql

# The gpt user connects through the socket without a password (peer)
sudo -u postgres createuser gpt
sudo -u postgres createdb -O gpt apc

# User services of gpt start on boot and keep running without a login
loginctl enable-linger gpt

# Swap: without it the kernel kills the largest process (MongoDB) when memory runs out
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

nginx: `deploy/nginx/dev.albion-profit-calculator.com` serves the web build and
proxies `/api/` to the API.

## Once, as gpt

```bash
cd ~/apc
cp apps/api/.env.example apps/api/.env        # DATABASE_URL, BETTER_AUTH_*, WEB_ORIGINS, PORT=4100
cp apps/ingest/.env.example apps/ingest/.env  # DATABASE_URL
# DATABASE_URL=postgres://gpt@%2Fvar%2Frun%2Fpostgresql:5433/apc

mkdir -p ~/.config/systemd/user
cp deploy/systemd/*.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable apc-api apc-ingest

deploy/deploy.sh
```

Users of the old calculator, read from MongoDB (3.6 on the server, hence the 5.x
driver):

```bash
(set -a && source apps/api/.env && MONGO_URI=mongodb://… pnpm --filter @apc/db db:import-legacy)
```

## Every release

```bash
~/apc/deploy/deploy.sh
```

It pulls main, installs dependencies, applies migrations, publishes the web build
(the last three are kept) and restarts both services.

```bash
systemctl --user status apc-api apc-ingest
journalctl --user -u apc-ingest -f
```

The admin panel shows live orders and the last order per server: an old last
order means the ingest is stuck.

## Notes

- Don't run the whole test suite here: PGlite suites in parallel ran the box out
  of memory once and the kernel killed MongoDB of the old site. CI runs them.
- `/api/market` keeps each city's snapshot in memory for a minute; the API needs
  a restart, not a cache flush, after manual changes in the database.
