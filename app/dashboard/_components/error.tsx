'use client';

type DashboardErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardErrorPage({
  error,
  reset,
}: DashboardErrorPageProps) {
  return (
    <main className="rounded-3xl border border-rose-300/20 bg-rose-300/10 p-6 backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-rose-100">
        Dashboard error
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-white">
        Could not load this dashboard view.
      </h1>
      <p className="mt-3 text-sm leading-6 text-rose-50/80">
        Retry the request. If it still fails, run the setup doctor and inspect
        BabySea, Stripe, Supabase, and Upstash configuration.
      </p>
      {error.digest ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-xs text-rose-50/70">
          Error digest: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-rose-50"
      >
        Retry
      </button>
    </main>
  );
}
