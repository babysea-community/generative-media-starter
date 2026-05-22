'use server';

import { redirect } from 'next/navigation';

import { getSiteUrl } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient();
  const redirectTo = new URL('/auth/callback', getSiteUrl());
  redirectTo.searchParams.set('next', '/dashboard/generate');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo.toString(),
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    // Avoid forwarding the raw provider error message into a redirect URL so
    // the login page only renders allowlisted copy (see app/login/page.tsx).
    redirect('/login?error=oauth_failed');
  }

  if (!data.url) {
    redirect('/login?error=oauth_unavailable');
  }

  redirect(data.url);
}
