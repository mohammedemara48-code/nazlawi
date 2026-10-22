# نزلاوي | Nazlawi

> كل ما تحتاجه في القرية بضغطة واحدة — Everything you need in the village, one tap away.

**العربية:** منصة خدمات للقرية (بقالة، ملابس، بناء، مشاوير، نقل بضائع، دليل طبي) بالعربي والإنجليزي، مع حسابات لمقدمي الخدمات ولوحة تحكم وإدارة لمراجعة الإعلانات.

**English:** A bilingual (Arabic RTL default / English) village services marketplace with provider accounts, a provider dashboard and an admin review queue. Built as a PWA so it can be wrapped as an Android app with Capacitor later.

## Stack
Next.js 15 (App Router, TypeScript) · Tailwind CSS · Prisma (SQLite for dev, Postgres-ready) · Zod · JWT session cookie (jose) + bcrypt · Vitest · Playwright (screenshots).

## التشغيل / Setup
```bash
npm install
cp .env.example .env          # ضع AUTH_SECRET عشوائي / set a random AUTH_SECRET (openssl rand -base64 32)
npx prisma db push            # إنشاء قاعدة البيانات / create the DB
npm run db:seed               # بيانات تجريبية (أمثلة وهمية) / fake demo data
npm run dev                   # http://localhost:3100
npm test                      # اختبارات الـ API / API tests (Postgres DB nazlawi_test, reset each run)
npm run build && npm start    # production
npm run lint                  # ESLint (next/core-web-vitals + typescript)
npm run worker                # video worker (polls VideoJob)
npx playwright install chromium && npm run screenshots   # screenshots/ (dev server must be running)
```

