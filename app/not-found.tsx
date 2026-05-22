import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center shadow-2xl shadow-black/50 backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-200">
          404
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          Page not found
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          The page does not exist in this starter.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-teal-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-200"
        >
          Go home
        </Link>
      </section>
    </main>
  );
}
