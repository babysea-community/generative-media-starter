const isProduction = process.env.NODE_ENV === 'production';
const BABYSEA_CDN_ORIGIN = 'https://cdn.babysea.live';

export const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  ...(isProduction
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
  { key: 'Content-Security-Policy', value: buildContentSecurityPolicy() },
];

export const API_SECURITY_HEADERS = [
  {
    key: 'Cache-Control',
    value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
  },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
];

/**
 * Builds Generative Media Starter's static CSP from the active deployment
 * environment. The starter is a single deployable SaaS, so a small static
 * policy in next.config keeps the same allowlist discipline as Sherin without
 * needing middleware nonce plumbing. The CSP applies to HTML responses; JSON
 * API responses under /api/* receive Cache-Control headers via
 * API_SECURITY_HEADERS.
 */
function buildContentSecurityPolicy() {
  const connectHosts = new Set<string>([
    "'self'",
    'https://api.us.babysea.ai', // us-region
    'https://api.eu.babysea.ai', // eu-region
    'https://api.jp.babysea.ai', // apac-region
    'https://api.stripe.com', // Stripe REST API
    'https://m.stripe.network', // Stripe telemetry
  ]);
  const imageHosts = new Set<string>([
    "'self'",
    'data:',
    'blob:',
    'https://app.us.babysea.ai', // us-region
    'https://app.eu.babysea.ai', // eu-region
    'https://app.jp.babysea.ai', // apac-region
    BABYSEA_CDN_ORIGIN, // marketing assets
    'https://*.stripe.com', // Stripe-hosted images (cards, brand)
  ]);
  const scriptHosts = new Set<string>([
    "'self'",
    "'unsafe-inline'",
    'https://js.stripe.com', // Stripe.js
    'https://m.stripe.network', // Stripe telemetry
  ]);
  const frameHosts = new Set<string>([
    "'self'",
    'https://js.stripe.com', // Stripe Elements iframe
    'https://hooks.stripe.com', // Stripe 3DS / webhooks UI
  ]);

  appendSupabaseConnectHosts(
    connectHosts,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  appendHostFromUrl(imageHosts, process.env.NEXT_PUBLIC_SUPABASE_URL);
  appendHostFromUrl(connectHosts, process.env.BABYSEA_API_BASE_URL);

  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

  if (sentryDsn) {
    appendHostFromUrl(connectHosts, sentryDsn);
  }

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': Array.from(scriptHosts),
    'script-src-elem': Array.from(scriptHosts),
    'script-src-attr': ["'none'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': Array.from(imageHosts),
    'font-src': ["'self'", 'data:'],
    'connect-src': Array.from(connectHosts),
    'frame-src': Array.from(frameHosts),
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'", 'https://checkout.stripe.com'],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };

  if (isProduction) {
    directives['upgrade-insecure-requests'] = [];
  }

  return Object.entries(directives)
    .map(([directive, sources]) =>
      sources.length > 0 ? `${directive} ${sources.join(' ')}` : directive,
    )
    .join('; ');
}

function appendSupabaseConnectHosts(set: Set<string>, raw: string | undefined) {
  const trimmed = raw?.trim();

  if (!trimmed) {
    return;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return;
    }

    set.add(`${url.protocol}//${url.host}`);
    set.add(`${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`);
  } catch {
    // ignore invalid URLs; CSP simply will not include them.
  }
}

function appendHostFromUrl(set: Set<string>, raw: string | undefined) {
  const trimmed = raw?.trim();

  if (!trimmed) {
    return;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return;
    }

    set.add(`${url.protocol}//${url.host}`);
  } catch {
    // ignore invalid URLs; CSP simply will not include them.
  }
}
