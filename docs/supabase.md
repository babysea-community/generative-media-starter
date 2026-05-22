# Supabase setup

Supabase provides auth, Postgres, row-level security, RPC functions, and private
storage for generated media.

## 1. Create a project

Create a Supabase project and copy these values into `.env.local` and your hosting provider:

| Supabase dashboard value | Env var                           | Scope          |
| ------------------------ | --------------------------------- | -------------- |
| Project URL              | `NEXT_PUBLIC_SUPABASE_URL`        | Browser/server |
| Publishable/anon key     | `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY` | Browser/server |
| Service role key         | `SUPABASE_SECRET_KEY`             | Server only    |

For CLI commands, also set the project ref locally:

```bash
export SUPABASE_PROJECT_REF=your-project-ref
```

## 2. Apply migrations

From the starter directory:

```bash
pnpm supabase:link
pnpm supabase:push
pnpm supabase:typegen
```

If this starter is inside a larger pnpm monorepo, run install commands from the
starter directory. Its local `pnpm-workspace.yaml` keeps catalog dependencies
and build-script approvals scoped to the starter so the local `pnpm supabase`
binary is available after install.

The migrations create:

- `credit_balances`
- `credit_ledger`
- `generations`
- `stripe_customers`
- `processed_stripe_events`
- RPC functions for granting, reserving, charging, and refunding credits
- RLS policies for user-owned reads
- A private `generated-media` storage bucket

## 3. Configure auth

Enable Google OAuth in Supabase Auth.

In Supabase, go to **Authentication ➜ Providers ➜ Google**, enable the provider,
and add your Google OAuth Client ID and Client Secret. In Google Cloud Console,
add the Supabase callback URL shown in the Google provider panel, usually:

```text
https://<your-project-ref>.supabase.co/auth/v1/callback
```

For local development:

| Setting       | Value                                 |
| ------------- | ------------------------------------- |
| Site URL      | `http://localhost:3011`               |
| Redirect URLs | `http://localhost:3011/auth/callback` |

For production:

| Setting       | Value                                        |
| ------------- | -------------------------------------------- |
| Site URL      | `https://your-app.example.com`               |
| Redirect URLs | `https://your-app.example.com/auth/callback` |

The redirect URL pattern is required for OAuth callbacks after Supabase completes
the provider exchange.

Google sign-in redirects through the starter's built-in OAuth callback route:

```text
https://your-app.example.com/auth/callback
```

Use the exact callback URL for the deployed app.

For the BabySea demo domain:

```text
https://demo.generative-media-starter.babysea.live/auth/callback
```

## 4. Service role safety

`SUPABASE_SECRET_KEY` is the service role key. Keep it server-only.

The starter uses the service role only in trusted server actions and webhooks
where RLS bypass is required for settlement operations. Never expose this key in
client components or browser code.

## 5. Verify Supabase

1. Run `pnpm run doctor` and confirm the Supabase check passes.
2. Create a user in the app.
3. Confirm the user can read their own balance and generations.
4. Complete Stripe Checkout.
5. Confirm `credit_balances` increases.
6. Generate media.
7. Confirm a private object appears in the `generated-media` bucket.

## Troubleshooting

| Symptom                          | Fix                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `supabase:link` cannot find ref  | Export `SUPABASE_PROJECT_REF` before running the script.                              |
| Auth redirects to localhost      | Update Auth Site URL and the deployed `NEXT_PUBLIC_SITE_URL`.                         |
| Credits do not update            | Verify Stripe webhook delivery and `STRIPE_WEBHOOK_SECRET`.                           |
| Assets do not display            | Confirm migrations created the private storage bucket.                                |
| Doctor reports unsafe MIME types | Apply the latest migrations or update the bucket to allow only PNG/JPEG/WebP/GIF/MP4. |
