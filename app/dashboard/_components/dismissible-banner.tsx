'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

type DismissibleBannerProps = {
  children: React.ReactNode;
  tone: 'success' | 'warning' | 'error' | 'neutral';
};

const toneClassNames = {
  success: 'border-teal-300/30 bg-teal-300/10 text-teal-100',
  warning: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  error: 'border-rose-300/30 bg-rose-300/10 text-rose-100',
  neutral: 'border-slate-300/20 bg-white/[0.04] text-slate-200',
} as const;

export function DismissibleBanner({ children, tone }: DismissibleBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-2xl border p-4 text-sm ${toneClassNames[tone]}`}
    >
      <div className="leading-6">{children}</div>
      <button
        type="button"
        aria-label="Dismiss message"
        onClick={() => setIsVisible(false)}
        className="rounded-full p-1 text-current/70 transition hover:bg-white/10 hover:text-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        <X className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
