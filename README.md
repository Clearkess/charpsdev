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

## 15) Phase 7 — Provider API Sync (Skipped)

Seventh phase of the 10-phase roadmap ("provider API sync") was **skipped**, the same way Phase 3 (additional payment gateways) was skipped, and for the same reason: it requires real third-party credentials/API contracts that don't exist anywhere in this codebase.

Investigation (`grep` across the whole backend for `reloadly|vtpass|nellobytes|smepay|gladtidings`, case-insensitive) confirmed the `providers` table is seeded (`DemoDataSeeder::seedProviders()`) with two rows — VTpass (`base_url: https://sandbox.vtpass.com/api`, `api_key: demo-vtpass-api-key`) and Reloadly (`base_url: https://giftcards-sandbox.reloadly.com`, `api_key: demo-reloadly-api-key`) — both **fake placeholder values**, not real, working sandbox or production credentials. `ProviderController` already supports full CRUD on providers (with `maskKey()` hiding all but the last 4 characters of `api_key` in every response) and has a comment foreshadowing a future stock/delivery sync, but no actual HTTP integration against any real provider API exists anywhere in the app.

Three options were presented: (1) build a real integration against a specific provider if real credentials are supplied, (2) build a generic sync architecture wired against a clearly-labeled mock/fake adapter, or (3) skip the phase and move on, exactly as Phase 3 was skipped. Option 3 was chosen — proceed straight to Phase 8 (analytics). This phase can be revisited at any time once real provider credentials are available.

**Revisited in §20** once real credentials for 5SIM and OnlineSIM were supplied — see below.

## 16) Phase 8 — Analytics

Eighth phase of the 10-phase roadmap. Built additively on top of Phases 1–6 (checkout, wallet, coupons, settings, delivery emails, notifications all untouched), tested locally against SQLite first, and **not yet deployed to production** as of this writing. No new migrations were needed — every field surfaced is derived from existing `orders`, `order_items`, `services`, `users`, and `coupons` data.

### What was built

The existing `/admin/dashboard` page (`AdminController::dashboard()` / `chartData()`) predates this 10-phase roadmap, is already live in production, and was **deliberately left unmodified** so it can never regress. Instead, a brand new, separate deep-dive page was added:

