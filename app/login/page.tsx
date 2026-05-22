import type { Metadata } from 'next';

import { InlineGoogle } from '@/styles/inline-oauth';

import { signInWithGoogle } from './_lib/server-actions';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Generative Media Starter account.',
  robots: { index: false, follow: false },
};

// Login banners are rendered from query-string codes only. Mapping to fixed
// copy here prevents an attacker from crafting phishing text via a malicious
// `/login?error=<copy>` URL and ensures every banner ships translated content.
const LOGIN_ERROR_COPY: Record<string, string> = {
  oauth_unavailable: 'Google sign-in is not configured. Contact the operator.',
  oauth_failed: 'Google sign-in could not start. Try again.',
  callback_invalid:
    'Google sign-in callback is invalid or expired. Try signing in again.',
};

const LOGIN_MESSAGE_COPY: Record<string, string> = {
  signed_out: 'You have been signed out.',
};

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorCopy = params?.error ? LOGIN_ERROR_COPY[params.error] : undefined;
  const messageCopy = params?.message
    ? LOGIN_MESSAGE_COPY[params.message]
    : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.05] p-8 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-200">
            Generative Media Starter
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Sign in with Google
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Use Google OAuth through Supabase. Add your deployed
            `/auth/callback` URL in Supabase Auth settings.
          </p>
        </div>

        {messageCopy ? (
          <div className="mb-4 rounded-2xl border border-teal-300/30 bg-teal-300/10 px-4 py-3 text-sm text-teal-50">
            {messageCopy}
          </div>
        ) : null}

        {errorCopy ? (
          <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorCopy}
          </div>
        ) : null}

        <form action={signInWithGoogle} className="space-y-4">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-100"
          >
            <InlineGoogle aria-hidden="true" className="h-5 w-5" />
            Continue with Google
          </button>
          <p className="text-center text-xs leading-5 text-slate-500">
            New users are created automatically after Google consent.
          </p>
        </form>
      </div>
    </main>
  );
}
