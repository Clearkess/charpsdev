#!/bin/sh
# Render container entrypoint.
#
# Split out from the Dockerfile's CMD (rather than one long inline command)
# so migrations + config caching run every time the container starts, not
# just at build time -- Render's Docker build and the actual running
# container are separate steps, and DB_* env vars (set via the Render
# dashboard, pointing at the managed Postgres instance) are only present at
# runtime, not during `docker build`. Caching config/routes/views here too
# since APP_ENV=production should not resolve .env on every request.
set -e

echo "Running database migrations..."
php artisan migrate --force

echo "Seeding settings (idempotent -- firstOrCreate, safe to re-run)..."
php artisan db:seed --class=Database\\Seeders\\SettingsSeeder --force || true

echo "Caching config/routes..."
php artisan config:cache
php artisan route:cache

# Render injects $PORT; the service must bind 0.0.0.0:$PORT, not localhost.
echo "Starting server on port ${PORT:-8080}..."
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8080}"