- `App\Http\Controllers\Api\Admin\AdminAnalyticsController::overview()` — a new `GET /api/admin/analytics/overview` endpoint (inside the existing `admin` middleware group, so it's admin-only exactly like every other admin route) accepting an optional `days` query param restricted to `7 | 30 | 90 | 365` (`Rule::in()`, invalid values → 422; defaults to 30). Returns:
  - **Summary**: orders in range, completed orders in range, revenue in range (post-discount, same definition as the existing dashboard's `revenue`), average order value, new users in range.
  - **Status breakdown**: count of orders in range for every one of the 5 possible statuses (`pending`/`processing`/`completed`/`failed`/`cancelled`), including statuses with a zero count.
  - **Top services**: the 10 highest-revenue services in range, by order count and revenue.
  - **Revenue by category**: total revenue in range grouped by service category, sorted descending.
  - **Signups series**: one entry per day in the selected range (zero-filled, so the frontend never has to handle gaps — the same pattern already used by the existing `chartData()` endpoint), with the count of new users that day.
  - **Coupon usage**: count of completed orders in range that used a coupon, and the total discount given.
  - Both "top services" and "revenue by category" correctly handle the two order shapes in this codebase: cart-checkout orders (which have `order_items` rows via the `items` relation) are summed at the line-item level (`price × quantity`); a true legacy single-service order (created via `POST /api/orders`, which never creates `order_items` rows) falls back to `order.service_id`/`order.amount`. Checking `items` first and only falling back when it's empty avoids double-counting, since cart-checkout orders also set `service_id` to their first item for backward compatibility.
  - **Revenue methodology note**: "top services"/"revenue by category" use pre-discount, item-level `price × quantity`, not proportionally reduced by any coupon discount. This is intentional — the gap between the sum of these figures and the post-discount `revenue_in_range` always exactly equals `coupon_usage.total_discount` (verified numerically against local test data: item-level sums of ₦56,500 minus post-discount `revenue_in_range` of ₦56,000 equalled the ₦500 discount given in that period). These breakdowns are for relative ranking only, not financial reconciliation.

### Frontend

- New types added to `types/api.ts`: `SignupDataPoint`, `OrderStatusCount`, `TopServiceStat`, `CategoryRevenueStat`, `AnalyticsOverview`.
- `useAdminAnalyticsQuery(days)` hook (`hooks/queries/useAdminQueries.ts`), using `keepPreviousData` so switching the date-range selector never shows a loading flash.
- Two new chart components matching the existing dashboard's visual style (same CSS-variable-driven colors as `OrdersOverTimeChart`/`RevenueChart`): `SignupsChart` (area chart, day-bucketed signups) and `CategoryRevenueChart` (horizontal bar chart, revenue by category).
- New page `/admin/analytics`: a 7/30/90/365-day range selector, 5 summary stat cards, an order status breakdown row, the two new charts side by side, and a top-services table — following the same `Card`/`StateBlock` patterns as every other admin page.
- Added an "Analytics" entry to `AdminNav.tsx` (right after "Dashboard"), so the new page is actually reachable from the admin UI instead of only by typing the URL directly — the same nav-gap fix applied for Providers/Coupons/Settings in Phase 4.

### Verification performed (local SQLite + local dev server only)

- `php -l` clean on all new/changed backend files.
- Manual curl testing against `php artisan serve` (admin token): default (30-day) overview, `days=7` (7-entry signups series), `days=365` (365-entry series), `days=15` (invalid — correctly 422), and a non-admin token (correctly 403, unchanged existing `admin` middleware).
- Numerically verified the revenue methodology note above using real seeded/mutated local data.
- `php artisan test` — 2/2 passing, no regressions.
- `npm run build` (Next.js 16 + Turbopack) — compiles cleanly with **zero TypeScript errors**, 29 routes (up from 28 — `/admin/analytics` is the new route).

### Deployment status

Not yet deployed to production (Railway backend / Vercel frontend) — built and verified locally only, per the same discipline followed for every prior phase. Awaiting explicit instruction to deploy.

## 17) Phase 9 — User-Facing Features

Ninth phase of the 10-phase roadmap. Built additively on top of Phases 1–8 (checkout, wallet, coupons, settings, delivery emails, notifications, analytics all untouched), tested locally against SQLite first, and **not yet deployed to production** as of this writing. Unlike prior phases, "user-facing features" didn't name specific functionality up front, so the scope was determined by investigating the existing user-facing app for concrete, unambiguous gaps (the same way the Phase 6 gap-finding was done) rather than guessing broadly. Three gaps were found and built:

### 1. Change password

Before this, the **only** way to change a password was the forgot/reset-password email flow — there was no way to change it while logged in. `ProfileController::updatePassword()` (`PUT /api/profile/password`) requires `current_password` (validated with Laravel's built-in `current_password` rule, which re-checks the hash against the authenticated user's own password) plus a `confirmed`, `min:8` new password — the same `min:8` rule `RegisterRequest` already uses, for consistency. A new "Change password" card was added to the Profile page, self-contained from the existing name/email edit form.

### 2. Service reviews & ratings

The biggest addition — a natural marketplace feature that didn't exist in any form (no `reviews`/`ratings` table, column, or UI anywhere).

- New `reviews` table: `user_id`, `service_id`, `order_id` (nullable — survives if that order is later deleted), `rating` (1-5), `comment` (nullable). A **unique index on `(user_id, service_id)`** means a user can only ever have one review per service — resubmitting updates the existing row (`updateOrCreate`) rather than creating a second one, so the average can't be inflated by the same buyer rating a service repeatedly.
- `ReviewController::store()` (`POST /api/services/{service}/reviews`) enforces the purchase-eligibility rule: the user must have an order with `status: completed` containing that service, checked across **both** order shapes (cart-checkout `order_items` rows and the legacy single-service `orders.service_id` column) via a single `orWhereHas` query — the same dual-shape pattern established in Phase 5/8. No completed order for that service → 403, not a validation error.
- `ReviewController::index()` (`GET /api/services/{service}/reviews`) returns every review (with reviewer name), the average rating, count, and the requesting user's own review (`my_review`) so the frontend can label the form "Update review" vs "Submit review" without a second lookup.
- `ServiceController::index()` now eager-loads `withAvg('reviews', 'rating')` / `withCount('reviews')`, so every service in the catalog listing already carries `reviews_avg_rating`/`reviews_count` with no extra round trip.

### 3. Reorder ("Buy again")

Before this, re-purchasing something you'd bought before meant manually finding it again in the catalog. A "Buy again" button on each Orders row re-adds every line from that order (handling both order shapes the same way reviews do) to the cart via the **existing** `POST /api/cart` endpoint — no new backend endpoint needed, it just replays the same calls manually adding each item would make — then redirects to the Cart page. Lines are added sequentially so a mid-loop stock failure on one line still leaves the earlier lines added rather than losing them silently; any failure is surfaced under the row.

### Frontend

- New types: `Review`, `ReviewsResponse`; `Service` gained `reviews_avg_rating`/`reviews_count`.
- New hooks: `useServiceReviewsQuery(serviceId)`, `useSubmitReviewMutation(serviceId)` (`hooks/queries/useReviewsQueries.ts`); `useUpdatePasswordMutation()` added to `useProfileQuery.ts`.
- New shared `StarRating` component (`components/common/StarRating.tsx`) — read-only mode (supports fractional ratings, e.g. an average of 4.33, via a proportional clip overlay) used on Service cards; interactive/clickable mode used by the review form.
- New `ReviewFormRow` component (`components/common/ReviewFormRow.tsx`) — one "rate this purchase" row per service, pre-filled if the user already reviewed it.
- **Services page**: each card shows a star rating + review count under the category label, whenever `reviews_count > 0`.
- **Orders page**: new "Actions" column per row — "Buy again" (all orders with at least one resolvable line) and "Rate & review" (completed orders only), the latter expanding an inline panel with one `ReviewFormRow` per line item, following the same expand/collapse pattern already used for the Phase 5 delivery-details toggle.
- **Profile page**: new "Change password" card between the existing profile-details card and the push-notifications card.

### Verification performed (local SQLite + local dev server only)

- `php -l` clean on all new/changed backend files; migration applied cleanly (`php artisan migrate --force`); all new routes confirmed via `php artisan route:list`.
- Reviews: submitted a review for a service the test user had a completed order for (201, correct data) → resubmitted with a different rating/comment (200 "updated", confirmed still exactly 1 row in the table — no duplicate) → attempted a review for a service the same user had **never** completed an order for (correctly 403, not a validation error) → attempted `rating: 6` (correctly 422).
- Change password: wrong `current_password` (422, field-specific message) → new password under 8 chars (422) → correct current password + valid new password (200) → confirmed via `/api/login` that the **old** password is now rejected (401) and reset it back for test cleanliness.
- Reorder: verified the exact `POST /api/cart` calls the "Buy again" button makes (for both a legacy single-service order and an `order_items`-based order) against the real endpoint — both lines land correctly in the cart with the right quantities and a correct running total.
- `php artisan test` — 2/2 passing, no regressions.
- `npm run build` (Next.js 16 + Turbopack) — compiles cleanly with **zero TypeScript errors**, 29 routes (no new top-level route — reviews/password live inside the existing Services/Orders/Profile pages).

### Deployment status

Not yet deployed to production (Railway backend / Vercel frontend) — built and verified locally only, per the same discipline followed for every prior phase. Awaiting explicit instruction to deploy.

## 18) Phase 10 — Additional Security Hardening

Tenth and final phase of the 10-phase roadmap. Built additively on top of Phases 1–9 (nothing in checkout, wallet, coupons, settings, delivery emails, notifications, analytics, or the Phase 9 user-facing features was touched), verified locally against SQLite + `php artisan serve` first, and **not yet deployed to production** as of this writing. Like Phases 6 and 9, "additional security hardening" didn't name specific functionality up front, so the scope was determined by auditing the real codebase for concrete, unambiguous gaps rather than guessing broadly. The audit covered: route-level throttling, CORS configuration, response headers, Sanctum token lifetime, Paystack webhook signature verification, payment idempotency, admin-role enforcement, mass-assignment safety on `is_admin`, and the unused `ApiKey` model. Three real gaps were found and fixed; several other areas were checked and confirmed already secure (documented below rather than silently ignored).

### 1. Rate limiting on `/login` and `/register`

Before this, `/login` and `/register` had **zero** brute-force protection — only `/email/verification-notification` had a `throttle:6,1` middleware. Two named rate limiters were registered in `AppServiceProvider::boot()`:

- `login` — keyed by **`email + IP`** (`Limit::perMinute(5)->by($email.'|'.$request->ip())`), not IP alone. This means a distributed brute-force attempt against one account is still throttled even when spread across many source IPs, while unrelated users sharing an IP (NAT, mobile carrier, office network) are never affected by someone else's failed attempts against a different account.
- `register` — keyed by IP alone (`Limit::perMinute(5)`), since there's no target-account identity to key on for signup abuse.

Applied via `->middleware('throttle:login')` / `->middleware('throttle:register')` directly on the two routes in `routes/api.php`, the same pattern the existing `throttle:6,1` on verification-notification already used.

### 2. Restrictive CORS (`config/cors.php`)

The app had **no** app-level `config/cors.php` override, so Laravel 13 was silently falling back to the framework's shipped default (`vendor/laravel/framework/config/cors.php`), which sets `'allowed_origins' => ['*']` — any origin on the internet could call `/api/*`. A new app-level `config/cors.php` was added that reads a comma-separated `FRONTEND_URL` env var (defaulting to `http://localhost:3000` for local dev) into `allowed_origins`, restricting cross-origin API access to only the known frontend origin(s). `supports_credentials` stays `false` since auth is Sanctum Bearer tokens, not cookies, across origins — no behavior change needed there. Added `FRONTEND_URL=https://YOUR-VERCEL-FRONTEND-DOMAIN` to both `.env.example` and `.env.railway.example` so the production Railway deployment isn't silently left on the wide-open default once this ships — it must be set to the real Vercel domain(s) before/at deploy time.

### 3. Security response headers (global middleware)

No middleware anywhere set any hardening response headers. Added `app/Http/Middleware/SecurityHeaders.php`, registered globally via `$middleware->append(...)` in `bootstrap/app.php`, setting on every response:

- `X-Content-Type-Options: nosniff` — stops browsers from MIME-sniffing JSON responses as something else.
- `X-Frame-Options: DENY` — stops any accidental HTML error page from being framed (clickjacking defense-in-depth).
- `Referrer-Policy: strict-origin-when-cross-origin` — stops full URLs (which can contain tokens in query strings) from leaking to third-party `Referer` headers.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — only set when `$request->isSecure()`, so it never fires on plain-HTTP local dev.

A full CSP was deliberately not added — this is a JSON API with no server-rendered HTML views to constrain, and a hand-tuned CSP for an API-only backend has a poor risk/value ratio (easy to misconfigure, breaks nothing existing if omitted).

### 4. Trust Railway's edge proxy (`bootstrap/app.php`) — found during production verification, not local testing

This one wasn't caught by local `php artisan serve` testing — it only surfaced once the login rate limiter was verified **against the real Railway deployment**. Symptom: hammering `/api/login` with the same wrong-password email against production never returned `429`, and `X-RateLimit-Remaining` bounced non-monotonically between requests instead of counting down — both signs the `email+IP` limiter key was resolving to a *different* IP on different requests for the same real client.

Root cause: Railway terminates TLS and proxies every request through its own edge, so `$request->ip()` was returning the internal proxy hop's address, not the real client IP — and apparently an unstable one across requests. The app had no `trustProxies()` configuration at all, so Laravel never looked at the `X-Forwarded-For`/`X-Forwarded-Proto` headers Railway sets. This silently broke two things at once:

- The Phase 10 rate limiters (this section) — an attacker's requests could be spread across whatever the internal proxy-hop IP resolves to, defeating the per-IP bucket; worse, if that hop IP is *shared* by all traffic, it would incorrectly merge every real visitor into one bucket.
- The `Strict-Transport-Security` header from section 3 — `$request->isSecure()` also depends on the trusted-proxy chain to read `X-Forwarded-Proto`; without it, Laravel only sees the plain-HTTP hop between Railway's edge and the app container, so the header was **silently never being sent** on production HTTPS traffic even though the condition looked correct locally.

Fixed with `$middleware->trustProxies(at: '*')` in `bootstrap/app.php` — trusting all proxies is the right posture here since Railway's edge *is* the trust boundary (nothing else sits between it and the internet, unlike a self-hosted stack behind an unknown number of untrusted hops).

### Considered, not changed

- **Sanctum token expiration** — `config/sanctum.php` has `'expiration' => null`, so issued tokens never expire except via explicit logout (`currentAccessToken()->delete()`). Evaluated and **left as-is**: adding an expiration is a genuine behavior change (users would get silently logged out) that wasn't requested and would need product-level UX (refresh flow, "session expired" messaging) to not regress the existing experience. Flagged here rather than silently implemented or silently dropped.
- **Email-verification enforcement** — the app currently does not gate any endpoint behind `verified` middleware. Evaluated and **left as-is** for the same reason: enforcing it now would break any already-registered unverified user's existing access, which wasn't requested.
- **`ApiKey` model** — `app/Models/ApiKey.php` (fillable: `name, key, provider, active`) has **zero references** in any controller — confirmed dead/unused code, not wired into any live endpoint. No security exposure since nothing reads or writes it; left untouched rather than deleting code outside the requested scope.

### Confirmed already secure (no changes needed)

- **Paystack webhook signature verification** — `PaymentController::webhook()` computes `hash_hmac('sha512', $request->getContent(), config('paystack.secret_key'))` and compares against the `x-paystack-signature` header using the timing-safe `hash_equals()`. No forgery risk.
- **Payment idempotency & ownership** — both `PaymentController::verify()` and `::webhook()` check `Transaction::where('reference', $reference)->exists()` before crediting a wallet, preventing double-crediting from replayed webhooks/verify calls; `verify()` additionally checks `metadata.user_id` matches the authenticated user before crediting.
- **Admin-role enforcement** — `AdminMiddleware` correctly checks `$request->user()->is_admin` and returns 403 otherwise; applied consistently across all `/api/admin/*` routes.
- **Mass-assignment safety on `is_admin`** — `User::$fillable` includes `is_admin`, but `RegisterRequest`/`UpdateProfileRequest` validation rules never expose it as an accepted field, so a user cannot self-promote via mass assignment. The only other `is_admin` reference in the codebase is a *query* (`CheckoutController.php`, finding admins to notify on low stock — a Phase 6 feature), not user input.

### Verification performed

**Local (SQLite + `php artisan serve`):**

- `php -l` clean on all new/changed backend files (`AppServiceProvider.php`, `routes/api.php`, `config/cors.php`, `app/Http/Middleware/SecurityHeaders.php`, `bootstrap/app.php`).
- `php artisan test` — 2/2 passing, no regressions (run before and after every change in this phase, including the trust-proxies fix).
- Manual curl testing against `php artisan serve`:
  - Rate limiting: 7 rapid `POST /api/login` attempts with the same wrong-password email → attempts 1–5 return `401`, attempts 6–7 return `429` with `X-RateLimit-Limit: 5`, `X-RateLimit-Remaining: 0`, and a `Retry-After` header. Confirmed a **different** email from the same IP (a real seeded user, correct password) is unaffected — still `200` — proving the limiter is keyed by `email+IP`, not IP alone. Same 5-per-minute → `429` pattern confirmed for `POST /api/register` (IP-keyed), with the 5 test accounts it created cleaned up afterward.
  - CORS: `OPTIONS /api/login` preflight with `Origin: http://localhost:3000` (the configured default) returns a matching `Access-Control-Allow-Origin`; the same preflight with `Origin: https://evil.com` returns an `Access-Control-Allow-Origin` that does **not** match the requesting origin — real browsers block the follow-up request in this case (CORS is a browser-enforced boundary; curl itself doesn't enforce it, which is why the mismatch, not an outright missing header, is the correct signal to check for).
  - Security headers: confirmed `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` present on both a plain `GET /up` and a real `POST /api/login` response.
  - After adding the trust-proxies fix (§4 above): re-sent the same 6-attempt burst with a spoofed `X-Forwarded-For: 203.0.113.5` header on every request — attempt 6 correctly returned `429`; a follow-up request with a *different* `X-Forwarded-For` value returned `401` (its own bucket), confirming the limiter now keys off the forwarded client IP rather than the raw socket peer.
- No frontend changes in this phase — `npm run build` not re-run (nothing in `frontend/` was touched).

**Production (`https://charpsdev-production.up.railway.app`, after deploying):**

- `/up` → `200`; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` all present on real responses.
- Initial post-deploy rate-limit check *failed* to trigger `429` after 6 attempts and showed a non-monotonic `X-RateLimit-Remaining` — this is exactly what led to discovering and fixing §4 above. After redeploying with the fix, `Strict-Transport-Security` also began appearing on responses (previously silently absent in production despite the code looking correct — same root cause, see §4).
- A legitimate login (`test@example.com` / `password`) continued to return `200` throughout all rate-limit testing on a different account, confirming the limiter never affects unrelated users.

### Deployment status

**Backend — ✅ deployed and verified live in production.** Pushed `main` (commits through `64e855e`, which includes the trust-proxies fix from §4) to GitHub, then redeployed via the same Railway GraphQL `serviceConnect` + `serviceInstanceDeploy(latestCommit: true)` pattern documented in §7/§11 (source link had gone stale again, as expected). Also set `FRONTEND_URL=https://charpsdev.vercel.app` on Railway production via `variableCollectionUpsert` — without this, CORS would have fallen back to the `http://localhost:3000` default and blocked the real frontend, since it had never been set before this phase. Verified live at `https://charpsdev-production.up.railway.app`:

- `/up` → `200`; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and (now, after the §4 fix) `Strict-Transport-Security` all present.
- Rate limiting: 6 rapid wrong-password `POST /api/login` attempts for the same email correctly return `401×5` then `429`, with `X-RateLimit-Remaining` counting down monotonically (`4,3,2,1,0`) — confirming the §4 trust-proxies fix resolved the real-IP resolution issue. A different, correct-password login succeeded (`200`) throughout, unaffected.
- CORS: preflight from `https://charpsdev.vercel.app` (the real frontend) now correctly returns a matching `Access-Control-Allow-Origin`; preflight from `https://evil.com` returns a **mismatched** `Access-Control-Allow-Origin` (browsers block it).
- Functional smoke test: logged in as `test@example.com`, confirmed `/api/me` (200, real user data), `/api/services` (200, real catalog data including the Phase 9 `reviews_avg_rating`/`reviews_count` fields), and `/api/wallet` (200) all work correctly against the live database.

**Frontend — ✅ resolved, deployed and verified live.** Initially blocked by the same recurring issue as Phase 2 (§11): the sandbox's preconfigured `VERCEL_TOKEN` is a personal-account token, and the `charps-dev` Vercel team enforces SSO that this token type cannot satisfy for any team-scoped call (`vercel deploy`, `GET /v9/projects/...` all rejected with `403 forbidden`, `"saml": true`, `"scope": "charps-dev"`) — confirmed the live site was still serving a build from ~8.4 hours earlier (`age: 30412` on `/login`), unaffected by this phase's `git push`, so GitHub auto-deploy isn't wired up either.

**Unblocked with a new team/project-scoped token supplied by the user.** This token type behaves the opposite of the personal one: `GET /v2/user` returns the same account, but critically `GET /v9/projects/{id}` (team-scoped) now succeeds where it failed before, confirming real team access. Deployed with `vercel deploy --prod --token ... --yes` from the **monorepo root** (not `frontend/`, per the path-doubling gotcha documented in Phase 2's §11):

- Cloud build completed in 30s: all 26 routes compiled, zero TypeScript errors, aliased to `https://charpsdev.vercel.app` ("✓ Ready in 1m").
- Freshness confirmed: `age: 0` on `/login` immediately after deploy (vs. `age: 30412` before).
- `NEXT_PUBLIC_API_URL` confirmed already correctly set to `https://charpsdev-production.up.railway.app/api` for production/preview/development.
- `/login` → `200`; `/`, `/dashboard`, `/services` → `307` (correct unauthenticated redirect to `/login`, matching the existing route-guard behavior).
- Playwright console capture on `/login` — zero console messages, no client-side errors.

Both backend and frontend are now live and serving Phases 4–10 in production.

## 19) Public Landing Page Redesign (`/`)

Outside the 10-phase roadmap (roadmap is fully complete as of §18). The user supplied `charpsdev-landing-page-redesign.zip` — a full snapshot of an earlier point in this repo (missing all Phase 4–9 admin pages/components, confirmed by diffing file lists) in which exactly two files had a newer timestamp than everything else: `frontend/app/page.tsx` and `frontend/app/globals.css`. This made the actual deliverable unambiguous without needing to ask: a hand-built public marketing landing page for `/`, meant to be lifted out of that stale snapshot and integrated into the current (Phase 1–10) codebase, not a full repo replacement.

**What changed:**

- `frontend/app/page.tsx` — replaced. Previously just `redirect("/dashboard")` (so every visitor to `/`, logged in or not, ended up at `/login` via the dashboard's route guard — there was no actual public marketing page). Now a full static landing page: nav with anchor links (`#services`, `#how-it-works`, `#why-us`), hero section, stats strip, a 4-item services grid, a "how it works" steps section, a security/trust section, a final CTA, and a footer. Uses `lucide-react` icons (`ArrowRight`, `BadgeCheck`, `Bolt`, `CreditCard`, `Globe2`, `Menu`, `ShieldCheck`, `Sparkles`, `WalletCards`) — confirmed all exist in the already-installed `lucide-react@^1.27.0` (no dependency bump needed) before wiring it in.
- `frontend/app/globals.css` — **merged, not overwritten.** The zip's version of this file deleted the entire `@theme`/`.dark` CSS-variable system (`--color-background`, `--color-primary`, `--color-foreground`, etc.) that every other page and UI primitive in the app depends on via Tailwind classes like `bg-background`/`text-foreground`/`bg-primary` — confirmed via `grep -rl` that 40+ files (all dashboard/admin pages, every `components/ui/*` primitive, every auth form) reference these classes. Blindly copying the zip's file would have silently broken theming/dark-mode across the entire authenticated app to redesign one public page. Instead, only the new, self-contained `.landing`-scoped CSS block (its own local vars — `--gold`, `--ink`, `--panel`, etc. — no dependency on the `--color-*` system) was appended to the existing `globals.css`, leaving the original theme/dark-mode system fully intact.

**Mobile menu — wired up (follow-up, same session).** The hamburger from the supplied design rendered but had no `onClick`/state. Extracted the nav into a new client component, `frontend/components/layout/LandingNav.tsx` (`"use client"`, `useState` for open/closed), so the rest of `page.tsx` stays a plain server component — only the interactive nav needed to opt into client rendering. Clicking the toggle now swaps the icon (`Menu` ↔ `X`, both from the already-installed `lucide-react`) and reveals a `.mobile-menu-panel` dropdown (anchored via the nav's existing `position:relative`) containing the three anchor links plus `Log in` / `Get Started`; any link click also closes the panel via the same `close()` handler, so navigating away or jumping to an in-page anchor doesn't leave it stuck open. New CSS added to the same `.landing`-scoped block in `globals.css` (`.mobile-menu-toggle`, `.mobile-menu-panel`, `.mobile-menu-actions`) — reused the existing `--gold`/dark palette, no new variables introduced.

**Verification performed:**

- `npm run build` (Next.js/Turbopack) — compiled successfully, TypeScript clean, all 26 routes generated, `/` now prerendered as static content (previously it was a redirect-only route).
- Confirmed in the compiled CSS output that both the original `--color-primary`/`--color-background`/etc. variable declarations **and** the new `.landing`/`.hero`/`.service-card` rules are present (`grep -c` on the built CSS chunk) — the merge didn't drop either side.
- Started the built app locally (`pm2` + `next start`), curled `/` (200, contains `landing-nav`/`hero`/`service-card` markup) and `/login` (200, unaffected) and `/dashboard` (200, still redirects unauthenticated visitors via the existing `proxy.ts` middleware — its matcher list never included `/`, so this change doesn't touch route-guard behavior at all).
- Playwright console capture on both `/` and `/login`: the only console messages on either page are the pre-existing, unrelated `Vercel Web Analytics`/`Speed Insights` 404s (expected in the sandbox, which isn't a real Vercel deployment) — zero errors attributable to this change, and identical between the two pages, confirming the redesign didn't introduce anything new.
- Re-verified after wiring up the mobile menu: `npm run build` clean again (TypeScript clean, `/` still statically prerendered — the new `LandingNav` client component doesn't force the page itself into dynamic rendering), and a fresh Playwright console capture on `/` shows the exact same (unrelated, pre-existing) console output as before — no hydration errors or new warnings from introducing the client component.

**Real logo wired in (follow-up, same session).** The user supplied `charpsdev_logo_horizontal.png` (1600×500, solid `#0a0a0a` background, no alpha) — a full lockup with icon + "CharpsDev" wordmark + a tagline line ("Trusted Digital Services, All in One Place") underneath, with a lot of blank canvas padding. Used it to replace the plain-text `<span>Charps</span>Dev` brand mark that previously appeared in both `LandingNav.tsx` and the footer (`page.tsx`). Processing done with Pillow rather than shipping the raw upload as-is:

- Isolated the icon+wordmark region only (excluded the tagline line and the excess canvas padding) via pixel-difference analysis against the background color, then cropped with a small uniform margin — `frontend/public/logo.png`, 1003×209.
- Converted the solid background to a real alpha channel using a soft difference matte (a low/high distance threshold with a linear ramp, not a hard cutoff) plus background-color decontamination on partially-transparent edge pixels — avoids a jagged/haloed edge or a visible "box" around the logo when composited on the site's actual `#060708` background (which is close to, but not identical to, the original PNG's `#0a0a0a` fill).
- Added `.brand-logo` (fixed `height`, `width:auto`) and made `.brand` a flex container in the same `.landing`-scoped CSS block; kept `.brand span{color:var(--gold)}` in place since it's harmless now-unused CSS, not touching anything else.

**Verification performed:** composited the processed `logo.png` onto a solid `#060708` swatch (the real site background) and confirmed no visible edge artifacts/halo; `npm run build` clean (TypeScript clean, `/` still static); confirmed `GET /logo.png` returns `200` from the built app; Playwright console capture on `/` shows the same pre-existing (unrelated) console output as every prior check in this section — no errors from the new asset or the markup change.

**App-wide branding extension (follow-up, same session).** The landing page redesign introduced a new gold-on-dark visual identity (logo, `--gold` accent) that only existed on `/`. Extended it across the authenticated dashboard, admin panel, and all auth pages so the whole app matches:

- **Light-mode logo variant** — `frontend/public/logo-light.png`. The landing page's `logo.png` has a white "Dev" wordmark, designed for the landing page's permanently-dark background; it's invisible on the rest of the app's default light background (`--color-background:#f8fafc`). Generated by detecting near-white pixels in `logo.png` (`min(R,G,B) > 150` and `max−min < 40`, to avoid recoloring the gold parts of the mark) and recoloring them to navy `#0f172a` (matches `--color-foreground` in light mode).
- **`frontend/components/common/BrandMark.tsx`** — new shared component that swaps between `logo-light.png` and `logo.png` using Tailwind's `dark:` variant (`dark:hidden` / `hidden dark:block`), the same pattern the codebase already uses elsewhere (e.g. `dark:bg-input/30` on form inputs) — no new theming mechanism introduced. Both images are always fetched (one is just hidden via CSS); accepted as a minor, inconsequential inefficiency for a simple two-variant swap.
- **Wired into:** `AppLayout.tsx` (desktop sidebar brand block and mobile topbar — this single file covers both the authenticated dashboard and the admin panel, since `app/admin/layout.tsx` wraps `AppLayout`) and all four auth pages (`login`, `register`, `forgot-password`, `reset-password`), replacing the old "two-letter initials in a colored square + app name" placeholder mark everywhere it appeared.
- **Favicons / PWA icons regenerated** — `app/icon.png`, `app/apple-icon.png`, `public/icon-192.png`, `public/icon-512.png`, from an icon-only crop (no wordmark) of the same logo asset, composited onto a solid `#060708` square at 62% scale, centered (keeps content inside the safe zone required for `purpose:"maskable"` icons, which the OS may crop to arbitrary shapes — those four are saved fully opaque, no transparency).
- **Color theme updated to match the landing page's gold brand** — `frontend/app/globals.css`: `--color-primary`, `--color-primary-foreground`, and `--color-ring` changed from indigo (`#4f46e5`/`#ffffff` light, `#6366f1`/`#ffffff` dark) to gold (`--color-primary:#f6b91f`, `--color-primary-foreground:#17120a` — dark text on gold, same choice the landing page's own `.primary-btn` already makes — `--color-ring:#f6b91f`) in **both** the `@theme` (light) block and the `.dark` block, so every `bg-primary`/`text-primary-foreground`/`ring` usage across the app (buttons, active nav states, admin nav pills, badges, focus rings) now renders gold instead of indigo automatically — no per-component edits needed. Checked beforehand that no component pairs `bg-primary` with a hardcoded `text-white` instead of `text-primary-foreground` (would've produced unreadable white-on-gold text) — none found. `frontend/app/manifest.ts`'s `theme_color` also updated from `#4f46e5` to `#f6b91f` (the PWA install/task-switcher tint). Left `app/layout.tsx`'s `viewport.themeColor` (mobile browser chrome/address-bar tint) unchanged — it already tracks the page background color (`#f8fafc`/`#0b1120`), not the old indigo accent, so it was never coupled to the color being replaced.

**Verification performed:** `npm run build` clean (TypeScript clean, all 26 routes generated, `/` still statically prerendered); confirmed via the built RSC payload that `login` (and by the same code path, the other three auth pages) renders both `BrandMark` `<img>` tags with the correct `dark:hidden`/`hidden dark:block` classes and correct `src` (`/logo-light.png`, `/logo.png`); confirmed the compiled CSS chunk resolves `--color-primary`/`--color-ring` to `#f6b91f` and `--color-primary-foreground` to `#17120a`; confirmed `/manifest.webmanifest` serves `"theme_color":"#f6b91f"`; `grep`'d for orphaned `bg-primary` usages without a matching foreground class — none found; Playwright console capture on `/` and `/login` shows the same pre-existing, unrelated `Vercel Web Analytics`/`Speed Insights` 404s as every prior check in this section — no new errors.

**Deployment status:** Implemented, built, and verified locally. Deployed to GitHub + Vercel production together with the rest of this section's work — see the entry immediately below for the actual deploy record.

## 20) Virtual Number Rental (5SIM / OnlineSIM / SMS-Man) — Provider API Sync Revisited

Real API credentials were supplied for two of the three candidate providers (5SIM JWT, OnlineSIM key; SMS-Man token still not provided), unblocking §15. Built a full end-to-end virtual-number rental feature: users pick a provider, browse that provider's own country/service catalog, rent a number (wallet debit in NGN at a markup over the provider's USD cost), and poll for the incoming SMS code, with automatic wallet refund on any non-success outcome.

**Design decisions:**
- **Provider-scoped browsing** — the UI picks a provider tab first, then browses that provider's *native* country/service catalog. No cross-provider taxonomy mapping was attempted (each provider names/codes countries and services differently); this keeps every adapter simple and avoids a fragile normalization layer.
- **Reserve-then-confirm wallet pattern** — the wallet debit and a `pending` order row are created inside a short `DB::transaction()` with `lockForUpdate()` on the wallet; the slow third-party HTTP call happens *outside* that transaction (never hold a row lock across a network call to an external API). On provider failure, the reservation is refunded; on success the order is finalized to `waiting_code` with the real phone number/external ID.
- **Auto-refund policy** — any terminal non-`received` status (provider-side cancelled/expired/failed, or user-initiated cancel, or a purchase-call exception) always credits the wallet back in full and sets the order to `refunded`, recording the specific reason in `meta.refund_reason`. No value delivered, no charge, by design.
- **Price computed server-side, always** — the price shown to the buyer is recomputed from a live provider-catalog lookup at purchase time (never trusted from the client), as `cost_usd × (1 + markup_percent/100) × usd_to_ngn_rate`, rounded to 2dp. Both `virtual_number_markup_percent` (default `20`) and `usd_to_ngn_rate` (default `1600`, a placeholder pending a real FX feed) are stored in the existing generic `Setting` model/admin UI — editable post-deploy without a code change.

**Backend:**
- New `virtual_number_orders` table (migration `2026_08_01_010000_create_virtual_number_orders_table.php`) + `VirtualNumberOrder` model — tracks `provider_slug`, `external_id`, `phone_number`, `country`, `service_code`/`service_name`, `operator`, `cost_usd`, `exchange_rate`, `markup_percent`, `price_ngn`, `status` (`pending`/`waiting_code`/`received`/`cancelled`/`expired`/`refunded`/`failed`), `sms_code`/`sms_text`, `reference`, `expires_at`/`completed_at`/`cancelled_at`, and a `meta` JSON column (used for `refund_reason`). Indexed on `[user_id, status]` and `[provider_slug, external_id]`.
- `Provider` model got one addition: a `virtualNumberOrders(): HasMany` relation — no other change to the existing admin Provider CRUD/masking machinery was needed.
- `SettingsSeeder` gained `virtual_number_markup_percent` and `usd_to_ngn_rate` under a new `virtual_numbers` settings group.
- `app/Services/SmsProviders/` — a unified `SmsProviderInterface` (`getBalance`, `listCountries`, `listServices`, `buyNumber`, `checkStatus`, `finish`, `cancel`) implemented by three adapters, each talking to its provider's native REST API via Laravel's `Http` facade:
  - **`FiveSimProvider`** (5SIM v1, Bearer JWT) — **fully live-verified** against the real account: countries, activation-only services, buy, check, finish, cancel all round-tripped correctly, including sniffing 5SIM's plain-text (non-JSON) error bodies (`"not enough user balance"`, `"order not found"`, etc.).
  - **`OnlineSimProvider`** (OnlineSIM, `apikey` query param) — **mostly live-verified**: countries (dedicated endpoint, E.164 dial-code keyed — confirmed `"1"` = USA, not a numeric country ID as first guessed), tariffs/services, and the buy-call's *rejection* path (`WARNING_LOW_BALANCE` on a real $0-balance attempt, which is the correct response shape) all confirmed live. The buy/status **happy path** (a real successful rental) was never observed, since the account carries a $0.000 balance — the parsing in `buyNumber()`/`checkStatus()` is written defensively from documented field names only and is flagged in the class docblock as needing a live spot-check once the account is funded.
  - **`SmsManProvider`** (SMS-Man, `token` query param) — **entirely unverified**, no token was ever supplied. Built strictly to the documented API spec (`get-balance`, `countries`, `applications`, `get-prices`, `get-number`, `get-sms`, `set-status`). The class docblock recommends leaving its `providers` row `active = false` in production until a real token is supplied and the adapter is smoke-tested.
- `VirtualNumberService` — the orchestrator. Resolves the right adapter from the DB `Provider` row (throws if not configured/active), exposes `listCountries`/`listServices`/`priceNgn`, and implements `buyNumber()` (reserve → call provider → finalize-or-refund), `refund()`, `pollStatus()` (maps a `received` status to storing the code and best-effort `finish()`-ing the order; any other terminal status triggers `refund()`), and `cancelOrder()` (best-effort provider cancel, then always refund).
- `VirtualNumberController` + 8 new routes under the existing `auth:sanctum` group: `GET /api/virtual-numbers/providers`, `GET /api/virtual-numbers/{provider}/countries`, `GET /api/virtual-numbers/{provider}/services`, `GET /api/virtual-numbers/orders`, `POST /api/virtual-numbers/orders`, `GET /api/virtual-numbers/orders/{order}`, `POST /api/virtual-numbers/orders/{order}/poll`, `POST /api/virtual-numbers/orders/{order}/cancel` — each order-scoped route enforces `user_id` ownership before acting.

**Frontend:**
- New types (`VirtualNumberProviderOption`, `VirtualNumberCountry`, `VirtualNumberServiceOption`, `VirtualNumberOrderStatus`, `VirtualNumberOrder`) in `types/api.ts`, plus 4 new `queryKeys.ts` factory entries.
- `hooks/queries/useVirtualNumberQueries.ts` — providers/countries/services/orders queries (countries/services `enabled`-gated on provider/country selection; the orders query auto-polls every 10s while any order is `pending`/`waiting_code`) and buy/poll/cancel mutations, following the same pattern as `useWalletQueries.ts`.
- `app/(dashboard)/virtual-numbers/page.tsx` — provider tabs → country `<select>` → filterable service `<select>` → a price preview card (`≈ $X.XX + markup, converted to NGN at checkout`) → "Rent number" purchase button, followed by "Active" and "History" order sections with copyable phone numbers/SMS codes and Refresh/Cancel actions on active orders.
- Added a "Virtual Numbers" entry (`PhoneIcon`) to the desktop sidebar / mobile hamburger `navItems` in `AppLayout.tsx`. **Not** added to `BottomNav.tsx`'s mobile tab bar, which has a fixed 5-slot grid — the page remains reachable there via the sidebar/hamburger menu, which share the same `navItems` list.

**Verification performed:** `php -l` clean on all 9 new backend files; `php artisan test` still 2/2 passing (no dedicated tests yet for this feature); local migration + seeder ran clean; live smoke tests via `php artisan tinker` and via a real HTTP round-trip (`php artisan serve` + curl with a Sanctum token) against the real 5SIM and OnlineSIM accounts confirmed: country/service catalog browsing works for both providers; a purchase attempt against each provider with $0 provider-side balance correctly fails and triggers a full, verified wallet refund (balance unchanged before/after, order recorded as `refunded` with the exact reason in `meta.refund_reason`); a purchase attempt against `sms-man` correctly rejects with "not configured yet" (no active provider row); an invalid service code correctly rejects with a friendly error. Price math manually checked: a $0.10 service at 20% markup and a 1600 NGN/USD rate computed to exactly `₦192.00`. `npm run build` (Next.js + Turbopack) compiled clean with zero TypeScript errors across all 30 routes, including the new `/virtual-numbers` route. The **success** path (a real SMS code actually arriving) was never exercised, since both live provider test accounts have a $0 balance — only the purchase-failure/refund branch has been verified against real provider APIs.

**Open items, not yet resolved:**
- SMS-Man token has not been supplied — that adapter remains untested and its provider row should stay inactive in production until it is.
- The 20% markup and the 1600 NGN/USD placeholder rate are my own defaults, not yet explicitly confirmed by the project owner (both are admin-editable via the existing Settings UI without a redeploy).
- The "provider-scoped browsing" UX (pick a provider first, then browse its native catalog, rather than a unified cross-provider comparison view) was my own proposal and has not been explicitly confirmed either.
- OnlineSIM's buy/status **success** response shape is unverified against a real, funded transaction — flagged in the adapter's docblock for a spot-check once the account carries a positive balance.

**Deployment status:** ✅ Deployed to production. Committed as `8fd8a65`, pushed to `origin/main`.

**Vercel SAML SSO blocker — resolved again with a new team/project-scoped token.** Same recurring issue as §11/§18: the sandbox's default `VERCEL_TOKEN` is a personal-account token that the `charps-dev` team's SSO enforcement rejects for any team-scoped call. Unblocked with a new token supplied by the user; confirmed team-scoped access first (`GET /v9/projects/{id}` → `200`) before using it for the actual deploy, per the lesson learned in §11.

- **Backend**: reconnected the Railway GitHub source link (`serviceConnect`, stale again as usual — see §7's recurring note) then triggered `serviceInstanceDeploy`. Deployment `a214cf32-...` reached `SUCCESS` on commit `8fd8a65`. The new `virtual_number_orders` migration ran automatically via the existing `preDeployCommand: "php artisan migrate --force"` — no manual migration step needed.
- **Frontend**: `vercel deploy --prod --yes --token ...` from the **monorepo root** (per the path-doubling gotcha in §11). Cloud build compiled all 30 routes (including the new `/virtual-numbers`) with zero TypeScript errors in 32s, aliased to `https://charpsdev.vercel.app`.
- **Live verification**: `GET /up` → `200`; logged in as `test@example.com` against `https://charpsdev-production.up.railway.app/api`; `GET /api/virtual-numbers/providers` → `200` with an empty list (correct — no production `Provider` rows for 5sim/onlinesim/sms-man exist yet); `GET /api/virtual-numbers/orders` → `200` with an empty paginated list (confirms the new table/migration is live with no errors). Frontend `/`, `/login`, and `/virtual-numbers` all return `200` on `https://charpsdev.vercel.app`.
- **Production `Provider` rows for 5sim/onlinesim — ✅ created, with explicit user confirmation first** (this was intentionally held back until the user confirmed, since activating them enables real third-party API calls and real wallet debits). Done by connecting directly to the production Postgres DB (`DATABASE_PUBLIC_URL`, per the pattern in §7) with the backend's `DB_*` env vars overridden for a single `artisan tinker` invocation only (never written to a committed `.env`), and running `Provider::updateOrCreate()` with the exact same real credentials already verified working in local dev — same method used to seed local dev in the first place, just pointed at production. Sanity-checked the connection was really production (not local) via `User::count()` matching the known real user count (`7`) before writing. The temporary credentials file used to carry the key values between the local and production `tinker` calls was written to `/tmp` (never inside the repo), `chmod 600`, and shredded immediately after use.
- **Verified live end-to-end against production**: `GET /api/virtual-numbers/providers` now returns both `5sim` (id 3) and `onlinesim` (id 4); `GET /api/virtual-numbers/5sim/countries` and `GET /api/virtual-numbers/onlinesim/countries` both return real, live country catalogs fetched from the actual 5SIM/OnlineSIM APIs through the production backend — the full provider-scoped browsing flow is genuinely live, not just schema-deployed.
- SMS-Man still has no row anywhere, in production or local dev (no token ever supplied) — left inactive as documented.

## 21) Mobile Nav Drawer UX Polish + Settings/Support Pages

User submitted a structured 7-point UX critique of the mobile hamburger drawer (`AppLayout.tsx`'s off-canvas `SidebarContent`). All 7 addressed in `frontend/components/layout/AppLayout.tsx`:

1. **Width** ~85% → ~78vw, capped at `max-w-80` (320px).
2. **Close button** enlarged to a real 44×44px touch target (`flex size-11 items-center justify-center`), up from an icon-only `p-1.5` hit area.
3. **Active nav-item color** darkened via `bg-[color-mix(in_oklch,var(--color-primary),black_14%)]` — reused the exact `color-mix(in_oklch, ...)` pattern already established in `components/ui/button.tsx`'s `secondary` variant hover state, rather than introducing a second hardcoded brand-gold hex value.
4. **Profile card** padding `p-3` → `p-4`; **Logout button** changed from `variant="outline"` + `text-destructive` (red outline) to solid `bg-primary text-primary-foreground` (brand gold).
5. **Item spacing**: `<nav>` `space-y-1` → `space-y-2`, each item `py-2` → `py-2.5`.
6. **Overlay** `bg-foreground/40` → `bg-foreground/55`.
7. **Drawer/BottomNav duplication**: `BottomNav.tsx`'s fixed 5-slot mobile tab bar already covers Dashboard/Services/Orders/Wallet/Profile, so a new `MOBILE_DRAWER_HIDDEN_HREFS` Set (`/wallet`, `/orders`, `/profile`) filters those out of the mobile drawer only. `SidebarContent` gained a `variant: "desktop" | "mobile"` prop — desktop's `<aside>` always renders the full, unfiltered list (no bottom bar there to dedupe against).

**Verified via Playwright** (fresh chromium install in-sandbox, logged in as `test@example.com`, 390×844 mobile viewport + 1280×900 desktop viewport, scoped all DOM queries to the actual visible drawer panel to avoid a duplicate-`id="primary-navigation"` false match against the hidden desktop `<aside>`): `widthRatio: 0.78`, close button `44×44px`, overlay alpha `0.55`, `cardPadding: 16px`, `navGap: 8px`, active-link background resolves to the darkened `color-mix` gold, logout button background/text match solid brand gold, mobile `navLabels` correctly excludes Wallet/Orders/Profile while desktop retains the full list. `npm run build` clean, zero TypeScript errors.

**Settings and Support — scaffolded as a same-session follow-up.** Item 7 of the original request asked to keep "Dashboard, Services, Virtual Numbers, Settings, and Support" in the drawer. Dashboard/Services/Virtual Numbers were already there; Settings/Support were initially *not* added since neither had a user-facing page yet (only an admin-only `/admin/settings` existed) — flagged back to the user, who asked to scaffold both:

- **Backend**: new `PublicSettingController` + `GET /api/settings/public` (unauthenticated, hard-coded allowlist of `site_name`/`support_email` only — deliberately not a passthrough of every `Setting` row, since most settings — deposit bounds, virtual-number markup/FX rate — are internal business config that should never be exposed to an unauthenticated client).
- **`frontend/app/(dashboard)/settings/page.tsx`** — a thin hub page, not a duplicate settings form: Appearance (light/dark/system, mirrors the topbar `ThemeToggle` with visible labels instead of a dropdown), the existing `PushNotificationsCard`, quick links to `/profile` and a new `/profile#change-password` anchor (account editing and password change already live there — not re-implemented), and a Log out action styled to match the drawer's brand-gold Logout button.
- **`frontend/app/(dashboard)/support/page.tsx`** — a `mailto:` CTA driven by the new public `support_email` setting, quick links to Orders/Wallet, and a static FAQ accordion. No backend ticketing system exists, so this intentionally stays a self-service page rather than inventing a support-ticket feature that wasn't asked for.
- `AppLayout.tsx`'s `navItems` gained `Settings`/`Support` entries (`SettingsIcon`/`LifeBuoyIcon`); both appear on the desktop sidebar and the mobile drawer (not filtered by `MOBILE_DRAWER_HIDDEN_HREFS`), and were intentionally **not** added to `BottomNav.tsx`'s fixed 5-slot mobile tab bar.
- New `usePublicSettingsQuery` hook, `queryKeys.publicSettings` entry, `PublicSettings` type in `types/api.ts`.

**Verification performed:** `php -l` clean on the new controller; `php artisan test` still 2/2 passing (no dedicated tests for this feature area, consistent with the rest of the app); live smoke test of `GET /api/settings/public` against a local backend returned the real `support_email`. `npm run build` clean, zero TypeScript errors, all 32 routes (up from 30 — adds `/settings`, `/support`). Playwright end-to-end (fresh install, same login flow as above): mobile drawer now shows `[Dashboard, Services, Virtual Numbers, Cart, Notifications, Settings, Support]` (Wallet/Orders/Profile still correctly excluded); desktop sidebar shows all 10 items; `/settings` renders with working theme buttons; `/support` renders with a live `mailto:hello@charpsdev.com` link and a working FAQ accordion (`aria-expanded` toggles correctly); no new console errors beyond the pre-existing, unrelated Vercel Analytics/Speed Insights 404s expected in this sandbox.

**Deployment status:**
- **Backend**: pushed to `origin/main` (commits `8e7755b`, `56ebd2c`), then deployed to Railway via the same GraphQL `serviceConnect` (source link had gone stale again, as expected per the recurring note in §7) + `serviceInstanceDeploy(latestCommit: true)` pattern. Deployment `e1ed00fc-...` reached `SUCCESS` on commit `56ebd2c`. Verified live: `GET /up` → `200`.
- **Production `settings` table was completely empty (0 rows)** — discovered while verifying `/support` against production: `GET /api/settings/public` returned `{"site_name": null, "support_email": null}`. Root cause: `SettingsSeeder` had apparently never been run against production Postgres in any prior session. Fixed by connecting directly via `DATABASE_PUBLIC_URL` (same pattern as §7/§20: `DB_*` env vars overridden for a single `artisan db:seed --class=SettingsSeeder --force` invocation, never written to a committed `.env`), after sanity-checking the connection was really production via `User::count()` matching the known real user count (`7`). All 7 default settings rows (`site_name`, `support_email`, `min_deposit_amount`, `max_deposit_amount`, `maintenance_mode`, `virtual_number_markup_percent`, `usd_to_ngn_rate`) are now live in production — confirmed via `GET /api/settings/public` returning the real `support_email` (`hello@charpsdev.com`). This also means the admin Settings page (`/admin/settings`) — and anything else reading `Setting::get()`, e.g. deposit-amount validation — had silently been falling back to code defaults in production the entire time until this fix; worth an admin spot-check that no deposit/withdrawal validation was ever unexpectedly rejected due to a missing bound.
- **Frontend — ⛔ still blocked, not deployed to Vercel.** Same recurring SSO issue as §11/§18/§20: the sandbox's `VERCEL_TOKEN` is a personal-account token, rejected by the `charps-dev` team's SSO enforcement for any team-scoped call (`GET /v9/projects/{id}` → `403 forbidden`, `"saml": true`, `"scope": "charps-dev"`), confirmed at both the start and end of this session. Needs a fresh team/project-scoped token from the user before `vercel deploy --prod` can run. Local build against the real production `NEXT_PUBLIC_API_URL` (`https://charpsdev-production.up.railway.app/api`) was verified clean (32 routes, zero TypeScript errors) and is ready to ship the moment a working token is supplied.

**Vercel SAML SSO blocker — resolved with a new team/project-scoped token (same pattern as §11/§18/§20).** User supplied a fresh token; confirmed it was genuinely team-scoped first (`GET /v9/projects/{id}?teamId=...` → `200` with real project data) before using it for the deploy, per the established lesson from §11.

- **Frontend deployed**: `vercel deploy --prod --yes --token ...` from the **monorepo root** (per the path-doubling gotcha in §11), using the existing `.vercel/project.json` link (`projectId: prj_mOR7YvYLqCtyG3gdGNmb5YinwRzO`, `orgId: team_fkumd5iMZd2oFmBaRx37iacc`). Cloud build restored the prior build cache, compiled all 32 routes (including `/settings` and `/support`) with zero TypeScript errors in ~31s, and aliased to production at `https://charpsdev.vercel.app`.
- **Live verification**: `GET /`, `/login`, `/settings`, `/support` on `https://charpsdev.vercel.app` all return `200`; backend `GET /up` still `200`; `GET /api/settings/public` still returns the real seeded data. Full Playwright pass against the live production URL (fresh chromium install, logged in as `test@example.com`): mobile drawer (390×844) shows `[Dashboard, Services, Virtual Numbers, Cart, Notifications, Settings, Support]` (Wallet/Orders/Profile correctly excluded); desktop sidebar (1280×900) shows the full 10-item list; `/settings` renders with the `Settings` heading; `/support` renders with the `Support` heading and a live `mailto:hello@charpsdev.com` link.
- All three of this session's pending items are now closed: README committed (`75ce49e`), production settings gap fixed, and the frontend is live on Vercel with all Settings/Support + drawer-polish changes.
