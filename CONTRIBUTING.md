# Contributing

Thanks for improving Generative Media Starter.

Generative Media Starter is a deployable SaaS starter for BabySea-powered image and video generation. Good contributions keep the first-run path clear for builders, keep paid-generation and storage behavior auditable, and keep all provider, billing, and platform secrets out of public surfaces.

## Development flow

1. Install dependencies:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

3. Configure Supabase, Stripe, BabySea, and optional Upstash using the README and docs.

4. Validate live service wiring:

   ```bash
   pnpm run doctor
   ```

5. Run the starter:

   ```bash
   pnpm dev
   ```

## Before opening a pull request

Run these checks:

```bash
pnpm format
pnpm lint
pnpm run doctor
pnpm typecheck
pnpm test:coverage
pnpm build
```

When changing billing, storage, or webhook behavior, validate against disposable test-mode projects and do not use live customer data.

## Contribution guidelines

- Keep the starter public-repo friendly: no secrets, private service ids, local-only assumptions, customer prompts, generated media, or signed storage URLs.
- Keep BabySea access server-side through `BABYSEA_API_KEY` unless a documented browser read-only flow explicitly uses scoped credentials.
- Keep pricing and schema validation SDK-driven instead of duplicating model contracts in one-off UI branches.
- Use persistent Stripe Prices with lookup keys, not inline Checkout prices.
- Keep generated media private in Supabase Storage and expose it with signed URLs.
- Keep Sentry optional and no-op without configured DSNs or auth tokens.
- Update README, `.env.example`, tests, and the doctor script when changing required configuration.
- Prefer focused changes. Avoid unrelated refactors in starter docs, billing code, storage code, or deployment wiring.

## Documentation standard

Generative Media Starter docs are part of the release contract. Keep them factual, operator-ready, and tied to behavior that exists in the repository.

- Start from the README contract: what the starter is, what it is not, how to deploy it, how to validate it, and how to recover it.
- Use exact environment variable names, commands, route paths, provider names, Stripe object names, and file paths.
- Document validation steps beside operational claims. If a feature says it is production-ready, include the check or workflow that proves it.
- Keep security guidance concrete: where secrets live, which values are browser-visible, how to rotate keys, and what should never be posted publicly.
- Update `CHANGELOG.md` for user-visible docs, configuration, security, or operations changes.
- Avoid roadmap language in the public contract. New features stay out of README claims until implemented, documented, and validated.

When a change touches these areas, update the matching docs before opening a PR:

| Change area                         | Required docs to review                                      |
| :---------------------------------- | :----------------------------------------------------------- |
| Required or optional env values     | README, `.env.example`, `scripts/doctor.mjs` messaging       |
| Auth, callbacks, or account access  | README quick start, README production readiness, SECURITY.md |
| BabySea generation or model schemas | README generation flow, README customization notes, tests    |
| Stripe checkout or credits          | README billing sections, SECURITY.md, webhook docs           |
| Storage or media visibility         | README storage sections, SECURITY.md                         |
| Monitoring or CI checks             | README production readiness, SECURITY.md, this guide         |

## Issue triage

- `bug` - reproducible defect, with logs, a failing test, or a minimal reproduction.
- `proposal` - scoped design idea with the user problem, implementation sketch, and validation path.
- `good first issue` - small, well-scoped change that can be validated without production credentials.

## Conduct

See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Be respectful, assume good faith, and keep discussion focused on the work and the people using it.

## Security-sensitive changes

Open security fixes privately through the process in [SECURITY.md](SECURITY.md). Do not include real Stripe keys, BabySea keys, Supabase secrets, Sentry auth tokens, customer data, prompts, generated media, signed URLs, deployment details, or unreleased vulnerability details in public issues, pull requests, test fixtures, logs, or screenshots.
