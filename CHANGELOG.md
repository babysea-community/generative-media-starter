# Changelog

All notable changes will be documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Added `LICENSES.md` and a README security/compliance section documenting public GitLab and GitHub trust signals.

### Changed

- Standardized GitLab application security coverage with SAST-IaC, guarded Container Scanning, shared security variables, and license-compliance documentation.

## [0.4.0] - 2026-05-27

### Changed

- Updated the standalone starter catalog to `babysea@2.0.0` for SDK-backed generation.
- Bumped the starter release metadata to `0.4.0` for the SDK 2.0.0 compatibility update.

## [0.3.9] - 2026-05-25

### Added

- Added GitHub issue templates (`.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`, `config.yml`) and `.github/PULL_REQUEST_TEMPLATE.md` so contributors get a consistent intake form. The template set is identical across all BabySea OSS repos (primitives, starters, SDK) so it can be reused without project-specific adjustments.

### Changed

- Condensed the README into the shared BabyChain-style starter structure and added a dynamic Vercel deployment status badge for `https://generative-media-starter.vercel.app` while keeping the existing realtime GitLab, CircleCI, Codecov, Sentry, CodeQL, and Package checks.
- Expanded `AGENTS.md` into the shared starter guide structure with Generative-specific auth, Stripe billing, credit ledger, BabySea SDK, private storage, rate-limit, and verification rules.

### Fixed

- Synchronized the doctor deploy-button check with the README Vercel button environment list, including `BABYSEA_API_BASE_URL`.

## [0.3.8] - 2026-05-25

### Changed

- Reorganized `lib/` to match the Sherin starter layout: `babysea.ts` moved to `lib/inference/babysea.ts`; `stripe.ts` and `stripe-prices.ts` moved under `lib/billing/` (as `stripe.ts` and `prices.ts`); `storage.ts` moved to `lib/storage/index.ts`; `rate-limit.ts` moved to `lib/security/rate-limit.ts`; `env.ts` moved to `lib/utils/env.ts`; `utils.ts` moved to `lib/utils/index.ts`; `generation-descriptions.json` moved to `lib/generation/descriptions.json`. All `@/lib/*` import paths updated; no runtime behavior changes.

### Added

