# Contributing

This is a proprietary project (see [LICENSE](LICENSE)); contributions are by invitation.

1. `npm install`, `cp .env.example .env`, `npx prisma migrate dev` (local Postgres).
2. Enable the gate once: `git config core.hooksPath .githooks`.
3. Branch from `main`, keep changes focused, add Arabic **and** English text for any UI.
4. Run `npm run predeploy` (typecheck, lint, unit tests, browser smoke). CI runs the same on every PR.
5. Optional formatting: `npx prettier --write <files>` on the files you touched (`npm run format` formats everything).
6. Open a PR using the template. `main` deploys to production on Vercel.

Never commit secrets, `.env` files, keystores or real user data.
