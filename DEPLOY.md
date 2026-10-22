# النشر على Vercel / Deploying to Vercel

> الحالة: المشروع **جاهز** للنشر لكنه **لم يُنشر**. لا توجد حسابات أو موارد سحابية مُنشأة بعد.
> Status: the project is **ready** to deploy but has **not** been deployed. No cloud accounts or resources exist yet.

Production stack: **Vercel** (Next.js) + **Postgres** (Neon via the Vercel Marketplace, or any Postgres) + **Vercel Blob** (private store) + **Upstash Redis** (rate limiting) + a **video worker** (Railway/Fly, or Vercel Cron for short clips).

---

## 0. المتطلبات / Prerequisites
- حساب GitHub + حساب Vercel. / A GitHub account and a Vercel account.
- Node 20+ و `npm` على جهازك (لتشغيل الـ migrations والـ seed من جهازك لو حبيت). / Node 20+ locally (optional, to run migrations/seed from your machine).
- (للـ worker) حساب Railway أو Fly.io. / (for the worker) a Railway or Fly.io account.

## 1. ارفع الكود على GitHub / Push the code to GitHub
```bash
git remote add origin git@github.com:<you>/nazlawi.git
git push -u origin main
```
(المستودع المحلي فيه commit أول نظيف بدون أسرار. / The local repo already has a clean first commit with no secrets.)

## 2. أنشئ مشروع Vercel / Create the Vercel project
1. Vercel → **Add New… → Project** → Import the GitHub repo.
2. Framework: **Next.js** (auto). Build command comes from `vercel.json`: `npm run vercel-build` (= `prisma generate && prisma migrate deploy && next build`).
3. **لا تضغط Deploy بعد** — أضف قاعدة البيانات والتخزين والمتغيرات أولاً. / **Don't deploy yet** — add the database, storage and env vars first (or let the first deploy fail and redeploy).

## 3. قاعدة البيانات Postgres (Neon) / Database
1. Project → **Storage** → **Create Database** → **Neon (Postgres)** → pick region close to users (e.g. `fra1` / Frankfurt, same as `vercel.json`) → Connect to the project (all environments).
2. Vercel adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) (names can vary: `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING`).
3. أضف / Add:
   - `DATABASE_URL` = the **pooled** URL + `&pgbouncer=true&connect_timeout=15` (must include `sslmode=require`).
   - `DIRECT_URL` = the **unpooled/direct** URL (used by `prisma migrate deploy`).

## 4. التخزين Vercel Blob / Storage
1. Project → **Storage** → **Create** → **Blob** → access **Private** → connect to the project. This sets `BLOB_READ_WRITE_TOKEN`.
2. أضف `STORAGE_DRIVER=vercel-blob`. / Add `STORAGE_DRIVER=vercel-blob`.

How media works in production:
- The browser asks `POST /api/uploads/token` for a 10‑minute upload token. The route checks the session, the role and ownership of the listing/store, and limits the path (`incoming/<userId>/…` + random suffix), content type and size (images 5 MB, video `VIDEO_MAX_MB`).
- The browser uploads **directly** to the private Blob store (no 4.5 MB serverless body limit), then calls our API with `{sourceKey}`. Images are verified and converted to WebP immediately; videos get a `VideoJob`.
- Every read goes through `GET /api/uploads/<key>`, which checks `mediaAccess` (approved + public parent, or owner/admin). Blob URLs are never exposed; the store is private, so blobs aren't publicly reachable or listable.

**المفاضلة / Tradeoff:** serving through a function costs function time/bandwidth (videos are streamed with HTTP Range). Public media is sent with `Cache-Control: public, s-maxage=300`, so Vercel's CDN serves repeat views; a hidden/unapproved item can stay cached at the edge for ≤5 minutes (and ≤1 h in a browser that already loaded it). Private media is `no-store`. Alternative if bandwidth grows: redirect approved media to short-lived presigned Blob URLs (`presignUrl`) — cheaper, but links work for anyone until they expire.

