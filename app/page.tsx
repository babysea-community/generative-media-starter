import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CircleCheckBig, LogIn } from 'lucide-react';

import { GENERATION_COST_CREDITS } from '@/lib/app-config';
import {
  getBabySeaModelConfig,
  isBabySeaConfigured,
} from '@/lib/inference/babysea';
import { getUser } from '@/lib/database/server';
import { formatCredits } from '@/lib/utils';

export default async function HomePage() {
  const { user } = await getUser();

  if (user) {
    redirect('/dashboard/generate');
  }

  const generationCostCredits = isBabySeaConfigured()
    ? await getBabySeaModelConfig()
        .then((modelConfig) => modelConfig.costCredits)
        .catch(() => GENERATION_COST_CREDITS)
    : GENERATION_COST_CREDITS;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <nav className="flex items-center justify-between">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-200">
          Generative Media Starter
        </div>
        <Link
          href="/login"
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-teal-300/60 hover:bg-white/10"
          aria-label="Sign in"
        >
          <LogIn className="size-4 sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">Sign in</span>
        </Link>
      </nav>

      <section className="grid flex-1 items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-6 inline-flex rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-sm text-teal-100">
            BabySea + Stripe + Supabase + Upstash + Vercel
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Generative media billing beyond checkout.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            A deployable starter where users sign in, buy prepaid credits with
            Stripe, generate images through the BabySea SDK, and settle app
            credits through a Supabase ledger. Upstash handles idempotency and
            rate limits, while the BabySea API key stays server-side.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-teal-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-950/50 transition hover:bg-teal-200"
            >
              Launch dashboard
            </Link>
            <a
              href="https://github.com/babysea-community/generative-media-starter"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
            >
              View source
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5">
            <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
              <span>Credit lifecycle</span>
              <span>{formatCredits(generationCostCredits)}/output</span>
            </div>
            <div className="space-y-3 text-sm">
              {[
                'Auth creates the user boundary',
                'Stripe Checkout grants credits once',
                'Upstash rate-limits generation requests',
                'Supabase reserves credits atomically',
                'BabySea executes the generation workload',
                'Private storage keeps generated assets scoped',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-slate-200"
                >
                  <CircleCheckBig
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-teal-200"
                    strokeWidth={1.75}
                  />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
