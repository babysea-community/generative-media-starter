'use client';

import { useFormStatus } from 'react-dom';

type GenerateSubmitButtonProps = {
  disabled: boolean;
  disabledLabel?: string;
};

export function GenerateSubmitButton({
  disabled,
  disabledLabel,
}: GenerateSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  const stateClassName = disabled
    ? 'cursor-not-allowed bg-slate-600 text-slate-300'
    : pending
      ? 'cursor-wait bg-teal-200 text-slate-950 shadow-[0_0_28px_rgba(94,234,212,0.25)] ring-2 ring-teal-200/40'
      : 'cursor-pointer bg-teal-300 text-slate-950 hover:bg-teal-200';
  const buttonClassName = [
    'inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200',
    stateClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="mt-5 flex flex-wrap items-center gap-4">
      <button
        type="submit"
        disabled={isDisabled}
        aria-busy={pending}
        aria-describedby={pending ? 'generation-pending-status' : undefined}
        className={buttonClassName}
      >
        {pending ? (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950"
          />
        ) : null}
        {pending
          ? 'Generating media…'
          : disabled
            ? (disabledLabel ?? 'Generate media')
            : 'Generate media'}
      </button>

      {pending ? (
        <p
          id="generation-pending-status"
          role="status"
          aria-live="polite"
          className="text-xs leading-5 text-teal-100"
        >
          BabySea is generating now. Keep this tab open; the finished image will
          appear in recent generations below.
        </p>
      ) : null}
    </div>
  );
}
