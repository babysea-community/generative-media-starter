import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const next = normalizeNextPath(
    requestUrl,
    requestUrl.searchParams.get('next'),
  );
  const redirectUrl = new URL(next, requestUrl.origin);
  const loginUrl = new URL('/login', requestUrl.origin);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Use an allowlisted error code; the login page maps codes to fixed copy.
  loginUrl.searchParams.set('error', 'callback_invalid');

  return NextResponse.redirect(loginUrl);
}

const ALLOWED_NEXT_PATHS = new Set([
  '/dashboard',
  '/dashboard/billing',
  '/dashboard/generate',
]);

function normalizeNextPath(requestUrl: URL, value: string | null) {
  if (!value) {
    return '/dashboard/generate';
  }

  const targetUrl = new URL(value, requestUrl.origin);

  if (
    targetUrl.origin !== requestUrl.origin ||
    !ALLOWED_NEXT_PATHS.has(targetUrl.pathname)
  ) {
    return '/dashboard/generate';
  }

  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}
