# CharpsDev Deployment Package for Vercel + Railway

This package is arranged as a simple monorepo for production deployment:

- `frontend/` -> deploy to Vercel as a Next.js project
- `backend/` -> deploy to Railway as a Laravel API service

## Recommended architecture
- Frontend: Vercel
- Backend API: Railway
- Database: Railway MySQL or PostgreSQL service

## Monorepo import pattern
Vercel supports deploying a project from a monorepo by selecting the app directory as the project's **Root Directory**. Create one Vercel project for `frontend/`. Railway supports config-as-code via `railway.json`; deploy the `backend/` directory as the Laravel service. [Source](https://vercel.com/docs/monorepos) [Source](https://docs.railway.com/config-as-code/reference)

## 1) Deploy the backend to Railway
Create a Railway project from this repository and set the service root to `backend/`.

### Railway environment variables
Set these in Railway:

```env
APP_NAME=CharpsDev
APP_ENV=production
APP_DEBUG=false
APP_URL=https://YOUR-RAILWAY-BACKEND-DOMAIN

DB_CONNECTION=mysql
DB_HOST=YOUR_RAILWAY_DB_HOST
DB_PORT=3306
DB_DATABASE=YOUR_RAILWAY_DB_NAME
DB_USERNAME=YOUR_RAILWAY_DB_USER
DB_PASSWORD=YOUR_RAILWAY_DB_PASSWORD

CACHE_STORE=database
QUEUE_CONNECTION=database
SESSION_DRIVER=database

MAIL_MAILER=log

PAYSTACK_PUBLIC_KEY=pk_live_or_test_xxx
PAYSTACK_SECRET_KEY=sk_live_or_test_xxx
PAYSTACK_PAYMENT_URL=https://api.paystack.co
```

### Railway first deploy
- Railway will use `backend/railway.json`
- run one successful deploy
- if needed, open a Railway shell and run `php artisan migrate --force`
- optionally run `php artisan db:seed --force` only for non-production demo data

