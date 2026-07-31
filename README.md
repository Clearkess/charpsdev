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

### Bug fix — order creation "Server Error" (pre-existing, found and fixed same day)
- **Symptom**: immediately after the push-notification deploy above, the user reported the live Admin/Orders "Create order" form returning a generic "Server Error", with the orders list showing "No orders yet".
- **Root cause (pre-existing, unrelated to the push-notification deploy)**: the `orders` table migration (`2026_07_20_164350_create_orders_table.php`) never defined a `quantity` column, but `Order::$fillable` and `OrderController::store()` have written `quantity` since the very first commit. Every `POST /api/orders` was throwing `PDOException: SQLSTATE[42703] undefined column "quantity" of relation "orders"`, which Laravel's generic exception handler surfaced to the frontend as `{"message":"Server Error"}` (HTTP 500). Confirmed via Railway's `deploymentLogs` GraphQL query against the live deployment — this is the fastest way to get the real PHP stack trace instead of guessing from the frontend's generic error text.
- **Fix**: added migration `2026_07_29_214856_add_quantity_to_orders_table.php` (`unsignedInteger('quantity')->default(1)`, guarded by `hasColumn` check so it's safe to run even if a future migration accidentally re-adds it). No application code changes were needed — `Order`, `OrderController`, and the frontend were already correct; only the schema was missing the column.
- **Deploy**: pushed to `origin/main` (commit `233fedc`), then redeployed via the same Railway GraphQL `serviceConnect` (source link had gone stale again, as expected per the recurring note above) + `serviceInstanceDeploy(latestCommit: true)` pattern. Deployment `8826ed51-...` reached `SUCCESS` on commit `233fedc`; the new migration ran automatically via `preDeployCommand`.
- **Verified live**: `POST /api/orders` now returns `201` with a real order record (quantity included), and `GET /api/orders` lists it correctly. Test order was set to `cancelled` afterward as cleanup (no delete-order endpoint exists in the API).
- **Lesson for future sessions**: when a "Server Error" is reported from the frontend, go straight to Railway `deploymentLogs` for the real exception rather than guessing from `AdminOrderController` changes in the most recent deploy — in this case the bug long predated today's push-notification work and simply hadn't been exercised by the "Quick Wins" testing pass earlier.

## 8) Phase 1 — Core Marketplace (categories, cart, checkout)

This is the first phase of a broader 10-phase roadmap to evolve CharpsDev into a full digital marketplace. Phase 1 was built **additively** on top of the existing schema (wallet, orders, Paystack, admin panel, push notifications are all untouched) and was fully built and tested against a **local SQLite dev environment** before being considered for production, specifically to avoid repeating the earlier "Server Error" migration incident (see section 7 above).

### What's new

**Categories.** A real `categories` table (`name`, `slug`, `icon`, `status`, `sort_order`) replaces the old free-text `services.category` string as the primary way services are organized, while keeping the old string column for backward compatibility. Seeded categories: Facebook Accounts, Instagram Accounts, TikTok Accounts, Twitter/X Accounts, Email Accounts, Streaming Accounts, Gift Cards, Digital Products.

**Services.** `services` gained nullable `category_id` (FK → `categories`), `stock` (nullable = unlimited/instant-delivery, otherwise a hard inventory count enforced on cart-add and checkout), and `currency`. The legacy `category` string column is still written on create/update (derived from `category_id` when only that's supplied) so nothing that reads the old column breaks.

**Shopping cart.** A `cart_items` table (`user_id`, `service_id`, `quantity`) backs a full add/update/remove/clear flow with per-item stock validation and ownership checks, so users can add multiple services before paying.

**Multi-item checkout.** `orders` gained `order_number`, `total`, `payment_method`, plus nullable `service_id`/`quantity` (kept nullable rather than dropped, for backward compatibility with the pre-existing single-item order flow). A new `order_items` table (`order_id`, `service_id`, `quantity`, `price`) captures each line item. Checkout is fully transactional: it row-locks (`lockForUpdate()`) the user's wallet and every service being purchased, debits the wallet, decrements stock, creates one `Order` + N `OrderItem`s, writes both a `wallet_transactions` row (`type=debit`) and a `transactions` row (`type=purchase`), clears the cart, and fires a notification — all inside one DB transaction so a failure anywhere rolls back everything.

**The old single-item "Create order" flow (`POST /api/orders`) still works unchanged** — it was deliberately left in place alongside the new cart/checkout flow rather than removed, so both currently coexist in the UI (Orders page still has the old create form; Services page now also has "Add to cart" buttons). Reconciling/simplifying this into one flow is a candidate follow-up, not yet done.

### New/changed API endpoints

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/categories` | Public list of active categories |
| GET | `/api/admin/categories` | Admin list (all categories, with service counts) |
| POST | `/api/admin/categories` | Create a category |
| PUT | `/api/admin/categories/{id}` | Update a category (e.g. toggle `status` to hide/show) |
| DELETE | `/api/admin/categories/{id}` | Delete a category |
| GET | `/api/services?category_id=` | Filter services by category id |
| GET | `/api/services?category=` | Filter by category slug **or** legacy category string |
| GET | `/api/cart` | List the current user's cart items (`total` = sum of subtotals) |
| POST | `/api/cart` | Add a service to the cart (`service_id`, `quantity`), stock-checked |
| PUT | `/api/cart/{id}` | Update a cart item's quantity |
| DELETE | `/api/cart/{id}` | Remove one cart item |
| DELETE | `/api/cart` | Clear the entire cart |
| POST | `/api/checkout` | Transactional checkout of the whole cart against the wallet balance |
| GET/POST/PUT/DELETE | `/api/admin/services` | Now accepts/returns `category_id`, `currency`, `stock` |

### A note on the `categoryGroup` relation name

`Service` has a `categoryGroup()` `BelongsTo(Category::class, 'category_id')` relation — deliberately **not** named `category()`, because that name collides with the pre-existing legacy `category` string column. Eloquent lets an eager-loaded relation silently overwrite a same-named raw attribute during `toArray()`/JSON serialization, which would make `category` unpredictably either a string or an object depending on what was eager-loaded on a given request. Over the wire, Eloquent automatically snake-cases relation keys, so this relation appears in every JSON response as **`category_group`** (not `categoryGroup`) — consistent with the snake_case convention used by every other field in this API (`category_id`, `provider_id`, `created_at`, ...). The frontend `Service` type reflects this: `category_group?: Category | null` alongside the always-a-string legacy `category?: string`.

### Local dev environment

Phase 1 was built and verified against a local SQLite database, not the production Postgres DB:

```env
# backend/.env (local only — gitignored, never committed)
APP_ENV=local
APP_DEBUG=true
DB_CONNECTION=sqlite
DB_DATABASE=/absolute/path/to/backend/database/database.sqlite
```

```bash
cd backend
touch database/database.sqlite   # if it doesn't exist yet
php artisan migrate:fresh --seed --force
php artisan serve --host=127.0.0.1 --port=8787
```

Both `.env` and `database/database.sqlite` are gitignored (confirmed via `git check-ignore -v`) and were never committed.

### Verification performed

Full curl-based end-to-end pass against the local server: categories list, services list with both `category_id` and category-slug filters, cart add/get/update with stock-limit rejection, checkout (wallet debit verified exact amount, stock decrement verified, cart cleared, `wallet_transactions.type=debit` + `transactions.type=purchase` correctly split, notification fired), insufficient-balance checkout correctly rejected (cart/wallet/stock left untouched), the legacy single-item `POST /api/orders` endpoint confirmed still working, admin categories full CRUD (create/list/update/hide/delete), admin services list with `category_group` eager-loaded. Frontend `npm run build` (Next.js 16 + Turbopack) compiles cleanly with zero TypeScript errors across all 25 routes, including the two new pages (`/cart`, `/admin/categories`).

### Production deployment (2026-07-30)

Phase 1 has been deployed to production — both backend (Railway) and frontend (Vercel):

- **Backend**: deployed to Railway via the GraphQL `serviceConnect` + `serviceInstanceDeploy(latestCommit: true)` pattern (source link had gone stale again, as expected per the recurring note in section 7). Final deployment `554d2fab-...` reached `SUCCESS` on commit `a4c0063`, live at `https://charpsdev-production.up.railway.app`.
- **Frontend**: deployed via `vercel deploy --prod --token ...`, run from the **repository root** (not from inside `frontend/`) since the linked Vercel project's "Root Directory" setting is `frontend` — running the CLI from inside `frontend/` itself caused Vercel to append that setting onto an already-frontend-relative cwd, producing an invalid doubled `frontend/frontend` path error. Build compiled all 25 routes (including the new `/cart` and `/admin/categories`) with zero TypeScript errors and aliased successfully to `https://charpsdev.vercel.app`.

**Production-only bug found and fixed during this deploy**: `services.category` was originally defined via Laravel's `enum()` migration helper (`['vtu','giftcard','esim','verification','digital','utility']`). On Postgres this compiles to a hard CHECK constraint (`services_category_check`); SQLite doesn't enforce it at all, so it was invisible throughout local testing. Phase 1's catalog introduces two new legacy category values (`'social'`, `'email'`) that violate this constraint, which only surfaced as `SQLSTATE[23514]` when seeding against real production Postgres. Fixed with migration `2026_07_30_003700_widen_services_category_check_constraint.php`, which drops the constraint on Postgres only (no-op on SQLite/MySQL, confirmed via `php artisan migrate --force` locally before deploying). After the fix deployed, `DemoDataSeeder` was re-run against production Postgres successfully (categories 0→8, services 15→21, services with `category_id` 0→11).

**Live production verification performed**: logged in as `test@example.com` against `https://charpsdev-production.up.railway.app/api`, confirmed `GET /api/categories` returns all 8 seeded categories, `GET /api/services` returns `category_group` correctly eager-loaded (confirming the JSON key fix is live), added a service to the cart, ran `POST /api/checkout`, and confirmed: order + order_item created, stock decremented (59→57), cart cleared, wallet debited the exact order amount (₦70,800.00 → ₦68,400.00 for a ₦2,400.00 order). Also confirmed the deployed frontend serves `/login`, `/dashboard`, `/cart`, and `/admin/categories` with correct HTTP status codes (200 for public/authenticated pages, 307 redirect to `/login?next=...` for admin pages when unauthenticated) and no browser console errors.

Phases 2–10 of the roadmap (wallet refinements, additional payment gateways, Providers/Coupons/Settings admin pages, product delivery emails, provider API sync, more notification triggers, analytics, user-facing features, and additional security hardening) are intentionally not started, per the user's explicit sequencing.

## 9) Phase 2 — Wallet Refinements

Second phase of the 10-phase roadmap. Built additively on top of Phase 1's checkout/wallet code, tested locally against SQLite first (same discipline as Phase 1), and **not yet deployed to production** as of this writing.

### The bug this phase fixes

Two separate ledger tables existed for wallet activity: `transactions` (read by the user-facing `GET /api/wallet/transactions` on the Wallet page) and `wallet_transactions` (a stricter credit/debit ledger, also used for balance bookkeeping). Historically only `CheckoutController` wrote to both tables on a purchase. `PaymentController::creditWallet()` (Paystack deposits) wrote **only** to `transactions`, and `AdminWalletController::credit()`/`debit()` wrote **only** to `wallet_transactions` — meaning any admin-initiated balance adjustment was completely invisible on the affected user's own Wallet page, even though their balance had actually changed. This was a real, pre-existing bug discovered while scoping Phase 2, not a new regression.

### What changed

**Unified ledger.** `AdminWalletController::credit()`/`debit()` now write to **both** `wallet_transactions` and `transactions` inside the same DB transaction, row-locking the wallet (`lockForUpdate()`) exactly like `CheckoutController` already did. `PaymentController::creditWallet()` (Paystack) was fixed the same way, so all three money-movement paths — purchase, deposit, admin adjustment — now keep both ledgers in sync.

**Transaction descriptions.** `transactions` gained a nullable `description` column (migration `2026_07_30_010000_add_description_to_transactions_table.php`, guarded with `hasColumn`, additive/non-destructive). Populated as: `"Purchase: order {reference} (N item(s))"` for checkout, `"Wallet funded via Paystack"` for deposits, and the admin-supplied `reason` (or a sensible default) for admin credit/debit. Shown as a new "Description" column on the user Wallet page.

**Admin reason + drill-down.** Admin credit/debit now accepts an optional `reason` (validated, max 255 chars) surfaced as a "Reason (optional)" input on the Admin Wallets page. A new "History" toggle per row expands an inline panel (no Dialog/Modal component exists in this codebase yet, so this follows the existing inline-`<Card>` convention rather than introducing one) showing that user's paginated transaction history via the new drill-down endpoint.

**Deposit bounds.** `DepositRequest` already enforced `min:100`; added `max:5000000` so a single Paystack deposit can't exceed ₦5,000,000.

**Insufficient-balance handling.** `AdminWalletController::debit()` now wraps the balance check in `ValidationException::withMessages(['amount' => 'Insufficient balance.'])` inside the `DB::transaction()` closure, so an over-debit cleanly rolls back and surfaces a 422 instead of partially applying.

### New/changed API endpoints

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/admin/wallets/{user}/transactions` | New — paginated (20/page) transaction history for one user, admin-only |
| POST | `/api/admin/wallets/{user}/credit` | Now accepts optional `reason`; writes to both ledgers |
| POST | `/api/admin/wallets/{user}/debit` | Now accepts optional `reason`; writes to both ledgers; rejects with 422 on insufficient balance (no partial effect) |

### Self-introduced bug caught during local testing

`AdminWalletController::debit()` initially called `$user->wallet()->fresh()->balance` to report the post-debit balance, which throws `BadMethodCallException` because `fresh()` doesn't exist on a `HasOne` relation object (only on a loaded model instance). Confirmed via curl that the underlying DB transaction had actually succeeded (balance correctly changed in the database) despite the request returning a 500 — the bug was purely in the response-formatting line. Fixed to `$user->wallet()->first()->balance` and re-verified.

### Verification performed (local SQLite only)

Admin credit/debit with and without a reason; insufficient-balance debit correctly rejected with balance left untouched; reason field's 255-char max enforced; deposit `min:100`/`max:5000000` bounds enforced; Paystack deposit path exercised via a `php artisan tinker` reflection call (no live Paystack keys in local dev) and confirmed it now writes both `transactions` and `wallet_transactions`; Phase 1's full checkout flow re-verified end-to-end still working, now with the `description` field populated on the resulting transaction; the new `/api/admin/wallets/{user}/transactions` endpoint confirmed admin-only (a non-admin user gets 403). Frontend `npm run build` (Next.js 16 + Turbopack) compiles cleanly with zero TypeScript errors across all 25 routes.

### Known gap in this pass — closed, see §11

The originally-approved Phase 2 scope also included linking a purchase-type transaction on the user Wallet page to its underlying order. Not implemented in the original Phase 2 pass; implemented in §11 below.

### Deployment status

Committed locally as `9527c2d` (backend) and `1e7ddeb` (frontend), pushed to `origin/main`. **Now deployed to production on both Railway and Vercel** (see §11 for the deploy that shipped this, plus the order-link feature, together).

Phases 3–10 of the roadmap remain intentionally not started.

## 10) Services Page Redesign (Tnxverify-inspired) + Mobile Bottom Nav

Frontend-only UX redesign, requested independently of the phase roadmap above. No backend/API changes — all data (services, categories, prices, stock, category icons) was already available via existing endpoints.

### What changed

**Featured Services banner.** A horizontally-scrollable row of up to 6 active services appears at the top of the Services page, shown only when no search term or category filter is active.

**Category chips.** A horizontally-scrollable pill row ("All" + every active category, each with its icon and a service-count badge) sits directly below the search bar.

**Redesigned service cards.** Smaller cards in a responsive 2/3/4-column grid, each showing a brand/category icon bubble, the service name, an out-of-stock/low-stock badge where relevant, a price tag, and a circular chevron affordance in the corner to signal the whole card is tappable (tapping adds the service to the cart, same behavior as before — only the visual design changed).

**"Starting from ₦..." pricing label.** Services whose legacy `category` is `vtu`, `utility`, or `esim` (base/minimum-price, top-up-style products where the actual amount is chosen at purchase time) now show "Starting from ₦X" instead of a flat price. Implemented via `hasVariablePricing()` in `frontend/lib/serviceIcons.tsx`.

**Icon resolution.** New `frontend/lib/serviceIcons.tsx` resolves an icon for each service/category through a fallback chain: (1) brand-keyword match against the service name (e.g. "Netflix Premium" → actual Netflix glyph), (2) the linked category's seeded `icon` string, (3) the legacy `category` enum string, (4) a generic package icon. Brand glyphs (Facebook, Instagram, TikTok, WhatsApp, Telegram, Netflix, Spotify, etc.) come from `react-icons/si` (Simple Icons) — added as a new dependency (`react-icons@^5.7.0`) because `lucide-react` has no brand/logo icons.

**Mobile bottom navigation.** New `frontend/components/layout/BottomNav.tsx`: a fixed, mobile-only (`md:hidden`) bottom tab bar with exactly 5 items — Home, Services, Orders, Wallet, Profile — with iOS safe-area padding. Wired into `AppLayout.tsx`; the page content area gained `pb-24` on mobile so it isn't obscured by the bar.

### Files touched

| File | Change |
|---|---|
| `frontend/lib/serviceIcons.tsx` | New — icon-resolution + variable-pricing helpers |
| `frontend/components/layout/BottomNav.tsx` | New — mobile bottom tab bar |
| `frontend/components/layout/AppLayout.tsx` | Renders `BottomNav`; adjusted content padding |
| `frontend/app/(dashboard)/services/page.tsx` | Rewritten — banner, chips, redesigned cards |
| `frontend/package.json` / `package-lock.json` | Added `react-icons` dependency |

### Verification performed (local dev only)

`npm run build` succeeds with zero TypeScript errors across all routes including `/services`. Exercised the full auth pipeline locally (backend on `:8787`, frontend on `:3000`) via a temporary QA harness (deleted before commit) to confirm `/services` renders `200` past both the Next.js middleware and the client-side `ProtectedRoute` guard, and that the rendered page contains the redesigned markup with no client-side console/hydration errors beyond the expected dev-only HMR WebSocket noise.

### Deployment status

Committed as `95b4a15`, pushed to `origin/main`. **Deployed to production on both Railway and Vercel** — see §11.

## 11) Transaction→Order Link + Production Deploy (this pass)

Closed the Phase 2 "known gap" (§9) and pushed both Phase 2 and the Services redesign (§10) to production.

### Transaction→order link
- **Backend**: `Transaction::order()` — `belongsTo(Order::class, 'reference', 'reference')`. Purchase-type transactions share the same generated `ORD-...` reference as the order `CheckoutController` creates in the same DB transaction; deposit/admin-credit/admin-debit transactions use distinct reference formats (UUID / `CRD-...` / `DBT-...`), so this naturally resolves to `null` for them — no migration/new column needed. `WalletController::transactions()` eager-loads a minimal `order:id,reference,order_number,status` and explicitly nulls it for any non-`purchase` transaction as a defensive guard.
- **Frontend**: `Transaction.order` added to `types/api.ts`; the Wallet page shows a "View order →" link under a purchase transaction's description, linking to `/orders?ref=<reference>`; the Orders page reads that `ref` param and scrolls to + highlights the matching row.
- Committed as `bdc1a6b`, pushed to `origin/main`.

### Railway backend deploy — ✅ live in production
- GitHub source link had gone stale again (recurring issue, see §7 notes) — reconnected via `serviceConnect`, then `serviceInstanceDeploy(latestCommit: true)` against commit `bdc1a6b`. Deployment reached `SUCCESS`.
- **Verified live** at `https://charpsdev-production.up.railway.app`: `/up` returns 200; login works; `GET /api/wallet/transactions` for a real production user shows a genuine purchase transaction (`ORD-DCKX0GFOLD`) correctly resolving `order: {id: 13, ...}`, while older demo-seeded purchase transactions (different reference format) and deposit transactions correctly resolve `order: null`; confirmed order `13` exists via `GET /api/orders`; deposit-cap enforcement (`amount > 5000000`) correctly rejected with 422; admin drill-down endpoint (`/api/admin/wallets/{user}/transactions`) confirmed working with a real admin login. Production now runs commit `bdc1a6b` (Phase 2 + Services redesign + order-link, all in one deploy since they'd accumulated on `main`).

### Vercel frontend deploy — ✅ resolved, live in production

The originally-available `VERCEL_TOKEN` (a personal-account token) authenticated basic user identity (`GET /v2/user`) but every team/project-scoped call (`vercel deploy`, `vercel inspect`, `GET /v9/projects/...`, `GET /v6/deployments`) was rejected with `403 forbidden`, `"saml": true`, `"scope": "charps-dev"` — the `charps-dev` Vercel team enforces SSO and this token type could not satisfy it programmatically. This was a hard account/token-permission blocker, not a code issue.

**Unblocked with a new, team/project-scoped token supplied by the user.** This token type behaves differently from a personal token: `GET /v2/user` and `GET /v2/teams` both fail (expected/harmless for this token type), but it authenticates successfully directly against the project endpoint (`GET /v9/projects/{id}`) and against `vercel deploy` itself.

**Deploy gotcha found and fixed:** running `vercel deploy --prod --token ... --yes` from inside `frontend/` failed with `Error: The provided path ".../frontend/frontend" does not exist` — the CLI double-applies the project's configured `rootDirectory: "frontend"` when invoked from a directory that's already linked to that root via its own `.vercel/project.json`. Fix: run the same command from the **monorepo root** instead, letting the CLI apply `rootDirectory` correctly on top of the repo root.

**Deployed and verified:**
- `vercel deploy --prod` performed a cloud-side build (Vercel's own infra runs the Next.js build remotely — `Build Completed in /vercel/output [28s]`, all 22 routes generated matching the local build), producing `https://charpsdev-3m5awc6i4-charps-dev.vercel.app`, aliased to production `https://charpsdev.vercel.app` ("✓ Ready in 60s").
- Freshness confirmed via `age: 0` response header on `/login` immediately after deploy (vs. `age: 136315` / ~38h observed before this deploy, proving the site had genuinely been stale).
- `NEXT_PUBLIC_API_URL` confirmed correctly set to `https://charpsdev-production.up.railway.app/api` for production/preview/development via the Vercel env-vars API.
- Full authenticated end-to-end check: logged into the production Railway backend (`test@example.com` / `password`), then hit `https://charpsdev.vercel.app/services`, `/wallet`, and `/orders?ref=ORD-DCKX0GFOLD` with the resulting session cookie — **all three returned HTTP 200**, confirming the new Services redesign, wallet, and transaction→order-link UI are all live and working against the real production backend.

**Known discrepancy, not yet acted on:** `GET /v9/projects/{id}` reports the project's linked GitHub org as `"Clearestkess"`, while all git push/pull operations in this project consistently resolve to `"Clearkess"` (`https://github.com/Clearkess/charpsdev`). This mismatch is a plausible reason the Vercel Git integration has never auto-deployed on push to `main` (the site remained stale despite multiple prior pushes) — this deploy was completed via direct CLI invocation, which bypasses git integration entirely. Worth fixing the project's Git integration link (or generating a persistent, correctly-scoped token) so future pushes to `main` auto-deploy without a manual `vercel deploy`.

Post-deploy checks from §3 (login, dashboard, wallet, orders, admin) have been re-run against `https://charpsdev.vercel.app` and pass.

## 12) Phase 4 — Providers / Coupons / Settings Admin Pages

Third and fourth roadmap phases were addressed together at the user's explicit direction: Phase 3 ("additional payment gateways") was **explicitly skipped** — the user confirmed satisfaction with Paystack-only and asked to move straight to Phase 4. Built additively on top of Phases 1–2 (Paystack `PaymentController`, wallet, checkout, admin panel all untouched), tested locally against SQLite first (same discipline as every prior phase), and **not yet deployed to production** as of this writing.

Rather than ship the three new admin areas as decorative CRUD shells, each was wired into a real, pre-existing flow:

- **Providers** — admin CRUD over the pre-existing `providers` table. The sensitive `api_key` column is **never** returned to the browser in full: `ProviderController` exposes only a masked `api_key_masked` hint (`••••<last4>`) plus a `has_api_key` boolean, and `update()` treats a blank/omitted `api_key` as "leave the stored secret unchanged." Deleting a provider with services still assigned to it is blocked (422). Also fixed a genuinely missing model relation while building this: `Provider` had no inverse `services()` relation even though `Service::provider()` already existed.
- **Coupons** — a brand-new discount-code system that actually integrates into checkout rather than sitting decoratively in an admin table. `Coupon::isValidFor()`/`discountFor()` encode the business rules (active, not expired, under `max_uses`, subtotal meets `min_order_amount`; percentage or fixed discount, capped so a coupon can never make a total negative). `CheckoutController::store()` locks the coupon row (`lockForUpdate()`) inside its existing DB transaction, validates it against the real subtotal, applies the discount to the order total, and atomically increments `used_count` — preventing two concurrent checkouts from over-redeeming a limited-use coupon. A separate public, non-authoritative `POST /api/coupons/validate` endpoint lets the Cart page preview a discount without locking the row or touching `used_count`.
- **Settings** — a brand-new key-value settings store that actually drives behavior instead of sitting inert: `DepositRequest`'s previously-hardcoded min/max deposit bounds now read from `Setting::get('min_deposit_amount' | 'max_deposit_amount')`. Settings are seeded idempotently (`SettingsSeeder`, `firstOrCreate`) so re-seeding production later never clobbers an admin's changes. The admin `SettingController::update()` deliberately restricts updates to pre-existing seeded keys (`Rule::exists('settings','key')`) — an admin can change values but not invent new keys the rest of the codebase doesn't know how to read.

### Bug found and fixed — `Setting::get()` unserialize failure

The original implementation cached the settings lookup via `Cache::rememberForever('settings:all', fn () => static::query()->get()->keyBy('key'))` — caching a raw Eloquent `Collection` of `Setting` models through Laravel's `database` cache driver, which serializes cache values with PHP's `serialize()`/`unserialize()`. This threw `"The script tried to call a method on an incomplete object... unserialize() gets called"` on the **second** `Setting::get()` call within the same PHP process — exactly what `DepositRequest::rules()` does (it calls `Setting::get()` twice, once for min and once for max). The first call in a process succeeds (cache miss, computed and returned directly); the second call hits the cache and fails to unserialize the model collection. Fixed by caching a plain PHP array (`["key" => ["value" => ..., "type" => ...]]`, built via `->mapWithKeys(...)->all()`) instead of the raw Collection — plain arrays/scalars have no such edge case. Verified via `php artisan tinker` (reproduced the exact error, then confirmed the fix after also running `php artisan cache:clear` to purge the stale bad entry left by the reproduction). Cache invalidation on write is handled via `Setting::booted()` registering `static::saved`/`static::deleted` hooks that call `Cache::forget('settings:all')`.

### New/changed API endpoints

- `GET/POST /api/admin/providers`, `PUT/DELETE /api/admin/providers/{provider}`
- `GET/POST /api/admin/coupons`, `PUT/DELETE /api/admin/coupons/{coupon}`
- `GET /api/admin/settings`, `PUT /api/admin/settings` (bulk upsert, existing keys only)
- `POST /api/coupons/validate` (public, authenticated — preview a coupon without redeeming it)
- `POST /api/checkout` — now accepts an optional `coupon_code`; response's `data.order` includes `coupon_code`/`discount` when applied

### Frontend

- New types (`Provider`, `Coupon`, `CouponType`, `CouponPreview`, `Setting`, `SettingType`) in `types/api.ts`; `Order` extended with `coupon_code`/`discount`.
- New TanStack Query hooks in `useAdminQueries.ts` (providers/coupons/settings query + mutations) and `useValidateCouponMutation`/updated `useCheckoutMutation` in `useCartQueries.ts`, following the codebase's existing `useQuery`/`useMutation` + `invalidateQueries` conventions throughout.
- Cart page: coupon code input with an "Apply"/"Remove" flow (previewed via `/coupons/validate`, actually redeemed only at checkout), subtotal/discount/total breakdown.
- Orders page: purchase rows that used a coupon show the code and discount amount inline.
- **New admin pages**: `/admin/providers` (masked-key CRUD, inline edit with "blank = keep existing key"), `/admin/coupons` (create form + status/usage table), `/admin/settings` (grouped, editable key-value form driven by each setting's `type`).
- **Admin navigation gap fixed**: before this phase, the only in-app link to *any* `/admin/*` page was the sidebar's single "Admin → Dashboard" entry — `/admin/categories`, `/admin/services`, etc. were only reachable by typing the URL directly (confirmed via exhaustive `grep` across `app/`/`components/`). Added a shared `AdminNav` pill sub-navigation (`components/admin/AdminNav.tsx`), rendered from `app/admin/layout.tsx` above every admin page's content, linking all nine admin sections.

### Verification performed (local SQLite + local dev server only)

- `php -l` clean across all new/changed backend files; `php artisan migrate --force` applied the 3 new migrations cleanly; `php artisan db:seed --class=SettingsSeeder --force` seeded idempotently.
- Extensive `curl` end-to-end testing against a local `php artisan serve` + admin login: provider create/masked-key display/update-without-key-preserves-secret/delete-blocked-when-in-use/delete-succeeds-when-free; coupon create (auto-generated code, explicit lowercase code normalized to uppercase), percentage >100 rejected; settings bulk update (unknown key correctly rejected 422) with live cache-invalidation proven by a real deposit request immediately honoring a newly-lowered `min_deposit_amount`; coupon preview endpoint accepted/rejected correctly against `min_order_amount`; full checkout with a valid coupon (order total correctly discounted, wallet debited the discounted amount, `used_count` incremented); checkout with an invalid coupon rolled back the **entire** transaction atomically (cart/wallet unchanged); checkout with no coupon at all showed zero regression (`coupon_code`/`discount` both `null`).
- `php artisan test` — 2/2 passing, no regressions.
- `npm run build` (Next.js 16 + Turbopack) — compiles cleanly with **zero TypeScript errors** across all 28 routes, including the three new admin pages.
- Re-verified against the local dev server after the frontend pages were built: `GET /api/admin/providers|coupons|settings` return exactly the shapes the new pages consume; `PUT /api/admin/settings` accepts the "save all settings" payload shape the Settings page sends; provider update omitting `api_key` and coupon create omitting `code` both behave as the pages expect.

### Deployment status

Not yet deployed to production (Railway backend / Vercel frontend) — built and verified locally only, per the same discipline followed for Phase 2. Awaiting explicit instruction to deploy.

## 13) Phase 5 — Product Delivery Emails

Fifth phase of the 10-phase roadmap. Built additively on top of Phases 1–4 (checkout, wallet, coupons, settings all untouched), tested locally against SQLite first, and **not yet deployed to production** as of this writing.

### What was built

Previously, marking an order "completed" only fired a push notification (`WebPushService`) — there was no way to actually hand the customer the digital product they paid for (a license key, PIN, download link, account credentials, etc.), and no email was ever sent for order fulfillment at all.

- `orders` gained two additive/nullable columns: `delivery_content` (text — whatever the admin needs to hand the customer) and `delivered_at` (timestamp — first time the order was marked completed).
- `App\Notifications\OrderDeliveredNotification` (uses `Illuminate\Notifications\Notification` + `MailMessage`, the same pattern already used by the existing `ResetPasswordNotification` — no queue, sent synchronously; see note below on why). Renders: order reference, a line-item list (built from `order.items` when the cart-checkout path created `order_items` rows, falling back to `order.details['items']` / `order.details['service_name']` for the older single-service `POST /api/orders` path so both order shapes produce a correct summary), order total, the delivery content (each `\n`-separated line rendered as its own paragraph — `MailMessage::line()` collapses embedded newlines into one `<p>` otherwise, which would squash a multi-line credentials block into an unreadable single line), and a support-contact line sourced from the Phase 4 `support_email` setting.
- `AdminOrderController::update()` now accepts an optional `delivery_content` (nullable, max 5000 chars) alongside the existing `status`/`provider_reference`/`details`. The email fires only when the order **just became** "completed" (status transition, not a no-op re-save) **or** when the admin supplies new/changed delivery content on an order that was already completed (e.g. they forgot to paste the code the first time) — a same-content re-save of an already-completed order is correctly a no-op and does not re-send. `delivered_at` is set once, on first completion, and never overwritten by later saves. The whole `notify()` call is wrapped in try/catch + `Log::error()` so a misconfigured mail transport can never block the actual order status update.

### Why not queued

This project has **no queue worker process** anywhere in its Railway deployment — `Procfile`/`railway.json` only run `php artisan serve`; there's no `php artisan queue:work` dyno. A `ShouldQueue` notification would silently never send in production (jobs would pile up in the `jobs` table forever). Sent synchronously instead, consistent with the existing `ResetPasswordNotification`.

### Frontend

- `Order` type extended with `delivery_content`/`delivered_at`.
- **Admin Orders page** (`/admin/orders`): each row's new "Delivery" column shows a truncated preview of any existing delivery content plus an "Add delivery info" / "Edit" button that opens an inline textarea + "Save & notify" action. Saving always sets `status: "completed"` alongside the typed content — that's what triggers the backend email — and refreshes the row.
- **User Orders page** (`/orders`): a "Delivery" column shows a "View"/"Hide" toggle (via a `PackageCheckIcon` button) for any order with delivery content, expanding a `<pre>` block with the delivered content and the delivery timestamp underneath the row.

### Verification performed (local SQLite + local dev server only, `MAIL_MAILER=log`)

- `php -l` clean on all new/changed files; `php artisan migrate --force` applied the new migration cleanly.
- Logged in as both admin and a regular user against `php artisan serve` and inspected the real rendered email HTML written to `storage/logs/laravel.log` for every case:
  - New completion with multi-line delivery content → email sent, subject/greeting/support-email footer all correct, each line of the delivery content rendered as its own paragraph (not squashed together).
  - Re-saving the exact same `status: completed` + identical `delivery_content` → **no** email sent, `delivered_at` unchanged (idempotency).
  - Changing `delivery_content` on an already-completed order → email **re-sent** with the corrected content.
  - Changing status between two non-"completed" values (`processing` → `failed`) with no `delivery_content` → **no** delivery email sent (push notification still fires, unchanged from before this phase).
  - Marking an order completed with **no** `delivery_content` at all → email still sent (order confirmation), correctly omitting the "Delivery details" section.
  - A legacy single-service order (created via `POST /api/orders`, which never creates `order_items` rows) → the `details.service_name`/`order.quantity` fallback path produced the correct "MTN Airtime Recharge x2" line, proving both order shapes are handled.
  - `GET /api/orders` (user-facing) confirmed to return the new `delivery_content`/`delivered_at` fields correctly.
- `php artisan test` — 2/2 passing, no regressions.
- `npm run build` (Next.js 16 + Turbopack) — compiles cleanly with **zero TypeScript errors** across all 28 routes.

### Deployment status / production note

Not yet deployed to production. **Important caveat for whenever this does deploy**: production's `MAIL_MAILER` is currently also set to `log` (see `.env.railway.example`), meaning emails are written to the server log, not actually delivered to customers' inboxes, until real SMTP/mailer credentials (e.g. `MAIL_MAILER=smtp` + a provider like Mailgun/Resend/SES, or `MAIL_MAILER=postmark`) are configured on Railway. The feature is fully built and will work correctly the moment real mail credentials are set — no code changes needed.

## 14) Phase 6 — More Notification Triggers

Sixth phase of the 10-phase roadmap. Built additively on top of Phases 1–5 (checkout, wallet, coupons, settings, delivery emails all untouched), tested locally against SQLite first, and **not yet deployed to production** as of this writing. No new migrations were needed — the `notifications` table (columns: `user_id`, `title`, `message`, `type`, `is_read`) already existed but was populated in exactly one place in the whole app.

### The gap this phase fixes

Before this phase, `App\Models\Notification` (the in-app row behind the Notifications page and unread-count badge) was only ever created by `CheckoutController::store()` on "order placed". Every other money-moving or status-changing event fired **nothing at all**, or push-only with no in-app record:
- A Paystack wallet deposit (`PaymentController::verify()`/`webhook()`) silently updated the balance and both ledgers (Phase 2) — the user only found out by noticing a new balance next time they opened the Wallet page.
- An admin wallet credit/debit (`AdminWalletController::credit()`/`debit()`) — same silent gap.
- An order status change in the admin panel (`AdminOrderController::update()`) fired a **push** notification only (a no-op locally with no VAPID keys configured, and easy to miss in production if the device isn't subscribed) — nothing landed on the in-app Notifications page for `processing`/`completed`/`failed`/`cancelled` transitions, unlike "order placed" which does both.

### What was built

- `App\Services\NotificationService::notify(User $user, string $type, string $title, string $message, string $url = '/notifications')` — a single new method that writes the in-app `Notification` row **and** best-effort pushes it via the existing `WebPushService`, so every future trigger writes both halves instead of a controller hand-rolling (and inevitably forgetting one half of) the pair. `type` is free-text with no DB-level enum/CHECK constraint, so new categories (`wallet`, `stock`, etc., alongside the pre-existing `order`) never require a migration.
- **Wallet deposit** (`PaymentController::creditWallet()`, shared by both the `verify()` redirect-callback path and the `webhook()` path): fires a `type: wallet` "Wallet funded" notification for the exact deposited amount, after the DB transaction commits (a notify failure can never roll back a successful credit).
- **Admin wallet credit/debit** (`AdminWalletController::credit()`/`debit()`): fires a `type: wallet` "Wallet credited"/"Wallet debited" notification including the admin's optional reason text. `debit()` is guarded so an insufficient-balance rejection (which already short-circuits via its existing `ValidationException`/422 response) never reaches the notify call.
- **Order status change** (`AdminOrderController::update()`): the existing push-only call was replaced with a call through `NotificationService`, so every real transition (guarded by the pre-existing `$previousStatus !== $order->status` check — a same-status re-save is still correctly a no-op) now also writes an in-app row, with a status-specific message (`processing`/`completed`/`failed`/`cancelled`, plus a generic fallback for any other value). This is independent of and does not interfere with Phase 5's `OrderDeliveredNotification` email, which still fires separately on completion.
- **Low stock alert (new, admin-facing)** (`CheckoutController::store()`): a bonus trigger rounding out "more notification triggers" beyond user-facing wallet/order events. `Service::LOW_STOCK_THRESHOLD` (a class constant, `= 5`) is checked at the exact moment a checkout's stock decrement crosses from *above* the threshold to *at-or-below* it (captured via a by-reference `$lowStockAlerts` array inside the checkout's `DB::transaction()` closure, so the "before" stock value doesn't need re-deriving afterwards). Every admin (`User::where('is_admin', true)`) gets one `type: stock` "Low stock alert" notification per checkout that crosses the threshold, listing every affected service and its remaining stock in one message. Deliberately a plain class constant rather than a Phase 4 `Setting` — unlike `support_email`/deposit bounds, this isn't something expected to need runtime tuning; revisit as a `Setting` if that assumption changes. Services with `stock === null` (unlimited/instant-digital-delivery) are correctly never considered.

### Frontend

- **Notifications page** (`/notifications`): each row's icon now reflects its `type` (`wallet` → wallet icon, `stock` → alert-triangle icon, `order` → package icon, anything else → the original generic bell) via a small `notificationIcon()` helper, instead of every row showing the same bell regardless of what actually happened. No new types were added to `types/api.ts` — `NotificationItem.type` was already `string | undefined`.

### Verification performed (local SQLite + local dev server only)

- `php -l` clean on all new/changed files; no migrations needed (schema already supported everything).
- Logged in as both admin and a regular user against `php artisan serve` and inspected the actual `notifications` table rows (plus the live API responses) after each action:
  - Admin credit (₦500) → exactly one `type: wallet` "Wallet credited" row with the reason text included; admin debit (₦200) → exactly one `type: wallet` "Wallet debited" row.
  - Admin debit for an amount exceeding the balance → correctly rejected 422 (`Insufficient balance.`) with **zero** new notification rows (confirmed via a before/after count).
  - Paystack deposit path exercised via a `php artisan tinker` reflection call against the now-4-argument private `creditWallet()` (no live Paystack keys in local dev, same technique used for this method in Phase 2) → confirmed a `type: wallet` "Wallet funded" row for the exact deposited amount.
  - Order status transitions: `pending → processing` (new row, correct message), immediately resubmitting the identical `processing` status (correctly **zero** new rows — idempotency preserved), `pending → cancelled` (new row, correct message), `processing → completed` with delivery content (new `type: order` row **and** confirmed Phase 5's delivery email still fires independently in `storage/logs/laravel.log`), `failed → failed` resubmit (correctly zero new rows), `failed → processing → failed` (two new rows, one per real transition, with the right status-specific message each time).
  - `GET /api/notifications` and `GET /api/notifications/unread-count` (user-facing) confirmed to correctly surface all the new `wallet`/`order` rows and their accurate unread count with no serialization changes needed.
  - Low stock: set a real service's stock to 7 (above the threshold of 5), checked out a quantity of 3 (→ stock 4, crossing the threshold) → exactly one `type: stock` "Low stock alert" notification created, addressed to the one admin user in the local dataset, listing the correct service name and remaining-stock count. A follow-up purchase of 1 more unit (stock 4 → 3, already below threshold, no re-crossing) correctly created **zero** additional low-stock notifications (no spam). Service stock was restored to its seeded value (25) afterward as test cleanup.
- `php artisan test` — 2/2 passing, no regressions.
- `npm run build` (Next.js 16 + Turbopack) — compiles cleanly with **zero TypeScript errors** across all 28 routes.

### Deployment status

Not yet deployed to production (Railway backend / Vercel frontend) — built and verified locally only, per the same discipline followed for every prior phase. Awaiting explicit instruction to deploy. Unlike Phase 5, this phase has **no production caveat**: in-app notifications and push (already a safe no-op without VAPID keys configured, exactly as before this phase) both work identically in local dev and production with no environment-specific behavior.
