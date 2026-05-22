# generative-media-starter

`generative-media-starter` is a working deployable application for launching a credit-based generative media product on top of BabySea.
See [README.md](README.md) for the full story.

This file mirrors the README so deploys, IDEs, and tooling that read `AGENTS.md` see the same context.

## Layout

| Path                                    | Purpose                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `app/`                                  | Next.js App Router pages: landing, login, dashboard (Generate + Billing), Stripe webhook route   |
| `lib/app-config.ts`                     | Single source of truth for the model, default size, and credit packs                             |
| `lib/babysea.ts`                        | Server-only BabySea SDK client (schema load, cost estimate, generation)                          |
| `lib/stripe.ts`, `lib/stripe-prices.ts` | Stripe client and lookup-key/price-id resolution                                                 |
| `lib/supabase/`                         | Supabase server, browser, and service-role clients                                               |
| `lib/storage.ts`                        | Private `generated-media` bucket helpers and signed URL minting                                  |
| `lib/rate-limit.ts`                     | Upstash Redis rate-limit policy (production-required)                                            |
| `lib/env.ts`                            | Zod-validated environment variable contract                                                      |
| `supabase/migrations/`                  | PostgreSQL migrations: starter schema, BabySea key column, output preservation, bucket hardening |
| `scripts/doctor.mjs`                    | Preflight validator for env, BabySea, Stripe, Supabase, Upstash, and Vercel/Netlify config       |
| `docs/`                                 | Supabase, Stripe, deploy-vercel, deploy-netlify, and customization guides                        |
| `proxy.ts`                              | Next.js middleware (Supabase auth refresh)                                                       |

## Conventions

- **Apache 2.0** license. Apply the header in every source file.
- **One model, one execution surface.** Default to `bfl/flux-schnell` through the official `babysea` TypeScript SDK. Do not bypass the SDK with provider-specific request code.
- **Server-only secrets.** `BABYSEA_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY`, and Upstash tokens never appear in browser bundles. Browser code only sees publishable keys.
- **Settlement invariant.** A generation cannot spend credits unless a reserve ledger event exists. Failed dispatch refunds the reservation. All grants/reserves/charges/refunds go through atomic Postgres RPCs.
- **Idempotent webhooks.** Stripe events deduplicate via `processed_stripe_events` before granting credits.
- **Schema-driven pricing.** Read BabySea SDK model metadata and cost estimates at runtime; never hardcode prices in the client.
- **Private storage.** Generated assets live in the private `generated-media` Supabase bucket and are served via signed URLs.
- **Production rate limiting.** Upstash Redis is required in production; missing tokens fail fast before accepting generations.
- **TypeScript:** strict mode, no `any`.
- **SQL:** RLS enabled on every user-owned table, privileged writes only through `SECURITY DEFINER` functions.
- **Doctor never prints secrets.** `pnpm run doctor` validates wiring without leaking values.