### حسابات تجريبية / Demo accounts (password `password123`)
| Email | Role |
|---|---|
| admin@example.com | ADMIN |
| provider@example.com | PROVIDER (store "بقالة الأمل", featured items, video, promotion) |
| provider2…7@example.com | PROVIDER (one store each, all sections) |
| provider8@example.com | PROVIDER (store pending review) |
| newprovider@example.com | PROVIDER without a store (→ onboarding) |
| resident@example.com | RESIDENT |
| unverified@example.com | PROVIDER (email not verified) |
| suspended@example.com | RESIDENT (suspended, can't sign in) |

كل بيانات الـ seed وهمية ومعلّمة كـ "مثال" (`isExample=true`، أرقام `0100000xxxx`). / All seed data is fake and flagged as example.

## Routes
- `/` Arabic (RTL), `/en` English. `/ar/*` redirects to `/`.
- `/c/[groceries|clothing|construction|rides|transport|medical]` (medical: `?subcategory=doctors|pharmacies|labs`), `/search?q=`
- `/login`, `/signup`, `/dashboard`, `/dashboard/new`, `/dashboard/edit/[id]`, `/admin` (ADMIN only)
- `/p/[id]` listing details with image gallery, price, video
- `/s/[slug]` store page (cover, logo, contact, video, featured, tabs, sort/filter by price)
- `/onboarding` create your store; `/dashboard/store` store settings, logo/cover/video
- `/admin/stores`, `/admin/videos`, `/admin/promotions`
- `/settings` (signed in): profile (name, phone, preferred language), change password, change email, delete account
- `/confirm-email?token=` confirms an email change
- `/admin/users`, `/admin/audit` (ADMIN only)
- `/forgot-password`, `/reset-password?token=`, `/verify?token=`
- `/dev/outbox` — development-only view of sent emails (hidden in production or when SMTP is configured)
- `/about`, `/contact`, `/privacy`, localized 404 (incl. tab title). Offline fallback: `public/offline.html` (ar/en).

## Architecture / البنية
```
src/lib/validation.ts      Zod schemas (bilingual messages "ar|en")
src/lib/errors.ts          ApiError, consistent JSON errors, api() wrapper, locale detection
src/lib/session.ts         JWT (HS256) in HttpOnly cookie, requireSession(roles)
src/lib/ratelimit.ts       RateLimiter interface: Redis (REDIS_URL) with in-memory fallback
src/lib/mailer.ts          Mailer interface: SMTP (SMTP_HOST) or dev outbox (console + .outbox/)
src/lib/storage.ts         Storage interface: LocalStorage (UPLOAD_DIR); add S3/R2 by implementing put/get/delete/url
src/lib/services/tokens.ts email verification & password reset tokens
src/lib/services/media.ts  image upload validation + sharp → WebP
src/lib/services/videos.ts ffprobe validation + ffmpeg → H.264 MP4 + poster
src/lib/price.ts           price formatting (ar/en) and parsing
src/lib/services/*.ts      business logic (users, stores, listings, promotions: ownership, moderation, search)
src/app/api/**/route.ts    thin route handlers: parse → authorize → service → JSON
src/middleware.ts          locale routing + redirect unauthenticated users from /dashboard, /admin
```
Roles: `RESIDENT` (browse), `PROVIDER` (manage own listings), `ADMIN` (approve/hide everything; cannot self-register — promote via DB).
Moderation: new provider listings are `PENDING`; editing content of an approved listing sends it back to `PENDING`; only `APPROVED` are public.
Email verification: sign-up sends a verification link (24 h). Providers must verify before creating listings (`EMAIL_NOT_VERIFIED`).
Password reset: `/forgot-password` → email link (30 min) → `/reset-password`. Tokens are 32 random bytes; only their SHA-256 is stored; single-use (atomic), expiring, and issuing a new one invalidates older ones. Completing a reset signs out (clears cookie) and marks the email verified.
Images: up to 4 per listing; JPG/PNG/WebP declared type **and** decoded format are checked (spoofed files rejected), max 5 MB, auto-rotated, resized to ≤1200 px and stored as WebP. Served from `/api/uploads/...` with immutable caching; keys are validated against path traversal.
Offline (PWA): `public/sw.js` pre-caches the app shell, caches recently viewed public pages and `/api/listings`, `/api/stores`, `/api/promotions` responses (network-first, last 40), static assets & uploaded images (cache-first), and serves `offline.html` (ar/en) when an unvisited page is opened offline. Private pages (dashboard/admin/auth) are never cached.
Sessions: the JWT carries a session version (`sv`). Every API call and server page re-checks the user in the DB (exists, `ACTIVE`, `sv` matches) and takes the role from the DB, so role changes and suspensions apply immediately. Changing the password bumps `sessionVersion` (signs out all other sessions; the current one gets a fresh cookie); a password reset and a suspension sign out everywhere.
Account settings: email change needs the password, sends a link to the **new** address (`CHANGE_EMAIL` token, 24 h, single use) and switches only after confirmation (re-checking the address is still free). Deleting the account needs the password and removes listings, image rows and stored files; the last active admin can't delete themselves.
Admin users: paginated/searchable list with role, verified, status, joined date and listing count. Admins can change roles, suspend/unsuspend and resend verification. An admin can't demote or suspend themselves and the last active admin can't be removed (`CANNOT_MODIFY_SELF`, `LAST_ADMIN`). Suspended users can't sign in (`ACCOUNT_SUSPENDED`) and their listings (and images) disappear from the public. All admin actions (user changes, listing approve/hide) go to `AuditLog` (actor email kept even if the actor is deleted).
Image access: images of pending/hidden listings or of suspended owners are served only to the owner or an admin (others get 404); public images are cached for 1 day, private ones `no-store`.
Search: a normalized `searchText` column (lowercase, Arabic alef/yaa/taa-marbuta unified, diacritics stripped), indexed; multi-word AND match.

## Marketplace model / نموذج السوق
- **Store (متجر)** belongs to a provider (one per provider for now; the schema allows more). It has a section (category) and, for medical, a subcategory. New stores are `PENDING` until an admin approves. A provider without a store is sent to `/onboarding`.
- **Listing (إعلان)** always lives in a store and inherits its section. Optional **group** = provider-defined tab on the store page.
- **Featured**: up to 3 ordered listings per store (`featuredPosition` 1..3), only the store's own `APPROVED` listings. Hiding, re-queuing or deleting a listing removes it and closes the gap.
- **Category page** `/c/[slug]` lists **stores**: each row shows logo + name (→ `/s/[slug]`) and its featured listings.
- **Video**: one per listing and/or store; private (owner/admin only) until `APPROVED`.
- **Promotion (عروض مميزة)**: targets a listing or a store, has a date window and priority. Only `APPROVED` promotions inside their window show in the story strip (home and per category); they're marked `EXPIRED` automatically once `endsAt` passes.
- **Price**: integer minor units (piasters) + `currency` (default `EGP`); `priceType` `FIXED | FROM | NEGOTIABLE | ON_REQUEST` (required on create; amount required for FIXED/FROM, forbidden for ON_REQUEST); optional `oldPriceMinor` must be higher than the price (shown struck-through with a discount %); optional unit `unitAr/unitEn`. Formatting: `١٥٠ ج.م / للكيلو` (ar) and `EGP 150 / per kg` (en). Price filters in queries use major units (`minPrice=10` = 10 EGP). Sorting by price puts listings without an amount last; stores are sorted by their cheapest (asc) / most expensive (desc) public listing.

```mermaid
erDiagram
  User ||--o{ Store : owns
  User ||--o{ Listing : owns
  User ||--o{ Promotion : requests
  Store ||--o{ ListingGroup : tabs
  Store ||--o{ Listing : contains
  ListingGroup |o--o{ Listing : groups
  Listing ||--o{ ListingImage : images
  Store |o--o| Video : promo
  Listing |o--o| Video : promo
  Store ||--o{ Promotion : target
  Listing |o--o{ Promotion : target
  User ||--o{ AuditLog : acts
  Store { string slug UK; string category; string subcategory; string status; string logoKey; string coverKey }
  Listing { string category; int priceMinor; int oldPriceMinor; string priceType; string currency; int featuredPosition; string status }
  Video { string key; string posterKey; float durationSec; string status }
  Promotion { string targetType; datetime startsAt; datetime endsAt; int priority; string status }
```

## API
All responses are JSON. Errors are always:
```json
{ "error": { "code": "VALIDATION", "message": "البيانات المدخلة غير صحيحة", "details": [{ "field": "email", "message": "..." }] } }
```
Language of messages: `?lang=en|ar` or `Accept-Language` (default Arabic).
Codes: `VALIDATION` 422, `BAD_JSON` 400, `TOKEN_INVALID` 400, `ACCOUNT_SUSPENDED` 403, `WRONG_PASSWORD` 403, `CANNOT_MODIFY_SELF` 409, `LAST_ADMIN` 409, `SAME_EMAIL` 409, `UNAUTHORIZED` 401, `INVALID_CREDENTIALS` 401, `FORBIDDEN` 403, `EMAIL_NOT_VERIFIED` 403, `NOT_FOUND` 404, `EMAIL_TAKEN` 409, `TOO_MANY_IMAGES` 409, `FILE_TOO_LARGE` 413, `FILE_TYPE` 415, `STORE_REQUIRED` 409, `STORE_EXISTS` 409, `FEATURED_LIMIT` 422, `NOT_APPROVED` 409, `VIDEO_INVALID` 415, `VIDEO_TOO_LARGE` 413, `VIDEO_TOO_LONG` 422, `INVALID_DATES` 422, `PROMOTION_LIMIT` 429, `PROMOTION_ENDED` 409, `RATE_LIMITED` 429 (+`Retry-After`), `INTERNAL` 500.
All Zod messages (including missing fields: "هذا الحقل مطلوب" / "This field is required") are bilingual.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | – | `{name,email,password,role?: RESIDENT\|PROVIDER}` → 201 `{user}` + cookie. Rate limit 5/min/IP |
| POST | `/api/auth/login` | – | `{email,password}` → `{user}` + cookie. Rate limit 10/min/IP, 5/min/email |
| POST | `/api/auth/logout` | – | clears cookie |
| POST | `/api/auth/verify-email` | – | `{token}` → marks email verified (single use) |
| POST | `/api/auth/resend-verification` | any | re-sends the link (3 / 15 min) |
| POST | `/api/auth/forgot-password` | – | `{email}` → always 200 (no enumeration). Rate limit 10 / 15 min / IP, 3 / 15 min / email |
| POST | `/api/auth/reset-password` | – | `{token, password}` → 200, clears session cookie |
| GET | `/api/auth/me` | any | current user |
| GET | `/api/listings` | – | approved listings. Query: `q, category, subcategory, sort=newest\|price_asc\|price_desc, minPrice, maxPrice` (EGP, major units), `page, pageSize (≤50)` → `{items,page,pageSize,total,totalPages}`; each item has price fields + store brief |
| POST | `/api/listings` | PROVIDER/ADMIN | create in my store (`STORE_REQUIRED` 409 if none): `{nameAr, nameEn, descAr?, descEn?, priceType, priceMinor?, oldPriceMinor?, currency?, unitAr?, unitEn?, groupId?, phone?, whatsapp?, available?}` → PENDING. Category/phone come from the store |
| GET | `/api/listings/:id` | – | approved, or own/admin (incl. store and approved video) |
| PATCH | `/api/listings/:id` | owner/ADMIN | partial update; content change → PENDING and unfeatured; price rule is checked on the merged result |
| DELETE | `/api/listings/:id` | owner/ADMIN | 204, files removed, featured positions compacted |
| PATCH | `/api/listings/:id/availability` | owner/ADMIN | `{available}` |
| POST/DELETE | `/api/listings/:id/images[/:imageId]` | owner/ADMIN | multipart `file` (max 4, 5 MB) |
| GET | `/api/me/listings`, `/api/me/store`, `/api/me/promotions` | PROVIDER/ADMIN | my data, all statuses |
| GET | `/api/stores` | – | public stores: `category, subcategory, q, sort, minPrice, maxPrice, page, pageSize` → each with `featured` (≤3, ordered) and `listingCount` |
| POST | `/api/stores` | PROVIDER/ADMIN | onboarding `{category (required), subcategory (required for medical), nameAr, nameEn, bioAr?, bioEn?, phone, whatsapp?, addressAr?, addressEn?, area?}` → PENDING. One store per provider (`STORE_EXISTS`). 5/h |
| GET | `/api/stores/by-slug/:slug` | – | store page: `{store, video, featured, groups[{count}], listings{…}}`, query `group, sort, minPrice, maxPrice, page` |
| PATCH | `/api/stores/:id` | owner/ADMIN | partial; name/section change re-queues for review |
| POST | `/api/stores/:id/images?kind=logo\|cover` | owner/ADMIN | multipart `file` |
| PUT | `/api/stores/:id/featured` | owner/ADMIN | `{listingIds: [≤3]}` own APPROVED listings, order = position (`FEATURED_LIMIT`, `NOT_APPROVED`, `FORBIDDEN`) |
| GET/POST, PATCH/DELETE | `/api/stores/:id/groups[/:groupId]` | owner/ADMIN | tab groups |
| POST | `/api/videos` | PROVIDER/ADMIN | multipart `file` + `listingId` or `storeId`. mp4/webm/mov, ffprobe-checked, ≤50 MB (`VIDEO_MAX_MB`), ≤60 s (`VIDEO_MAX_SECONDS`) → H.264 MP4 + WebP poster, PENDING. Replaces the old one. 5/h |
| DELETE | `/api/videos/:id` | owner/ADMIN | 204 |
| GET | `/api/promotions` | – | active strip items (`?category=`), by priority; expired ones flip to EXPIRED automatically |
| POST | `/api/promotions` | PROVIDER/ADMIN | `{targetType: LISTING\|STORE, listingId\|storeId, startsAt, endsAt (≤30 days), note?}` → PENDING (max 3 pending). 10/h |
| DELETE | `/api/promotions/:id` | owner/ADMIN | cancel |
| GET, PATCH | `/api/admin/listings[/:id/status]` | ADMIN | moderation, audited; non-approved listings are unfeatured |
| GET, PATCH | `/api/admin/stores[/:id/status]` | ADMIN | moderation, audited |
| GET, PATCH | `/api/admin/videos[/:id/status]` | ADMIN | `PENDING\|APPROVED\|REJECTED`, audited |
| GET, PATCH | `/api/admin/promotions[/:id]` | ADMIN | `{status?, priority?, startsAt?, endsAt?}` (`PROMOTION_ENDED`), audited |
| GET | `/api/uploads/*key` | – | serves stored WebP images |
| GET | `/api/account` | any | my account |
| PATCH | `/api/account/profile` | any | `{name?, phone?, locale?: ar\|en}` (30 / 15 min) |
| POST | `/api/account/password` | any | `{currentPassword, newPassword}` → new cookie, other sessions signed out (5 / 15 min) |
| POST | `/api/account/email` | any | `{password, newEmail}` → 202, link sent to new address (3 / 15 min) |
| POST | `/api/auth/confirm-email-change` | – | `{token}` |
| DELETE | `/api/account` | any | `{password}` → deletes account + listings + images (5 / 15 min) |
| GET | `/api/admin/users` | ADMIN | `q, role, status, page, pageSize` |
| PATCH | `/api/admin/users/:id` | ADMIN | `{role?, status?: ACTIVE\|SUSPENDED}` (60 / min) |
| POST | `/api/admin/users/:id/resend-verification` | ADMIN | → `{sent}` (3 / 15 min per user) |
| GET | `/api/admin/audit` | ADMIN | `page, pageSize` |
| GET | `/api/health` | – | DB health check |

## Production stack / Postgres / Storage / Jobs
See **DEPLOY.md** (Arabic + English) for the Vercel + Neon Postgres + Vercel Blob + Upstash setup.
- **Database:** PostgreSQL via Prisma migrations (`prisma/migrations`). `DATABASE_URL` (pooled) + `DIRECT_URL` (migrations). Local dev: `sudo apt-get install postgresql` (or Docker `postgres:17`), create role/db `nazlawi` and `nazlawi_test`, then `npm run db:migrate && npm run db:seed`.
- **Storage:** `STORAGE_DRIVER=local|vercel-blob` behind `src/lib/storage.ts`. With Blob, the browser uploads directly (token from `POST /api/uploads/token`, scoped to `incoming/<userId>/`, type/size-limited, 10 min) and the API finalizes with `{sourceKey}`. The Blob store is private; all reads go through `/api/uploads/<key>` (authorization + Range + short CDN cache). Tradeoff documented in DEPLOY.md §4.
- **Videos:** upload → `Video(processing=QUEUED)` + `VideoJob` → worker (`npm run worker`) or `/api/cron/videos` transcodes (ffprobe validation, H.264 MP4 ≤720p + WebP poster) → `READY`. Retries with backoff, permanent failure reasons (`VIDEO_INVALID`, `VIDEO_TOO_LONG`, …) shown to the owner; the dashboard auto-refreshes while processing.
- **Rate limits:** Upstash REST (`UPSTASH_REDIS_REST_*` or `KV_REST_API_*`) → `REDIS_URL` → memory.
- **Cron:** `vercel.json` → `/api/cron/promotions` (hourly), `/api/cron/videos` (5 min), `/api/cron/cleanup` (daily), all require `Authorization: Bearer $CRON_SECRET`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/uploads/token` | PROVIDER/ADMIN (owner) | Vercel Blob client-upload token (`STORAGE_DRIVER=vercel-blob` only) |
| GET | `/api/cron/promotions`, `/api/cron/videos`, `/api/cron/cleanup` | `Bearer CRON_SECRET` | scheduled jobs |

Image/video upload endpoints accept multipart `file` **or** JSON `{sourceKey}` (direct upload).

## PWA / Android
`public/manifest.webmanifest`, icons in `public/icons/`, minimal `public/sw.js`. To wrap with Capacitor later: deploy the site, then `npx cap init` and point `server.url` at the deployed URL (or export a static shell).

## Environment
See `.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` (used in email links), `SMTP_*` + `MAIL_FROM` (empty `SMTP_HOST` = dev outbox), `REDIS_URL` (optional), `UPLOAD_DIR`.

## Tests
`npm test` — 52 Vitest tests against Postgres (`TEST_DATABASE_URL`, default `nazlawi_test`; incl. video job queue/retries/row locking, direct-upload ownership, cron auth, Range parsing, limiter selection) (`tests/marketplace.test.ts`: onboarding, price validation/formatting/sort/filter, featured limits + ownership + auto-unfeature, category store query, store page data, video validation/transcoding/approval, promotion lifecycle/expiry/limits, store moderation + audit; the rest:: auth, roles, ownership, moderation, search/pagination, verification, password reset (hashing, expiry, single-use, invalidation, rate limit, localized messages) and image uploads (resize/WebP, type/size/spoof checks, max count, ownership, path traversal), account settings (profile, password change + session invalidation, email change flow, account deletion incl. files, last-admin guard, rate limits), admin user management (access control, search/pagination, role change, self/last-admin guards, suspension effects, resend verification, audit log) and private image access).

## Screenshots
`npx tsx scripts/screenshots-marketplace.ts` — stores, promotions, prices (home-promo-strip-ar, category-stores-ar, store-page-ar, provider-onboarding-ar, dashboard-featured-ar, admin-promotions-en, …).
`npm run screenshots` (dev server on :3100). Note: the forgot-password step is rate-limited (3 per 15 min per email), so restart the dev server between repeated runs.

## Known gaps
- One store per provider is enforced in the service (the schema allows more); no multi-currency UI (only EGP).
- Promotions: hourly Vercel Cron + on-read filtering; no payment for promotions.
- Store price sort is computed per request with a groupBy (fine for village scale; add a cached min/max column if it grows).
- The Vercel Blob driver and Upstash limiter are implemented but untested against the real services (no credentials yet; covered by unit tests of selection/parsing only). Images aren't reorderable.
- Vercel Blob direct uploads require `STORAGE_DRIVER=vercel-blob` at build time (exposed as `NEXT_PUBLIC_STORAGE_DRIVER`).
- Video processing on Vercel Cron needs bundled ffmpeg (see DEPLOY.md §10); a separate worker is recommended.
- Middleware only checks the JWT signature (edge runtime); the full DB session check happens in pages and APIs, so a revoked session may briefly see a protected page shell before redirect/404.
- Admin role changes are not confirmed by a dialog; no bulk actions; audit log has no filters/export.
- Images already cached by a browser/service worker may remain visible on that device after a listing is hidden.
- Offline: no background sync; forms don't work offline.
