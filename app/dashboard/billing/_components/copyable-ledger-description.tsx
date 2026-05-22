'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

type CopyableLedgerDescriptionProps = {
  description: string | null;
};

const STRIPE_ID_PATTERN =
  /\b(?:cs_(?:test|live)_[A-Za-z0-9]+|evt_[A-Za-z0-9]+)\b/g;

export function CopyableLedgerDescription({
  description,
}: CopyableLedgerDescriptionProps) {
  const [isCopied, setIsCopied] = useState(false);

  if (!description) {
    return <span>Ledger entry</span>;
  }

  const stripeIds = description.match(STRIPE_ID_PATTERN) ?? [];

  if (stripeIds.length === 0) {
    return <span>{description}</span>;
  }

  const firstStripeId = stripeIds[0];

  if (!firstStripeId) {
    return <span>{description}</span>;
  }

  const copyValue =
    stripeIds.length >= 2 && stripeIds[1]
      ? `${firstStripeId} (${stripeIds[1]})`
      : firstStripeId;
  const visibleDescription = description
    .replace(STRIPE_ID_PATTERN, '')
    .replace(/\s+\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
      <span>{visibleDescription || 'Stripe Checkout'}</span>
      <button
        type="button"
        aria-label="Copy redacted Stripe Checkout IDs"
        onClick={async () => {
          await navigator.clipboard.writeText(copyValue);
          setIsCopied(true);
        }}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-300 transition hover:border-teal-300/40 hover:bg-teal-300/10 hover:text-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200"
      >
        {isCopied ? (
          <Check className="h-3 w-3" strokeWidth={1.75} />
        ) : (
          <Copy className="h-3 w-3" strokeWidth={1.75} />
        )}
        <span>{isCopied ? 'copied' : 'redacted'}</span>
      </button>
    </span>
  );
}
