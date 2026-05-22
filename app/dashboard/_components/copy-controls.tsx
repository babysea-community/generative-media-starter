'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type CopyPromptButtonProps = {
  prompt: string;
  iconOnly?: boolean;
  className?: string;
};

type CopyableGenerationIdProps = {
  generationId: string;
  className?: string;
  showLabel?: boolean;
  showCopied?: boolean;
  iconOnly?: boolean;
};

function useCopyFeedback() {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setIsCopied(true);

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = setTimeout(() => {
      setIsCopied(false);
    }, 1600);
  }

  return { copy, isCopied };
}

export function CopyPromptButton({
  prompt,
  iconOnly = false,
  className,
}: CopyPromptButtonProps) {
  const { copy, isCopied } = useCopyFeedback();
  const buttonClassName = [
    'inline-flex items-center rounded-full border border-white/10 text-xs text-slate-300 transition hover:border-teal-300/40 hover:bg-teal-300/10 hover:text-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200',
    iconOnly ? 'justify-center p-0' : 'gap-1.5 px-2.5 py-1',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      aria-label="Copy full generation prompt"
      onClick={() => void copy(prompt)}
      className={buttonClassName}
    >
      {isCopied ? (
        <Check className="h-3 w-3" strokeWidth={1.75} />
      ) : (
        <Copy className="h-3 w-3" strokeWidth={1.75} />
      )}
      {iconOnly ? null : (
        <span>{isCopied ? 'Copied prompt' : 'Copy prompt'}</span>
      )}
    </button>
  );
}

export function CopyableGenerationId({
  generationId,
  className,
  showLabel = true,
  showCopied = true,
  iconOnly = false,
}: CopyableGenerationIdProps) {
  const { copy, isCopied } = useCopyFeedback();

  return (
    <span
      className={[
        'inline-flex max-w-full flex-wrap items-center gap-1.5 text-xs text-slate-500',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showLabel ? <span>generation_id:</span> : null}
      <button
        type="button"
        aria-label={`Copy generation ID ${generationId}`}
        onClick={() => void copy(generationId)}
        className="inline-flex items-center gap-1 break-all font-mono text-left underline decoration-slate-500/70 decoration-dotted underline-offset-4 transition hover:text-teal-100 hover:decoration-teal-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200"
      >
        {generationId}
        {iconOnly ? (
          isCopied ? (
            <Check
              className="h-3 w-3 shrink-0 text-teal-300"
              strokeWidth={1.75}
            />
          ) : (
            <Copy className="h-3 w-3 shrink-0" strokeWidth={1.75} />
          )
        ) : null}
      </button>
      {!iconOnly && showCopied && isCopied ? (
        <span className="text-teal-200">copied</span>
      ) : null}
    </span>
  );
}
