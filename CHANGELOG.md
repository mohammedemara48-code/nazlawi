# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/).
Web and Android share the version number (Android `versionName` / `versionCode` in brackets).

## [Unreleased]
### Fixed
- Verification email: delivery result is now logged (`[mail] sent:true|false`, masked address, error code only) and returned; "Resend verification" reports failures instead of always saying "sent"; links fall back to the Vercel production URL if `APP_URL` is missing; resend button + spam hint also on the profile page.

### Added
- New provider sections: **Crafts / مهن** (electrician, plumber, carpenter, plastering, gypsum, or a custom craft name), **Productive families / أسرة منتجة**, **Event preparation / تجهيز مناسبات** — same store features as the other sections; trade filter tabs and searchable trade names.
- **Event invitations / دعوات المناسبات** timeline (`/invitations`): residents post one image (JPG/PNG/WebP ≤5 MB, re-encoded to WebP) + caption (≤500 chars); any signed-in user can like and comment; report button on posts and comments; authors delete their own content; admins delete anything **permanently** (rows + image) from the timeline or the new **Admin → Reports** page. Posting is rate-limited (2/min, 5/day), comments 10/min.
- **Profile page** (`/profile`) with profile photo upload, and a public user page (`/u/:id`); photo + name shown on posts and comments.
- Database migration `20261023150000_crafts_invitations` (additive only: `Store.craftName`, `User.avatarKey`, `Post`, `PostComment`, `PostLike`, `PostReport`).
- Privacy policy and Terms of use pages (ar/en), linked in the footer.
- SEO: Open Graph metadata, dynamic `sitemap.xml` / `robots.txt`, JSON-LD for stores (LocalBusiness) and products (Product + price).
- Security headers (CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors).
- GitHub CI (typecheck, lint, unit tests, browser smoke), Dependabot, issue/PR templates, SECURITY/CONTRIBUTING, LICENSE.

## [1.2.0] — 2026-10-22 (Android 1.2 / 3)
### Added
- Merchant catalog: sections and priced products (unit, old price, stock, featured, reorder), published instantly; WhatsApp ordering.
- Dedicated **Promote** tab in the merchant dashboard.
- Map pins for every location field (store, product, profile address); GPS auto-centering.
- Admin demo grocery store; admin audit of store ownership.
### Changed
- Admin delete of stores/products is **permanent** (rows + files) with a confirmation dialog.
- Admins can no longer own or open stores.
### Fixed
- Uploads stuck near 100% (Blob access mode), upload routes missing from deploys, store logo/cover upload entry restored.
- Browser smoke suite gates every deploy.

## [1.1.0] — 2026-10-22 (Android 1.1 / 2)
### Added
- Store location on a Leaflet/OpenStreetMap map; Android location permission.
### Fixed
- Production signup error (mail outbox on serverless), upload 404s, friendlier upload errors.

## [1.0.0] — 2026-10-22 (Android 1.0 / 1)
### Added
- Initial release: bilingual (ar/en) village services marketplace — stores, listings with prices, categories, search, provider dashboard,
  admin moderation (stores, videos, promotions, users, audit log), email verification and password reset, PWA.
- Vercel deployment (Postgres, Vercel Blob, Cron) and the Capacitor Android app.

[Unreleased]: https://github.com/mohammedemara48-code/nazlawi/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/mohammedemara48-code/nazlawi/releases/tag/v1.2.0