### Backend health
The health endpoint is `/up`, and the deploy config uses that path for health checks. [Source](https://docs.railway.com/config-as-code/reference)

## 2) Deploy the frontend to Vercel
Create a Vercel project from the same repository and set the **Root Directory** to `frontend/`. [Source](https://vercel.com/docs/monorepos)

### Vercel environment variables
Set these in Vercel:

```env
NEXT_PUBLIC_APP_NAME=CharpsDev
NEXT_PUBLIC_API_URL=https://YOUR-RAILWAY-BACKEND-DOMAIN/api
```

Then deploy.

## 3) Post-deploy checks
- Open the Vercel site
- confirm `/login` loads
- verify login works
- verify `/dashboard` loads after login
- verify API calls succeed against the Railway backend
- verify admin login and `/admin/dashboard`
- verify Paystack callback/webhook URLs point to the Railway domain

## 4) Important notes
- This app uses bearer-token auth from the frontend to the Laravel API.
- The frontend route guard is implemented in `frontend/proxy.ts`.
- The backend is configured to return JSON 401 responses for unauthenticated API requests.
- For production, use a managed MySQL/PostgreSQL service instead of SQLite.

## 5) Suggested launch order
1. Deploy Railway backend
2. Configure DB + app env vars
3. Run migrations
4. Confirm `/up` and `/api/login`
5. Deploy Vercel frontend
6. Set `NEXT_PUBLIC_API_URL`
7. Smoke test login, dashboard, wallet, orders, notifications, profile, admin

## 6) Frontend architecture (`frontend/`)

The Next.js frontend uses the following stack for data fetching, state, UI, and route protection:

### Data fetching — TanStack Query (React Query)
- `frontend/lib/queryClient.ts` — shared `QueryClient` instance (retry/staleTime defaults).
- `frontend/lib/queryKeys.ts` — centralized query key factory (`queryKeys.me`, `queryKeys.wallet`, etc.) so cache invalidation stays consistent across hooks.
- `frontend/hooks/queries/*.ts` — one file per domain, each exporting `useXQuery`/`useXMutation` hooks that wrap `api` (axios) calls:
  - `useAuthQueries.ts` (login/register/me/forgot-password/reset-password)
  - `useProfileQuery.ts`, `useWalletQueries.ts`, `useOrdersQueries.ts`, `useServicesQuery.ts`, `useNotificationsQueries.ts`, `useAdminQueries.ts`
- `frontend/components/providers/QueryProvider.tsx` — mounts `QueryClientProvider` + React Query Devtools (dev only), wired into `AppProviders.tsx`.
- Mutations expose `isPending`/`variables`, used across admin/dashboard tables to show a per-row busy state instead of a single global spinner.

### Global state — Zustand
- `frontend/store/authStore.ts` — replaces the old React Context (`AuthContext`, now removed). Holds `token`/`user`, uses the `persist` middleware to survive reloads, and exposes a `hasHydrated` flag so hooks can wait for hydration before firing queries.
- `frontend/store/uiStore.ts` — plain store for UI-only state (mobile sidebar open/close).
- `frontend/hooks/useAuth.ts` — composed hook combining the auth store with the `useMeQuery`/login/logout mutations; this is the single entry point pages/components use for auth state (`useAuth()`), instead of importing the store directly.
- `frontend/components/providers/AuthBootstrap.tsx` — on app start, rehydrates the store and subscribes to a global 401 handler (`lib/api.ts` → `onUnauthorized`) that clears the session and redirects to `/login` when any request comes back unauthorized.

### UI — Tailwind CSS v4 + `@base-ui/react`
- `frontend/app/globals.css` — defines the full `@theme` design-token block (`--color-primary`, `--color-card`, `--color-border`, `--radius-*`, etc.) consumed by every `@base-ui/react`-based primitive in `frontend/components/ui/` (`button`, `card`, `avatar`, `toast`, `dropdown-menu`, `table`, `input`, plus the newly added `badge` and `skeleton`).
- `frontend/components/layout/AppLayout.tsx` — responsive Sidebar (desktop) / off-canvas drawer (mobile, via `uiStore`) + Topbar shell used by both the dashboard and admin route groups.
- `frontend/components/common/StateBlock.tsx` — shared `LoadingBlock`/`ErrorBlock`/`EmptyBlock`, plus `StatCardsSkeleton`/`TableSkeleton` skeleton loaders used while queries are pending.
- Known gap: `--font-geist-sans` is referenced in the theme but not yet wired to a `next/font` loader in `app/layout.tsx`, so text currently falls back to the next font in the stack (`Segoe UI`) rather than Geist.

### Route protection
- **Server/edge**: `frontend/proxy.ts` (Next.js 16's middleware convention) reads the `charpsdev_token` cookie to gate all protected prefixes (`/dashboard`, `/services`, `/wallet`, `/orders`, `/notifications`, `/profile`, `/admin`) and the `charpsdev_role` cookie to additionally redirect authenticated non-admins away from `/admin/*` to `/dashboard`. Authenticated users are redirected away from the auth pages (`/login`, `/register`, etc.).
- **Client**: `frontend/components/auth/ProtectedRoute.tsx` (auth-only) and `frontend/components/admin/AdminGuard.tsx` (admin-only, nested inside `ProtectedRoute` in `app/admin/layout.tsx`) provide a client-side fallback/loading state on top of the edge redirect.
- Both cookies are written by `frontend/lib/cookies.ts` whenever the auth store's token/user change, so the edge and the client always agree on auth/role state.

### Known tooling gap
- Next.js 16 removed the `next lint` subcommand, and the project has no `eslint.config.(js|mjs|cjs)` (ESLint v9 flat config), so `npm run lint` / `npx eslint .` currently do not run. This predates the changes above and is left as follow-up debt — either add a flat config or switch to a different lint runner.

## 7) Changelog / Production fixes

- **Railway 500 errors (fixed)**: root causes were (1) missing `pdo_pgsql`/`pgsql` PHP extensions in the container image and (2) a missing `APP_KEY`. Both are resolved in `backend/composer.json` and Railway env vars.
- **Railway GitHub source link (fixed)**: the service's GitHub source connection had gone stale at the platform data layer (not just a stuck webhook), so new commits weren't deploying. Reconnected via Railway's API; new commits now deploy normally.
- **Admin flow (verified end-to-end)**: promote a user to admin by setting `is_admin = true` on the `users` row (a `user:make-admin` Artisan command exists in `backend/app/Console/Commands/MakeUserAdmin.php` for this). Confirmed pre-promotion `/api/admin/*` returns 403 and post-promotion returns 200 with real data.
- **Vercel "Git Author Verification" block (fixed)**: Vercel's Hobby plan blocks deploys when a commit's author doesn't match the GitHub identity connected to the Vercel project. Fixed by correcting the local git identity to the connected GitHub account (`Clearkess <Clearkess@users.noreply.github.com>`) and rewriting the mismatched commits' author/committer. Going forward, always confirm `git config user.name`/`user.email` match the GitHub account linked to Vercel before committing.
- **Favicon 404 (fixed)**: the frontend had no favicon/icon files at all. Added `frontend/app/favicon.ico`, `frontend/app/icon.png`, and `frontend/app/apple-icon.png` — Next.js App Router auto-detects these files under `app/` and injects the correct `<link rel="icon">` / `<link rel="apple-touch-icon">` tags on every page, no code changes required.
- **Frontend production-readiness pass (this change)**: adopted TanStack Query for data fetching/caching, Zustand for global state (replacing React Context), a from-scratch Tailwind v4 `@theme` token system (the existing `@base-ui/react` primitives referenced tokens that were never defined, so they were rendering unstyled), and role-based `/admin/*` gating in `frontend/proxy.ts`. See section 6 above for details.

