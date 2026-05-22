'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getCreditPack } from '@/lib/app-config';
import { getOptionalEnv, getSiteUrl } from '@/lib/env';
import { createStripeClient } from '@/lib/stripe';
import { resolveStripePriceId } from '@/lib/stripe-prices';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getUser } from '@/lib/supabase/server';

export async function createCheckoutSession(formData: FormData) {
  const { user } = await getUser();

  if (!user) {
    redirect('/login');
  }

  const packId = z.string().min(1).parse(formData.get('packId'));
  const pack = getCreditPack(packId);

  if (!pack) {
    throw new Error('Unknown credit pack');
  }

  if (
    !getOptionalEnv('STRIPE_SECRET_KEY') ||
    !getOptionalEnv('STRIPE_WEBHOOK_SECRET')
  ) {
    redirect('/dashboard/billing?billing_unavailable=1');
  }

  const stripe = createStripeClient();
  const stripePriceId = await resolveStripePriceId(stripe, pack);
  const siteUrl = getSiteUrl();
  const admin = createSupabaseAdminClient();

  const { data: existingCustomer, error: customerLookupError } = await admin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (customerLookupError) {
    throw customerLookupError;
  }

  let customerId = existingCustomer?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        user_id: user.id,
      },
    });

    customerId = customer.id;

    const { error } = await admin.from('stripe_customers').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
    });

    if (error) {
      throw error;
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    client_reference_id: user.id,
    allow_promotion_codes: true,
    success_url: `${siteUrl}/dashboard/billing?success=1`,
    cancel_url: `${siteUrl}/dashboard/billing?canceled=1`,
    line_items: [
      {
        quantity: 1,
        price: stripePriceId,
      },
    ],
    metadata: {
      user_id: user.id,
      credits: String(pack.credits),
      pack_id: pack.id,
    },
    payment_intent_data: {
      metadata: {
        user_id: user.id,
        credits: String(pack.credits),
        pack_id: pack.id,
      },
    },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  redirect(session.url);
}
