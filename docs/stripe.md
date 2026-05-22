# Stripe setup

Stripe powers prepaid credit packs. The app uses persistent Products and Prices,
resolved by lookup key or optional direct Price ID overrides, so every checkout
session points at stable billing objects.

## 1. Create products and prices

Create one active one-time Price for each pack.

| Pack            | Credits | Amount | Lookup key                                     |
| --------------- | ------: | -----: | ---------------------------------------------- |
| Starter Pack    |     $10 |    $10 | `generative_media_starter_starter_usd_1000`    |
| Builder Pack    |     $25 |    $25 | `generative_media_starter_builder_usd_2500`    |
| Production Pack |     $50 |    $50 | `generative_media_starter_production_usd_5000` |

Credit values are dollar-denominated: $10 = $10 credits. The default generation
price is $0.005/output.

You can create them in the Stripe Dashboard or with the Stripe CLI.

Example CLI flow:

```bash
stripe products create --name "Starter Pack" --description 'Adds $10 to your balance'
stripe prices create --currency usd --unit-amount 1000 --lookup-key generative_media_starter_starter_usd_1000 --product prod_...
```

Repeat for the Builder and Production packs.

## 2. Optional direct Price ID overrides

Lookup keys are the default because they are portable across environments. For a
locked-down deployment, set direct Price IDs instead:

```bash
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_BUILDER=price_...
STRIPE_PRICE_PRODUCTION=price_...
```

The app still verifies each Price before Checkout:

- active
- one-time, not recurring
- USD
- exact amount for the configured credit pack

If an override is missing, that pack falls back to lookup-key resolution.

## 3. Configure app secrets

Set these locally and in your hosting provider:

```bash
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Use test keys for development and live keys for production.

## 4. Configure webhooks

Production endpoint:

```text
https://your-app.example.com/api/stripe/webhook
```

Events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Local development:

```bash
stripe listen --forward-to http://localhost:3011/api/stripe/webhook
```

Copy the local signing secret into `.env.local`.

## 5. How credits are granted

1. User creates a Checkout Session from the Billing page.
2. Stripe redirects the user to Checkout.
3. Stripe sends a Checkout completion event to the webhook.
4. The webhook validates the signature.
5. Supabase grants credits once and records the processed Stripe event.

The webhook is idempotent: repeated Stripe deliveries do not double-grant
credits.

## 6. Test cards

Use Stripe test mode and the standard successful card:

```text
4242 4242 4242 4242
```

Use any future expiry date, any CVC, and any postal code.

## 7. Verify Stripe

Run:

```bash
pnpm run doctor
```

The Stripe check confirms every credit pack resolves to a valid Price before you
test Checkout.

## Troubleshooting

| Symptom                              | Fix                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Checkout cannot find a price         | Confirm every lookup key has one active Price in the same mode.                    |
| Direct Price override fails          | Confirm the `STRIPE_PRICE_*` ID is active, one-time, USD, and the expected amount. |
| Credits do not appear after Checkout | Check webhook delivery, signing secret, and hosted function logs.                  |
| Webhook signature verification fails | Use the exact `whsec_...` for that endpoint/environment.                           |
| Checkout redirects to an old domain  | Update `NEXT_PUBLIC_SITE_URL` and redeploy.                                        |
