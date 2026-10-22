# Security Policy

## Reporting a vulnerability
Please **do not open a public issue**. Report privately via
[GitHub Security Advisories](https://github.com/mohammedemara48-code/nazlawi/security/advisories/new).
Include steps to reproduce and the impact. We aim to acknowledge within 3 days and fix critical issues as fast as possible.

## Supported versions
Only the latest production deployment (`main`) and the latest Android release are supported.

## Scope / practices
- Passwords are bcrypt-hashed; sessions are signed HttpOnly cookies; all API routes enforce roles and ownership.
- Uploads are type- and size-limited and re-encoded server-side; direct Blob upload tokens are short-lived and path-scoped.
- Security headers (CSP, HSTS, nosniff, frame-ancestors) are set in `next.config.mjs`.
- Secrets live only in Vercel environment variables, never in the repo. Secret scanning + push protection are enabled.
