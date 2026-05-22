'use client';

import Link from 'next/link';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-rose-300/20 bg-white/[0.05] p-8 text-center shadow-2xl shadow-black/50 backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-200">
          Something went wrong
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          The starter hit an unexpected error.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          Try again, then check the deployment logs and run the setup doctor if
          the error continues.
        </p>
        {error.digest ? (
          <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
            Error digest: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-teal-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-200"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
          >
            Go home
          </Link>
        </div>
      </section>
    </main>
  );
}
