'use client';

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({
  error,
  reset,
}: GlobalErrorPageProps) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
          <section className="w-full max-w-xl rounded-3xl border border-rose-300/20 bg-white/[0.05] p-8 text-center shadow-2xl shadow-black/50 backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-200">
              Application error
            </p>
            <h1 className="mt-4 text-3xl font-semibold">
              The app could not render.
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Try again, then inspect the deployment logs and setup doctor if
              the problem continues.
            </p>
            {error.digest ? (
              <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
                Error digest: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-full bg-teal-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-200"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
