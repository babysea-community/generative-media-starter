import type { Metadata } from 'next';

import { CREDIT_PACKS } from '@/lib/app-config';

export const metadata: Metadata = {
  title: 'Billing',
  description: 'Purchase credits and view your usage history.',
  robots: { index: false, follow: false },
};
import { getOptionalEnv } from '@/lib/env';
import { getUser } from '@/lib/supabase/server';
import { formatCredits, formatDate } from '@/lib/utils';

import { CopyableGenerationId } from '../_components/copy-controls';
import { createCheckoutSession } from './_lib/server-actions';
import { CopyableLedgerDescription } from './_components/copyable-ledger-description';
import { DismissibleBanner } from '../_components/dismissible-banner';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type LedgerAmountInput = {
  type: string;
  amount: number;
};

type LedgerGenerationInput = {
  type: string;
  generation_id: string | null;
};

const LEDGER_TYPES_WITH_VISIBLE_GENERATION_ID = new Set(['reserve', 'charge']);

function getLedgerAmountLabel(
  entry: LedgerAmountInput,
  generationCostCredits: number | null,
) {
  if (entry.type === 'charge') {
    return generationCostCredits
      ? `settled ${formatCredits(generationCostCredits)}`
      : 'settled';
  }

  return formatCredits(entry.amount);
}

function shouldShowLedgerGenerationId(
  entry: LedgerGenerationInput,
): entry is LedgerGenerationInput & { generation_id: string } {
  return Boolean(
    entry.generation_id &&
    LEDGER_TYPES_WITH_VISIBLE_GENERATION_ID.has(entry.type),
  );
}

function getLedgerRowClass(type: string) {
  const baseClassName =
    'flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between';

  if (type === 'reserve') {
    return `${baseClassName} border-blue-300/20 bg-blue-300/[0.06]`;
  }

  if (type === 'charge') {
    return `${baseClassName} border-purple-300/20 bg-purple-300/[0.06]`;
  }

  return `${baseClassName} border-white/10 bg-slate-950/60`;
}

export default async function BillingPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const { supabase, user } = await getUser();
  const stripeReady = Boolean(
    getOptionalEnv('STRIPE_SECRET_KEY') &&
    getOptionalEnv('STRIPE_WEBHOOK_SECRET'),
  );

  const { data: ledger } = await supabase
    .from('credit_ledger')
    .select('id,type,amount,description,generation_id,created_at')
    .eq('user_id', user?.id ?? '')
    .order('created_at', { ascending: false });
  const ledgerEntries = ledger ?? [];
  const ledgerGenerationIds = Array.from(
    new Set(
      ledgerEntries
        .map((entry) => entry.generation_id)
        .filter((generationId): generationId is string =>
          Boolean(generationId),
        ),
    ),
  );
  const { data: ledgerGenerations } = ledgerGenerationIds.length
    ? await supabase
        .from('generations')
        .select('id,cost_credits')
        .eq('user_id', user?.id ?? '')
        .in('id', ledgerGenerationIds)
    : { data: [] };
  const generationCostById = new Map(
    (ledgerGenerations ?? []).map((generation) => [
      generation.id,
      generation.cost_credits,
    ]),
  );

  return (
    <main className="w-full space-y-6">
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-teal-200">
            Billing
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Credit settlement, not just checkout.
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Stripe Checkout sells app credits, Stripe webhooks grant them
            idempotently, and Supabase keeps the balance and ledger ready for
            atomic generation settlement.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <form
              key={pack.id}
              action={createCheckoutSession}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
            >
              <input type="hidden" name="packId" value={pack.id} />
              <p className="text-sm text-slate-400">{pack.name}</p>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-white">
                  {formatCredits(pack.credits)}
                </span>
                <span className="text-sm text-slate-400">credits</span>
              </p>
              <p className="mt-4 text-sm text-slate-300">{pack.description}</p>
              <button
                type="submit"
                disabled={!stripeReady}
                className="mt-6 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-500 enabled:cursor-pointer enabled:bg-teal-300 enabled:text-slate-950 enabled:hover:bg-teal-200"
              >
                {stripeReady
                  ? `Buy $${(pack.amountCents / 100).toFixed(0)} credits`
                  : 'Add Stripe keys to buy'}
              </button>
            </form>
          ))}
        </div>
      </section>

      {!stripeReady ? (
        <DismissibleBanner tone="warning">
          Add your Stripe keys to enable credit purchases in this demo.
        </DismissibleBanner>
      ) : null}

      {params.billing_unavailable ? (
        <DismissibleBanner tone="warning">
          Checkout is disabled until Stripe keys are configured for this demo.
        </DismissibleBanner>
      ) : null}

      {params.success ? (
        <DismissibleBanner tone="success">
          Checkout completed. Credits will be granted after the Stripe webhook
          is verified.
        </DismissibleBanner>
      ) : null}

      {params.canceled ? (
        <DismissibleBanner tone="neutral">
          Checkout canceled. No credits were granted.
        </DismissibleBanner>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
        <h2 className="text-xl font-semibold text-white">
          Recent credit ledger
        </h2>
        <div className="mt-5 space-y-3">
          {ledgerEntries.length > 0 ? (
            ledgerEntries.map((entry) => (
              <div key={entry.id} className={getLedgerRowClass(entry.type)}>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-medium text-white">{entry.type}</p>
                  <span className="text-xs text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <p className="min-w-0 text-sm text-slate-400">
                    <CopyableLedgerDescription
                      description={entry.description ?? null}
                    />
                  </p>
                  {shouldShowLedgerGenerationId(entry) ? (
                    <>
                      <span
                        className="text-xs text-slate-600"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <CopyableGenerationId
                        generationId={entry.generation_id}
                      />
                    </>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-left sm:justify-end sm:text-right">
                  <p className="text-sm font-semibold text-teal-100">
                    {getLedgerAmountLabel(
                      entry,
                      entry.generation_id
                        ? (generationCostById.get(entry.generation_id) ?? null)
                        : null,
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(entry.created_at)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">
              No ledger entries yet. Buy a credit pack to create the first
              `grant` event.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
