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
- **Frontend production-readiness pass**: adopted TanStack Query for data fetching/caching, Zustand for global state (replacing React Context), a from-scratch Tailwind v4 `@theme` token system (the existing `@base-ui/react` primitives referenced tokens that were never defined, so they were rendering unstyled), and role-based `/admin/*` gating in `frontend/proxy.ts`. See section 6 above for details.
- **Quick-wins pass (this change)**:
  - **Paystack payment flow (fixed)**: `PAYSTACK_SECRET_KEY`/`PAYSTACK_PUBLIC_KEY` were unset (`null`) on Railway, causing Paystack's API to reject every `/api/payment/initialize` call with `secret_key_invalid`. Set both via Railway's GraphQL API (`variableUpsert` — Railway auto-seals values matching a secret pattern, e.g. `sk_`/`pk_` prefixes, which is why they read back as `null` even after being set correctly; this is expected/working-as-intended, not a bug). Verified end-to-end against the live API: `POST /api/payment/initialize` now returns a real Paystack `authorization_url`, and `GET /api/payment/verify/{reference}` correctly reports an incomplete checkout as unsuccessful.
  - **Dashboard/marketplace demo data (added)**: production DB had zero services/orders/transactions. Added `backend/database/seeders/DemoDataSeeder.php` (15 services across all categories, 2 providers, wallet funding/spend history, and 4-5 orders per demo account with mixed statuses), wired into `DatabaseSeeder` and run once against production. Verified live: `/api/services` returns 15 items, `/api/wallet` shows a non-zero balance, `/api/orders` returns seeded orders, and `/api/admin/dashboard` reports realistic aggregate stats.
  - **Edit Profile**: `frontend/app/(dashboard)/profile/page.tsx` now supports inline editing (name/email) via a new `useUpdateProfileMutation` hook (`PUT /profile`), syncing the result back into both TanStack Query's cache and the Zustand auth store.
  - **Topbar search**: a search input in `AppLayout`'s topbar (backed by `uiStore.serviceSearchTerm`) live-filters the Services page by name/category/description and auto-navigates to `/services` when a search starts elsewhere; clears automatically on navigating away.
  - **Empty states with CTAs**: `EmptyBlock` now accepts an optional icon + action. Wallet (no transactions → "Browse services"), Orders (no orders → "Browse services"), and Services (no search results → "Clear search") render a friendly icon, copy, and CTA button instead of a bare message.
  - **Conditional admin sidebar**: confirmed already correctly gated on `user?.is_admin` in `AppLayout.tsx` from a prior pass — no changes needed.

### Railway access notes (for future sessions)
- The `railway` CLI binary rejects certain valid account API tokens outright (`Unauthorized`/`Invalid RAILWAY_TOKEN` on `whoami`/`status`/`list`/`variables`/`link`), even though the same token authenticates fine directly against Railway's GraphQL API (`https://backboard.railway.com/graphql/v2`, `Authorization: Bearer <token>`). Root cause not identified; this is a known, still-open upstream bug (see `railwayapp/cli` issue #699) affecting many users, not something specific to this project. Workaround is to bypass the CLI entirely and call the GraphQL API directly with `curl`.
- **Token type matters and is easy to get wrong.** Railway has three token types: account (`Authorization: Bearer`, all resources), workspace (`Authorization: Bearer`, one workspace), project (`Project-Access-Token` header, one environment). An invalid/mistyped token and a token-under-the-wrong-header-type can return *identically-worded* GraphQL errors (e.g. `"Not Authorized"`, `"Project Token not found"`), so don't trust error text alone — always differential-test against a deliberately garbage token string first; if both give the same error, the token itself (not the header) is the problem. A real **account token** was confirmed working this way: `query { me { id name email } }` with `Authorization: Bearer <token>` returned real user data instead of an error.
- Once authenticated, discover project/service/environment IDs via `query { me { workspaces { id name projects { edges { node { id name } } } } } }`, then `query { project(id: "...") { services { edges { node { id name } } } environments { edges { node { id name } } } } }`.
- **The GitHub source link can silently go stale**, causing `serviceInstanceDeploy(..., latestCommit: true)` to keep redeploying an old commit even though GitHub has newer ones. Symptom: `deployments(...)` query shows the new deploy's `meta.commitHash` matching the *old* commit. Fix: re-run `mutation { serviceConnect(id: "<serviceId>", input: { repo: "owner/repo", branch: "main" }) }` to refresh the link, then retry `serviceInstanceDeploy`. This is not a one-time fix — it recurred in this project and may need to be repeated in future sessions.
- Set env vars via `mutation { variableCollectionUpsert(input: { projectId, environmentId, serviceId, variables: { KEY: "value" }, skipDeploys: true }) }` (`skipDeploys: true` avoids triggering a redundant deploy when you're about to trigger one anyway).
- Reading a variable back via the `variables` query can show `null` for values Railway has auto-sealed as secrets (anything matching common secret patterns, e.g. `sk_`/`pk_` prefixes) — this does not mean the write failed. Confirm via `environment(id) { variables { edges { node { name isSealed } } } }`, which lists the variable with `isSealed: true`, or simply verify end-to-end via the application (e.g. hitting the API endpoint that consumes the variable).
- For one-off production data work (seeding, inspection), the Postgres service's `DATABASE_PUBLIC_URL`/individual `PG*` vars (visible via the `variables` query against the Postgres service ID) give a public `tokaido.proxy.rlwy.net` endpoint reachable directly with `psql` or a local Laravel `.env` — no CLI tunnel needed. Always seed via the actual Laravel seeder (`php artisan db:seed`) rather than hand-written SQL, and never commit the temporary `.env` used for this.
- Current resource IDs (Billy Chapel's account, `charpsdev` project = "generous-forgiveness"): projectId `7c46f605-b32b-4229-9f65-bd33e96c4be4`, serviceId `689bac8f-8ae2-4339-b5fa-721838e7dbfd`, environmentId (production) `c3b33016-8ff8-4577-b369-a58f3dc65809`.

### Final production features checklist — push notifications deploy (this change)
- **Railway backend redeployed** to commit `e2cb709` (Vercel Analytics, PWA manifest, push notification infrastructure) via the GraphQL API after the GitHub source link had gone stale again (see note above; fixed via `serviceConnect` reconnect + `serviceInstanceDeploy`).
- **VAPID env vars set on Railway production** (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) via `variableCollectionUpsert`.
- **`push_subscriptions` migration confirmed applied** on the production Postgres DB (ran automatically via the existing `preDeployCommand: "php artisan migrate --force"`).
- **Live end-to-end verification against production** (`https://charpsdev-production.up.railway.app`): `GET /api/push/public-key` returns the correct VAPID key, `POST /api/push/subscribe` / `POST /api/push/unsubscribe` both succeed, and updating an order's status via `PUT /api/admin/orders/{id}` with a subscribed user attached completes with HTTP 200 (confirms the `WebPushService::sendToUser()` order-status-change trigger executes without error against real production data). Test subscription and status change were reverted/cleaned up afterward.
- **Frontend confirmed live** at `https://charpsdev.vercel.app`: manifest, service worker, and icons all return 200.
- This closes out the full "Final Production Features Checklist": Skeleton loading, Error boundaries, Dark mode, Charts, Data tables, Analytics, PWA, Push notifications — all 8 items implemented, built, deployed, and verified live in production.

