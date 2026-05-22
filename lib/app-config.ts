export const BABYSEA_MODEL = 'bfl/flux-schnell';
export const GENERATION_COST_CREDITS = 0.005;
export const BABYSEA_API_BASE_URL = 'https://api.us.babysea.ai';
export const BABYSEA_PROVIDER_ORDER_DEFAULT = 'fastest';

export const CREDIT_PACKS = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 10,
    amountCents: 1000,
    stripeLookupKey: 'generative_media_starter_starter_usd_1000',
    stripePriceEnvKey: 'STRIPE_PRICE_STARTER',
    description: 'Adds $10 to your balance',
  },
  {
    id: 'builder',
    name: 'Builder Pack',
    credits: 25,
    amountCents: 2500,
    stripeLookupKey: 'generative_media_starter_builder_usd_2500',
    stripePriceEnvKey: 'STRIPE_PRICE_BUILDER',
    description: 'Adds $25 to your balance',
  },
  {
    id: 'production',
    name: 'Production Pack',
    credits: 50,
    amountCents: 5000,
    stripeLookupKey: 'generative_media_starter_production_usd_5000',
    stripePriceEnvKey: 'STRIPE_PRICE_PRODUCTION',
    description: 'Adds $50 to your balance',
  },
] as const;

export type CreditPack = (typeof CREDIT_PACKS)[number];
export type CreditPackId = (typeof CREDIT_PACKS)[number]['id'];

export function getCreditPack(packId: string) {
  return CREDIT_PACKS.find((pack) => pack.id === packId);
}
