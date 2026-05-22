import 'server-only';

import type Stripe from 'stripe';

import type { CreditPack } from '@/lib/app-config';
import { getOptionalEnv } from '@/lib/env';
import { createStripeClient } from '@/lib/stripe';

export async function resolveStripePriceId(
  stripe: ReturnType<typeof createStripeClient>,
  pack: CreditPack,
) {
  const configuredPriceId = getOptionalEnv(pack.stripePriceEnvKey);

  if (configuredPriceId) {
    if (!configuredPriceId.startsWith('price_')) {
      throw new Error(`${pack.stripePriceEnvKey} must be a Stripe Price ID`);
    }

    const price = await stripe.prices.retrieve(configuredPriceId);
    assertPriceMatchesPack(price, pack);

    return price.id;
  }

  const prices = await stripe.prices.list({
    active: true,
    limit: 10,
    lookup_keys: [pack.stripeLookupKey],
  });
  const price = prices.data.find(
    (candidate) => candidate.lookup_key === pack.stripeLookupKey,
  );

  if (!price) {
    throw new Error(`Missing Stripe price for credit pack: ${pack.id}`);
  }

  assertPriceMatchesPack(price, pack);

  return price.id;
}

function assertPriceMatchesPack(price: Stripe.Price, pack: CreditPack) {
  if (!price.active) {
    throw new Error(`Stripe price for ${pack.id} must be active`);
  }

  if (price.currency.toLowerCase() !== 'usd') {
    throw new Error(`Stripe price for ${pack.id} must use USD`);
  }

  if (price.unit_amount !== pack.amountCents) {
    throw new Error(
      `Stripe price for ${pack.id} must be ${pack.amountCents} cents`,
    );
  }

  if (price.recurring) {
    throw new Error(`Stripe price for ${pack.id} must be one-time`);
  }
}