- Added `Content-Security-Policy` via `lib/security/csp.ts`, applied through `next.config.ts`. Connect, image, script, and frame directives are scoped to BabySea API regions, the BabySea CDN, Supabase (HTTP + WS), Stripe (api, js, m, hooks, checkout), and any configured `BABYSEA_API_BASE_URL` and `NEXT_PUBLIC_SENTRY_DSN` hosts; `frame-ancestors` is `'none'` and `object-src` is `'none'`. JSON API routes also receive `Cache-Control: no-store` via `API_SECURITY_HEADERS`.
- Added a `.gitleaks.toml` with project-specific allowlist entries so the Gitleaks workflow ignores documentation and CI placeholder examples (mirrors BabyChain).
- Added a Vercel deploy preflight that fails the workflow if `NEXT_PUBLIC_SITE_URL`, `BABYSEA_API_KEY`, `BABYSEA_API_BASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Supabase keys, or Upstash credentials are missing—and validates BabySea API host, HTTPS, and Stripe key prefixes—so misconfiguration is caught before deploy instead of at runtime (mirrors BabyChain's deploy preflight).
- Quoted `VERCEL_ENVIRONMENT` in `deploy.yml` via a dedicated env var rather than inline interpolation, matching BabyChain's hardened deploy pattern.

## [0.3.7] - 2026-05-24

### Added

- Added a GitLab CI pipeline that mirrors BabyChain's verification, coverage, build, dependency audit, secret scanning, Code Quality, SAST, Dependency Scanning, and scheduled/manual DAST checks.
- Added Cobertura coverage output and a CI-safe doctor mode so GitLab can validate the starter with placeholder environment values.

## [0.3.6] - 2026-05-23

### Changed

- Aligned the standalone pnpm catalog with Sherin's Tailwind CSS, Tailwind PostCSS, and tailwind-merge versions.
- Simplified Netlify and Vercel deployment config to the Sherin-style framework/plugin defaults while keeping app-specific environment prompts.

### Fixed

- Removed the redundant `ws` override and updated doctor deployment checks to match the shared starter config approach.

## [0.3.5] - 2026-05-23

### Fixed

- Replaced Sentry URL trailing-slash regex normalization with a bounded string scan to avoid CodeQL ReDoS noise.

## [0.3.4] - 2026-05-23

### Changed

- Expanded Dependabot version updates to check npm dependencies daily and GitHub Actions weekly.

## [0.3.3] - 2026-05-23

### Added

- Added the Vercel Deploy workflow so Generative Media Starter exposes the same preview/production deployment check as Sherin when Vercel environment secrets are configured.
- Added doctor validation for the README Netlify and Vercel deploy buttons and Netlify template environment prompts.

## [0.3.2] - 2026-05-23

### Fixed

- Fixed CircleCI pnpm setup to install pnpm into a user-owned `$HOME/.local` prefix, avoiding `EACCES` failures from `cimg/node:24.11` when the image already has pnpm under `/usr/local/lib/node_modules`.
- Added narrow pnpm overrides for `ws@8.20.1` and `postcss@8.5.10` to clear Snyk transitive advisories inherited through Supabase, Next.js, and Sentry dependencies.

## [0.3.1] - 2026-05-22

### Added

- Added a CircleCI package-check workflow for Generative Media Starter package validation, production dependency audit, and trusted `main` Codecov CLI upload when `CODECOV_TOKEN` is configured in CircleCI.
- Added a Snyk Security workflow for Snyk Code SARIF upload, Open Source scanning and monitoring, high/critical dependency gating, and IaC reporting with `SNYK_TOKEN`.
- Added repository `codecov.yml` with GitHub Actions and CircleCI provider recognition, CI-gated Codecov status, and pull request comment configuration.

### Changed

- Constrained GitHub Actions Codecov uploads to the explicit Vitest LCOV report to avoid irrelevant uploader search warnings.
- Updated trusted Package Check Codecov uploads to pass `CODECOV_TOKEN` through the action environment and fail CI when coverage upload fails.

## [0.3.0] - 2026-05-22

### Changed

- Standardized contributing and code-of-conduct guidance with the shared BabySea OSS documentation standard.
- Moved Generative Media Starter repository metadata, docs links, deploy links, and source links from the `babysea-ai` organization to `babysea-community`.
- Upgraded Package Check, Sentry Check, and CodeQL workflow actions to Node 24-compatible majors, including `actions/checkout@v6`, `actions/setup-node@v6`, `pnpm/action-setup@v6`, `github/codeql-action@v4`, and `codecov/codecov-action@v6`.

### Fixed

- Declared `@next/eslint-plugin-next` as a direct standalone dev dependency and catalog entry so clean installs can resolve the flat ESLint config import during `pnpm lint`.
- Made the optional Sentry Project Check skip cleanly when Sentry CI secrets are absent and warn instead of failing hosted starter workflows when the configured token cannot read Sentry project or ownership endpoints.
- Replaced `gitleaks/gitleaks-action@v2` with a pinned, checksum-verified `gitleaks` CLI install and redacted full-history `gitleaks detect` run, avoiding the paid organization license requirement while keeping secret scanning enabled.

## [0.2.9] - 2026-05-22

### Added

- Added Sentry as optional `@sentry/nextjs` runtime initialization, browser/server instrumentation, no-DSN no-op behavior, source-map upload wrapper, Sentry config tests, and server-side generation error capture.
- Added Vitest coverage output and Package Check Codecov upload using `coverage/lcov.info`.
- Added Sherin-style package validation guardrails: lint, coverage, production dependency audit, and gitleaks secret scan.

## [0.2.8] - 2026-05-21

### Changed

- Update badge icon.

## [0.2.7] - 2026-05-20

### Changed

- Updated the BabySea SDK catalog dependency to `babysea@1.4.5`.

## [0.2.6] - 2026-05-20

### Added

- Added icon packs for button and hero, and provide link for buttons.

## [0.2.5] - 2026-05-20

- Updated icon and scripts deploy for auto topics and description.

## [0.2.4] - 2026-05-20

- Updated icon.

## [0.2.3] - 2026-05-19

### Changed

- Added a local `pnpm-workspace.yaml` catalog and switched package dependency specifiers to `catalog:` so standalone installs match the Sherin starter pattern.
- Updated Netlify and Vercel deployment configuration to use the starter's actual BabySea, Stripe, Supabase, and Upstash environment variables instead of Sherin-specific variables.
- Aligned deployment docs, doctor checks, and GitHub package validation with the local pnpm workspace install flow.

### Fixed

- Excluded generated Supabase types from Prettier formatting.
- Corrected the customization guide path for generation server-action validation.

## [0.2.2] - 2026-05-17

### Security

- Hardened `scripts/sentry-project-check.mjs` with normalized config parsing, HTTPS-only Sentry URL validation except localhost, bounded retry handling, strict Sentry API response-shape checks, stronger secret redaction, and stackless failure output. No runtime Sentry SDK, DSN, or telemetry is added.

### Changed

- Bumped the starter package from `0.2.1` to `0.2.2`.

## [0.2.1] - 2026-05-16

### Changed

- Updated the BabySea SDK dependency to `babysea@1.4.4`, including the SDK's hardened API error parsing for malformed or non-standard error envelopes.

## [0.2.0] - 2026-05-11

### Added

- Extended `pnpm run doctor` with two new checks: a static check that `next.config.ts` declares the baseline security headers and an `async headers()` block, and a live probe that fetches `NEXT_PUBLIC_SITE_URL` and verifies the deployed origin actually serves `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security`. The live probe warns (does not fail) when the site URL is localhost or the origin is unreachable so local doctor runs stay green.

### Security

- Added baseline browser security headers in `next.config.ts` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` opt-out for camera/microphone/geolocation/browsing-topics, `Strict-Transport-Security` with two-year max-age + preload, and `X-DNS-Prefetch-Control`) so Netlify/Vercel deployments ship with the same hardening defaults as Vercel OSS reference apps.
- Disabled Next.js `logging.fetches.fullUrl` in production builds so Stripe, Supabase, BabySea, and signed Supabase Storage URLs (which carry tokens in query strings) no longer leak into hosted server logs. Full URLs remain enabled in development for local debugging.
- Extended the `lib/env.ts` hosted-runtime guard beyond Vercel to also cover `NETLIFY` and `NODE_ENV === 'production'`, preventing `localhost` URLs from passing `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_SUPABASE_URL` validation on Netlify or any other hosted target.
- Pinned the Stripe SDK `apiVersion` to `2026-02-25.clover` in `lib/stripe.ts` so webhook payload shapes and Checkout responses stay deterministic across Stripe account API-version upgrades; documented the version-bump pairing rule in source.
- Hardened the login page banner: `/login?error=...` and `/login?message=...` now render copy from a fixed allowlist (`oauth_unavailable`, `oauth_failed`, `callback_invalid`, `signed_out`) instead of forwarding raw provider error strings, removing a low-severity phishing/UI-spoofing vector via crafted URLs.

