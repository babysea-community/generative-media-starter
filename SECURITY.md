# Security policy

## Reporting vulnerabilities

Please report vulnerabilities privately through GitHub's **Report a vulnerability** flow on the public `babysea-community/generative-media-starter` repository. If that flow is unavailable, contact the maintainers at `dev@babysea.ai`.

Do not open public issues for suspected vulnerabilities or exposed secrets.

## Supported versions

This starter is versioned from the `main` branch until the first tagged release. Security fixes target the latest public source.

## Sentry and code guard

The public starter repository is connected to a private, repository-specific Sentry project for repository ownership, Seer-assisted review, and issue routing. The Sentry organization slug and project slug are intentionally not committed to this public repo.

The starter includes optional runtime Sentry error capture for server and browser paths. Sentry initializes only when `NEXT_PUBLIC_SENTRY_DSN` is set, so local development and forked deployments can run without telemetry configured.

The public starter also ships `scripts/sentry-project-check.mjs` and a scheduled `Sentry Project Check` workflow that verifies the configured Sentry project wiring and ownership rules. The workflow uses GitHub Actions secrets. Local runs may read ignored `.sentryclirc` defaults for org/project/url, but `SENTRY_AUTH_TOKEN` must stay in an environment variable or secret store.

Build-time sourcemap upload uses `SENTRY_AUTH_TOKEN`. Treat that token as a secret even though `NEXT_PUBLIC_SENTRY_DSN` is safe to expose to the browser.

## Secret handling

- Never commit `.env`, `.env.local`, `.env.production`, `.vercel`, `.sentryclirc`, or exported dashboard secrets.
- Keep `BABYSEA_API_KEY`, `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_AUTH_TOKEN`, and Upstash tokens server-side.
- Only intentionally public values should use `NEXT_PUBLIC_`. Never expose service-role keys, provider keys, storage write keys, or Sentry auth tokens with that prefix.
- Rotate any secret that appears in logs, screenshots, chat, issues, or pull requests.
- Use test-mode Stripe keys for local development and live keys only in production deployment secrets.
