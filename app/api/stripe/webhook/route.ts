import { Buffer } from 'node:buffer';

import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { getCreditPack } from '@/lib/app-config';
import { requireEnv } from '@/lib/env';
import { createStripeClient } from '@/lib/stripe';
import { resolveStripePriceId } from '@/lib/stripe-prices';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_WEBHOOK_PAYLOAD_BYTES = 1024 * 1024;

const CheckoutMetadataSchema = z.object({
  user_id: z.string().uuid(),
  pack_id: z.string().min(1).max(64),
  credits: z.coerce.number().int().positive().max(10_000),
});

export async function POST(request: NextRequest) {
  const stripe = createStripeClient();
  const contentLength = Number(request.headers.get('content-length') ?? 0);

  if (contentLength > MAX_WEBHOOK_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: 'Stripe webhook payload is too large' },
      { status: 413 },
    );
  }

  const payload = await request.text();

  if (Buffer.byteLength(payload, 'utf8') > MAX_WEBHOOK_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: 'Stripe webhook payload is too large' },
      { status: 413 },
    );
  }

  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing Stripe signature' },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      requireEnv('STRIPE_WEBHOOK_SECRET'),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid signature';

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: alreadyProcessed, error: processedLookupError } = await admin
    .from('processed_stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();

  if (processedLookupError) {
    throw processedLookupError;
  }

  if (alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== 'paid') {
      await markStripeEventProcessed(admin, event);

      return NextResponse.json({ received: true, unpaid: true });
    }

    if (session.mode !== 'payment') {
      return NextResponse.json(
        { error: 'Checkout session must be a one-time payment' },
        { status: 400 },
      );
    }

    const parsedMetadata = CheckoutMetadataSchema.safeParse(
      session.metadata ?? {},
    );

    if (!parsedMetadata.success) {
      return NextResponse.json(
        { error: 'Checkout session missing credit metadata' },
        { status: 400 },
      );
    }

    const { user_id: userId, pack_id: packId, credits } = parsedMetadata.data;
    const pack = getCreditPack(packId);

    if (!pack || pack.credits !== credits) {
      return NextResponse.json(
        { error: 'Checkout session credit metadata does not match a pack' },
        { status: 400 },
      );
    }

    try {
      await assertCheckoutSessionMatchesPack(stripe, session, pack, userId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid Checkout session';

      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (typeof session.customer === 'string') {
      const { error } = await admin.from('stripe_customers').upsert({
        user_id: userId,
        stripe_customer_id: session.customer,
      });

      if (error) {
        throw error;
      }
    }

    const { error } = await admin.rpc('grant_paid_credits', {
      p_user_id: userId,
      p_amount: credits,
      // Both checkout.session.completed and checkout.session.async_payment_succeeded
      // can describe the same paid Checkout Session. Key the credit grant to the
      // Checkout Session, while processed_stripe_events remains keyed to event.id.
      p_stripe_event_id: session.id,
      p_description: `Stripe Checkout ${session.id} (${event.id})`,
    });

    if (error) {
      throw error;
    }
  }

  await markStripeEventProcessed(admin, event);

  return NextResponse.json({ received: true });
}

async function markStripeEventProcessed(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  event: Stripe.Event,
) {
  const { error } = await admin.from('processed_stripe_events').upsert({
    id: event.id,
    type: event.type,
  });

  if (error) {
    throw error;
  }
}

async function assertCheckoutSessionMatchesPack(
  stripe: ReturnType<typeof createStripeClient>,
  session: Stripe.Checkout.Session,
  pack: NonNullable<ReturnType<typeof getCreditPack>>,
  userId: string,
) {
  if (session.client_reference_id !== userId) {
    throw new Error('Checkout session user reference mismatch');
  }

  const expectedPriceId = await resolveStripePriceId(stripe, pack);
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 2,
  });

  if (lineItems.data.length !== 1 || lineItems.has_more) {
    throw new Error('Checkout session must contain exactly one line item');
  }

  const lineItem = lineItems.data[0];

  if (!lineItem) {
    throw new Error('Checkout session is missing a line item');
  }

  if (lineItem.quantity !== 1) {
    throw new Error('Checkout session line item quantity must be one');
  }

  const price = lineItem.price;

  if (!price) {
    throw new Error('Checkout session line item is missing a Price');
  }

  if (price.id !== expectedPriceId) {
    throw new Error('Checkout session Price does not match the credit pack');
  }

  if (price.currency.toLowerCase() !== 'usd') {
    throw new Error('Checkout session Price must use USD');
  }

  if (price.unit_amount !== pack.amountCents) {
    throw new Error('Checkout session Price amount does not match the pack');
  }
}