## [0.1.0] - 2026-05-08

### Added

- Update favicon.
- `netlify.toml` and a Netlify "Deploy" one-click button in the README, alongside the existing Vercel button. Netlify uses the official `@netlify/plugin-nextjs` runtime, which supports the Supabase auth-refresh proxy (Node.js Middleware) on Netlify Functions without any source changes.
- Dedicated `docs/deploy-netlify.md` guide covering Netlify build settings, environment variables, domain updates, external service callbacks, production verification, runtime notes, and troubleshooting.
- Standalone `CodeQL` and `Package Check` GitHub Actions workflows for the public starter repository, plus README workflow badges.
- Sentry code-guard README badge and security-policy guidance for the public `babysea-community/generative-media-starter` repository; no Sentry SDK, DSN, tracing, error-reporting client, or runtime telemetry is bundled.
- Added `scripts/sentry-project-check.mjs`, a `sentry:check` package script, a README badge, ignored local `.sentryclirc` support, and a scheduled `Sentry Project Check` workflow. The workflow reads Sentry org/project configuration from GitHub Actions secrets, verifies the configured project slug, active status, `other` platform, ownership, and Code Guard rules, and does not add runtime tracking.
- Google-only Supabase OAuth login with a dedicated `/auth/callback` route for server-side code exchange.
- Inline Google OAuth icon in the login button.
- Next.js 16 (App Router) reference application with landing, login, and dashboard (Generate + Billing) routes.
- Supabase Google OAuth authentication with auth-refresh middleware.
- Four PostgreSQL migrations: starter schema (`credit_balances`, `credit_ledger`, `generations`, `stripe_customers`, `processed_stripe_events`), BabySea API key column, generation-output preservation, and `generated-media` bucket hardening.
- Atomic credit RPCs for grant, reserve, charge, and refund flows with RLS for user-owned reads.
- Idempotent Stripe webhook handler for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- One-time prepaid credit packs resolved by Stripe lookup key with optional `STRIPE_PRICE_*` overrides.
- BabySea TypeScript SDK integration: schema loading and cost estimation before reservation, generation behind a server-only `BABYSEA_API_KEY`.
- Private `generated-media` Supabase Storage bucket with signed URL delivery in generation history.
- Upstash Redis production rate limiting with local-dev fallback.
- Vercel deployment config (`vercel.json`) with standalone-clone install, build, and dev commands.
- Preflight `pnpm run doctor` validating env, BabySea schema, Stripe Prices, Supabase tables/storage, Upstash REST, and Vercel command alignment without printing secret values.
- Apache 2.0 license, NOTICE, SECURITY policy, CONTRIBUTING guide, CODE_OF_CONDUCT, and Dependabot configuration.
- Documentation: `docs/supabase.md`, `docs/stripe.md`, `docs/deploy-vercel.md`, `docs/customization.md`.