## 5. Rate limiting (Upstash Redis)
1. Project → **Storage** → **Upstash for Redis** (Marketplace) → create (free tier OK) → connect. It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` from console.upstash.com).
2. بدونها، الحدود تكون في الذاكرة لكل instance فقط. / Without it, limits are per-instance memory only (weak on serverless).

## 6. باقي المتغيرات / Remaining environment variables
In **Settings → Environment Variables** (Production + Preview):

| Var | Value |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | `https://<your-domain>` |
| `CRON_SECRET` | `openssl rand -hex 32` (Vercel sends it to cron routes automatically) |
| `STORAGE_DRIVER` | `vercel-blob` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | your email provider (Resend, Postmark, SES, Gmail SMTP…) |
| `VIDEO_MAX_MB`, `VIDEO_MAX_SECONDS` | optional (50 / 60) |

The full list with comments is in `.env.example`.

## 7. الـ migrations والـ seed / Migrations and seed
- Migrations run automatically on every deploy (`prisma migrate deploy` in `vercel-build`).
- To run manually from your machine (uses `DIRECT_URL`):
```bash
vercel env pull .env.production.local      # needs `npm i -g vercel` and `vercel link`
npx dotenv -e .env.production.local -- npx prisma migrate deploy
```
- Demo data (optional; everything is marked "مثال", password `password123` — **change/delete these users before real launch**):
```bash
STORAGE_DRIVER=vercel-blob npx dotenv -e .env.production.local -- npm run db:seed
```
(the seed generates a short demo video with ffmpeg, so run it on a machine with ffmpeg).
- First admin: sign up normally, then in Neon's SQL editor: `UPDATE "User" SET role='ADMIN' WHERE email='you@…';`

## 8. Deploy
Project → **Deployments → Redeploy** (or push to `main`). Check `https://<domain>/api/health`.

## 9. Cron
`vercel.json` defines:
| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/promotions` | hourly | mark ended promotions `EXPIRED` (reads also filter by date) |
| `/api/cron/videos` | every 5 min | process queued videos (short clips) |
| `/api/cron/cleanup` | daily 03:30 UTC | delete abandoned direct uploads (`incoming/` > 24 h) |

- **Hobby plan:** crons run at most **once a day** → change schedules to daily (e.g. `"0 3 * * *"`) or use Pro. Promotions are still hidden on time because every read filters by date.
- All cron routes reject requests without `Authorization: Bearer $CRON_SECRET`.
- Test: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/promotions`.

## 10. معالجة الفيديو / Video worker
Uploads are queued (`Video.processing = QUEUED`, shown as "جاري المعالجة" to the owner) and transcoded to H.264 MP4 + poster by a worker. Jobs are claimed with a Postgres row lock (`FOR UPDATE SKIP LOCKED`), retried with exponential backoff (3 attempts), and stale locks (>15 min) are recovered. Invalid/too long files fail permanently with a reason shown to the owner.

**Option A — small worker on Railway or Fly.io (recommended)**
- Railway: New Project → Deploy from GitHub repo → Start command `npm run worker` → add env vars `DATABASE_URL` (direct or pooled), `STORAGE_DRIVER=vercel-blob`, `BLOB_READ_WRITE_TOKEN`, `VIDEO_MAX_MB`, `VIDEO_MAX_SECONDS`. Add ffmpeg via `nixpacks.toml` (`[phases.setup] nixPkgs = ["...", "ffmpeg"]`) or a Dockerfile (`apt-get install -y ffmpeg`).
- Fly.io: a Dockerfile `FROM node:20-slim` + `apt-get install -y ffmpeg` + `npm ci` + `CMD ["npm","run","worker"]`; `fly launch --no-deploy`, `fly secrets set …`, `fly deploy`. 256–512 MB RAM is enough for 60 s / 720p clips.
- With a worker running, you can remove the `/api/cron/videos` entry from `vercel.json`.

**Option B — Vercel Cron only (short clips, low volume)**
- Vercel functions don't ship ffmpeg. Add `ffmpeg-static` and `ffprobe-static` to dependencies and set `FFMPEG_PATH` / `FFPROBE_PATH` to their binaries (e.g. `node_modules/ffmpeg-static/ffmpeg`), and make sure they're included in the function bundle (`outputFileTracingIncludes` in `next.config.mjs`). Function time limit applies (`maxDuration` 300 s on Pro; Hobby is much shorter) — keep `VIDEO_MAX_SECONDS` low.

## 11. بعد النشر / After deploying
- Sign up, verify email (SMTP must work), make yourself admin (step 7).
- Upload a store logo and a short video, confirm "جاري المعالجة" turns into the player after the worker/cron runs, approve it in `/admin/videos`.
- Optional: custom domain in Project → Settings → Domains, then update `APP_URL`.
