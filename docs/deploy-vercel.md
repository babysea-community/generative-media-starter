# Deploy to Vercel

This guide starts from a fresh public repo or a fork and ends with a production
URL that works with Supabase Auth, Stripe Checkout, and BabySea generation.

## 1. Create the Vercel project

Use the button in the main README, or create a project manually in Vercel.

| Vercel setting      | Value                            |
| ------------------- | -------------------------------- |
| Framework Preset    | Next.js                          |
| Root Directory      | Empty for a standalone repo      |
| Install Command     | `pnpm install --frozen-lockfile` |
| Build Command       | `pnpm build`                     |
| Development Command | `pnpm dev`                       |

If you vendor this starter inside a monorepo, set Root Directory to the folder
that contains this README. The checked-in `pnpm-workspace.yaml` keeps catalog
dependencies local to the starter.

## 2. Add environment variables

Add every runtime variable from `.env.example` to Vercel.

Required for production:

- `NEXT_PUBLIC_SITE_URL`
- `BABYSEA_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY`
- `SUPABASE_SECRET_KEY`

Optional direct Stripe Price ID overrides:

- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_BUILDER`
- `STRIPE_PRICE_PRODUCTION`

Required for production generation:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Do not add `SUPABASE_PROJECT_REF` unless you need it for a CLI workflow. It is
not used at runtime.

Before deploying, run this locally with the same service credentials:

```bash
pnpm run doctor
```

Every check should pass before you ship a public demo.

## 3. Attach a domain

Set the app URL to the final domain:

```bash
NEXT_PUBLIC_SITE_URL=https://your-app.example.com
```

For the BabySea demo, the value is:

```bash
NEXT_PUBLIC_SITE_URL=https://demo.generative-media-starter.babysea.live
```

After changing `NEXT_PUBLIC_SITE_URL`, redeploy the app. Stripe Checkout uses
this value for success and cancel URLs.

## 4. Update external services after the domain changes

When the final Vercel domain or custom domain is known, update these places:

1. Vercel `NEXT_PUBLIC_SITE_URL`
2. Supabase Auth Site URL
3. Supabase redirect URL pattern if using link-based auth
4. Stripe webhook endpoint

Production Stripe webhook endpoint:

```text
https://your-app.example.com/api/stripe/webhook
```

Supabase redirect URL pattern for link-based auth:

```text
https://your-app.example.com/auth/callback
```

## 5. Verify production

After deployment:

1. Open the deployed app.
2. Create a user.
3. Buy a Stripe test credit pack.
4. Confirm credits appear in the dashboard.
5. Submit a generation.
6. Confirm the generated asset displays from Supabase Storage.

## Production runtime notes

- The generation route waits for BabySea completion and exports a 180 second
  maximum duration. Use a Vercel plan/runtime configuration that supports this
  duration, or shorten the wait and move settlement into a background worker.
- Keep Stripe test-mode and live-mode products, prices, keys, and webhook
  secrets separate. Re-run `pnpm run doctor` when switching modes.
- Upstash Redis is required for production generation rate limiting.
- Do not deploy with localhost URLs in Vercel environment variables; hosted
  deployments reject localhost app and Supabase URLs.

## Troubleshooting

| Symptom                                | Check                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Checkout returns to the wrong URL      | `NEXT_PUBLIC_SITE_URL` in Vercel, then redeploy.                                                |
| Stripe webhook is not granting credits | Webhook URL, event type, signing secret, and Vercel logs.                                       |
| Supabase links redirect incorrectly    | Auth Site URL and redirect URL allow-list.                                                      |
| Generation button is disabled          | `BABYSEA_API_KEY` exists and starts with `bye_`.                                                |
| Preflight fails for storage MIME types | Apply migrations, then verify the `generated-media` bucket only allows PNG/JPEG/WebP/GIF/MP4.   |
| Build cannot resolve `catalog:` deps   | Confirm Vercel Root Directory points at the starter folder that contains `pnpm-workspace.yaml`. |