### Changed

- Reorder the badge.
- README status badge and status copy now describe the project as a working OSS starter rather than a reference-only starter.
- README anchors now keep the OSS Starters badge focused on the starter itself, and the broad OSS taxonomy / primitive cross-promotion block was replaced with starter-specific related resources.
- Deployment, Supabase, and agent-guide wording now describes OSS starters as working deployable apps and clarifies that publish validation runs before push rather than through mandatory GitHub status checks.
- OG social image URL switched from `public` folder to `https://cdn.babysea.live/assets/oss/generative-media-starter-card.png` for reliable social-crawler resolution.
- Landing page "Sign in" button now shows only a `LogIn` icon on mobile (`< sm`) and the full "Sign in" label on `sm+`, consistent with the dashboard sign-out button.
- OG social image now served from the `public` folder (`/generative-media-starter.png`) instead of a raw GitHub URL.
- Stats row ("Balance" and "Execution policy") is now a two-column grid on all screen sizes so both pills sit side by side on mobile.
- Sign-out button shows only a `LogOut` icon on mobile (`< sm`) and the full "Sign out" label on `sm+`.
- Nav links (Generate, Billing) highlight the active tab with a teal background and border so users can see which page they are on.
- Removed email/password, magic-link, and OTP auth paths from the starter surface. The local Supabase config disables email signup and docs now point to exact Google OAuth callback URLs.
- Disabled generation submission in the UI when the user has insufficient credits, preventing form submission before any generation server action runs.
- Disabled Stripe checkout buttons when Stripe secrets are missing, with a demo-safe banner above the credit-ledger message area.

### Security

- Hardened the OAuth callback `next` parameter to allow only same-origin dashboard paths and avoid open redirects.

### Notes

- Cloudflare Workers (`@opennextjs/cloudflare`) was evaluated and intentionally **not** added. The OpenNext Cloudflare adapter does not yet support Next.js Node.js Middleware, which the Supabase auth-refresh `proxy.ts` requires. A Cloudflare deploy target will be revisited once OpenNext supports Node.js Middleware or Supabase ships an edge-runtime SSR proxy helper.

### Validated

- `pnpm install --ignore-workspace` from a standalone clone.
- `pnpm run doctor`, `pnpm typecheck`, `pnpm format`, and `pnpm build` all green against the reference deployment.
- BabySea SDK: `bfl/flux-schnell` schema loaded with $0.005/output cost estimate.
- Stripe: three one-time USD Prices verified by lookup key and direct ID override.
- Supabase: migrations applied, service role reachable, private `generated-media` bucket present.
- Upstash: REST ping succeeded.
