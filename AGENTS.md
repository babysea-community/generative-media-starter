# Generative Media Starter Agent Guide

Generative Media Starter is a standalone BabySea OSS starter for launching a credit-based generative media product with Google auth, Stripe prepaid credits, private Supabase Storage, Upstash rate limits, and BabySea SDK-backed generation.

## Scope

Use this guide for changes inside the Generative Media Starter, especially auth, Stripe billing, credit settlement, BabySea SDK generation, private storage, rate limits, deploy configuration, and starter documentation.

## Working Rules

- State assumptions before changing billing, credit settlement, auth, storage, rate limits, or deployment behavior.
- Keep changes surgical. Do not refactor the app boundary, database functions, or webhook flow unless the requested behavior requires it.
- Prefer the smallest implementation that preserves the credit ledger invariant.
- Update only docs, env examples, doctor checks, tests, or changelog entries that are directly affected by the change.
- Verify with the narrowest useful command first, then broaden when shared behavior is touched.

## Layout

| Path                              | Purpose                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `app/page.tsx`                    | Public landing page                                                                       |
| `app/login`                       | Supabase Google OAuth entry point                                                         |
| `app/auth/callback/route.ts`      | Supabase auth callback                                                                    |
| `app/dashboard`                   | Private dashboard, Generate, and Billing surfaces                                         |
| `app/api/stripe/webhook/route.ts` | Stripe webhook verifier and credit grant entry point                                      |
| `lib/app-config.ts`               | Model, default cost, BabySea base URL, and credit packs                                   |
| `lib/inference/babysea.ts`        | Server-only BabySea SDK execution helper                                                  |
| `lib/billing/stripe.ts`           | Stripe server client                                                                      |
| `lib/billing/prices.ts`           | Stripe lookup-key and price-id resolution                                                 |
| `lib/database/*`                  | Supabase server, proxy, and service-role clients                                          |
| `lib/storage/index.ts`            | Private `generated-media` bucket helpers and signed URL minting                           |
| `lib/security/rate-limit.ts`      | Upstash Redis rate-limit policy                                                           |
| `lib/utils/env.ts`                | Environment helpers                                                                       |
| `supabase/migrations`             | Starter schema, BabySea key column, output preservation, and bucket hardening             |
| `scripts/doctor.mjs`              | Preflight validator for env, BabySea, Stripe, Supabase, Upstash, and deploy-button config |
| `docs`                            | Supabase, Stripe, deployment, and customization guides                                    |

## Conventions

- Use the official `babysea` TypeScript SDK for model metadata, cost estimates, generation creation, and result polling. Do not add provider-specific request code.
- Keep `BABYSEA_API_KEY`, Stripe secrets, `SUPABASE_SECRET_KEY`, Upstash tokens, and Sentry auth tokens server-side.
- A generation cannot spend credits unless a reserve ledger event exists. Failed dispatch refunds the reservation.
- Stripe events deduplicate via `processed_stripe_events` before granting credits.
- Read BabySea SDK model metadata and cost estimates at runtime; do not hardcode client-side generation pricing.
- Generated assets live in the private `generated-media` Supabase bucket and are served through signed URLs.
- Upstash Redis is required for production generation rate limiting.
- RLS must protect user-owned tables; privileged writes should go through controlled server-side code or `SECURITY DEFINER` functions.
- `pnpm run doctor` must validate wiring without printing secrets.

## Verification

- `pnpm run doctor`
- `pnpm format`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:run`
- `pnpm build`
