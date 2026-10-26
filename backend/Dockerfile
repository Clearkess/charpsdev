# Vaultra backend (Laravel 13 / PHP 8.4) — built for Render's Docker runtime.
#
# Render has no native PHP buildpack (unlike Railway's Railpack), so this
# backend needs an explicit Dockerfile to deploy there. Single-stage build:
# this is a pure JSON API (no Blade views, no Vite frontend assets — see
# package.json, it only has `vite build` for... nothing actually consumed by
# this app), so there's no Node.js build stage needed, just PHP + Composer.
#
# No queue worker / scheduler needed either: grepped app/Jobs (empty) and
# routes/console.php (only the stock `inspire` command, no ->schedule() calls)
# before writing this — a single web service handles everything synchronously.
FROM php:8.4-cli-bookworm

# System deps + PHP extensions this app actually needs:
#   - pdo_pgsql / pgsql: composer.json explicitly requires these (Render's
#     managed Postgres is the DB here, unlike Railway's MySQL)
#   - the rest (mbstring, xml, zip, gd, bcmath, intl) are the common Laravel
#     set; gd/zip/intl aren't in composer.lock's ext- list but are cheap to
#     include and avoid surprise breakage from any transitive package.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev \
        libzip-dev \
        libpng-dev \
        libonig-dev \
        libxml2-dev \
        libicu-dev \
        unzip \
        git \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_pgsql \
        pgsql \
        mbstring \
        xml \
        zip \
        gd \
        bcmath \
        intl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Install PHP deps first (separate layer -> cached unless composer.* changes)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --no-scripts --prefer-dist

# Now copy the rest of the app
COPY . .

# Finish autoloader + package discovery now that app/ is present
RUN composer dump-autoload --optimize --no-dev \
    && php artisan package:discover --ansi || true

# storage/ and bootstrap/cache/ must be writable (Laravel writes logs, view
# cache, compiled config/routes here) — Render's filesystem is ephemeral
# per-deploy but writable at runtime, which is all Laravel needs since this
# app has no user file uploads (grepped app/ for Storage::/->store(), none).
#
# Also explicitly chmod +x start.sh: it was added to the repo via GitHub's
# "Create new file" web UI (not a local `git add`), which does not preserve
# the executable bit, so `./start.sh` at runtime fails with "Permission
# denied" (exit 126) unless this is set here at build time instead.
RUN chmod -R 775 storage bootstrap/cache \
    && chmod +x start.sh

EXPOSE 8080

# start.sh runs migrations then boots the server — see start.sh in this same
# directory for why this is a separate script instead of inlined here.
# Invoked via `sh` explicitly (not `["./start.sh"]`) as a second safety net
# against the exec-bit issue above — this form only needs start.sh to be
# *readable*, not executable, to run.
CMD ["sh", "./start.sh"]
