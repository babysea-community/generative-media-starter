import 'server-only';

import Stripe from 'stripe';

import { requireEnv } from './env';

// Pin the Stripe API version so webhook payload shapes and Checkout responses
// stay deterministic across Stripe account upgrades. Bump this in lockstep with
// the `stripe` package version after re-reading the Stripe API changelog.
const STRIPE_API_VERSION = '2026-02-25.clover' as const;

export function createStripeClient() {
  return new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
}
