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

