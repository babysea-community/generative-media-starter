#!/usr/bin/env node
// @ts-nocheck

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { BabySea } from 'babysea';
import Stripe from 'stripe';

const ROOT = process.cwd();
const REQUIRED_ASSET_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
];
const BABYSEA_API_HOSTS = new Set([
  'api.us.babysea.ai',
  'api.eu.babysea.ai',
  'api.jp.babysea.ai',
]);
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const results = [];
const ORIGINAL_ENV_KEYS = new Set(Object.keys(process.env));

loadEnvFile('.env');
loadEnvFile('.env.local', { override: true });

const starterConfig = readStarterConfig();

console.log('Generative Media Starter doctor\n');

await runCheck('Standalone pnpm configuration', () => {
  const npmrc = readOptionalFile('.npmrc');
  const packageJson = JSON.parse(readRequiredFile('package.json'));
  const workspace = readRequiredFile('pnpm-workspace.yaml');

  if (!npmrc.includes('ignore-workspace=false')) {
    throw new Error('.npmrc must set ignore-workspace=false');
  }

  if (!workspace.includes('packages:') || !workspace.includes('  - .')) {
    throw new Error(
      'pnpm-workspace.yaml must declare this package as the workspace',
    );
  }

  if (!workspace.includes('catalog:')) {
    throw new Error('pnpm-workspace.yaml must define a dependency catalog');
  }

  for (const dependency of ['next', 'react', 'babysea', 'stripe', 'supabase']) {
    if (!workspace.includes(`  ${dependency}:`)) {
      throw new Error(`pnpm-workspace.yaml catalog must include ${dependency}`);
    }
  }

  for (const [sectionName, section] of Object.entries({
    dependencies: packageJson.dependencies ?? {},
    devDependencies: packageJson.devDependencies ?? {},
  })) {
    for (const [name, specifier] of Object.entries(section)) {
      if (specifier !== 'catalog:') {
        throw new Error(`${sectionName}.${name} must use catalog:`);
      }
    }
  }

  for (const dependency of ['@tailwindcss/oxide', 'supabase']) {
    if (
      !workspace.includes(`  - ${dependency}`) &&
      !workspace.includes(`  - '${dependency}'`) &&
      !workspace.includes(`  - "${dependency}"`)
    ) {
      throw new Error(
        `pnpm-workspace.yaml onlyBuiltDependencies must include ${dependency}`,
      );
    }
  }

  return 'local pnpm workspace, catalog, and build-script approvals are configured';
});

await runCheck('Runtime environment variables', () => {
  const missing = [
    'NEXT_PUBLIC_SITE_URL',
    'BABYSEA_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLIC_KEY',
    'SUPABASE_SECRET_KEY',
  ].filter((name) => !env(name));

  if (missing.length > 0) {
    throw new Error(`Missing required variables: ${missing.join(', ')}`);
  }

  validateUrlEnv('NEXT_PUBLIC_SITE_URL', { allowLocalhost: true });
  validateUrlEnv('NEXT_PUBLIC_SUPABASE_URL', { allowLocalhost: true });
  validateUrlEnv('BABYSEA_API_BASE_URL', {
    optional: true,
    allowedHosts: BABYSEA_API_HOSTS,
  });
  validateUrlEnv('UPSTASH_REDIS_REST_URL', { optional: true });

  if (!env('BABYSEA_API_KEY').startsWith('bye_')) {
    throw new Error('BABYSEA_API_KEY must start with bye_');
  }

  if (!env('STRIPE_WEBHOOK_SECRET').startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET must start with whsec_');
  }

  return 'required variables are present and well-formed';
});

await runCheck('BabySea SDK model schema', async () => {
  const apiKey = requiredEnv('BABYSEA_API_KEY');
  const baseUrl = validateUrlEnv('BABYSEA_API_BASE_URL', {
    optional: true,
    allowedHosts: BABYSEA_API_HOSTS,
  });
  const client = new BabySea({
    apiKey,
    ...(baseUrl ? { baseUrl } : { region: 'us' }),
    timeout: 15_000,
    maxRetries: 1,
  });
  const [modelsResponse, estimateResponse] = await Promise.all([
    client.library.models(),
    client.estimate(starterConfig.babySeaModel, {
      count: starterConfig.outputNumber,
    }),
  ]);
  const model = modelsResponse.data.models.find(
    (candidate) => candidate.model_identifier === starterConfig.babySeaModel,
  );

  if (!model) {
    throw new Error(`Model not found: ${starterConfig.babySeaModel}`);
  }

  if (!model.schema.generation_ratio.length) {
    throw new Error('Model did not return generation ratios');
  }

  if (!model.schema.generation_output_format.length) {
    throw new Error('Model did not return output formats');
  }

  const costCredits = estimateResponse.data.cost_total_consumed;

  if (!Number.isFinite(costCredits) || costCredits <= 0) {
    throw new Error('BabySea returned an invalid cost estimate');
  }

  return `${starterConfig.babySeaModel} ready at ${formatCurrencyCredits(costCredits)}/output`;
});

await runCheck('Stripe credit-pack prices', async () => {
  const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'));

  for (const pack of starterConfig.creditPacks) {
    const configuredPriceId = env(pack.stripePriceEnvKey);
    const price = configuredPriceId
      ? await stripe.prices.retrieve(configuredPriceId)
      : await findPriceByLookupKey(stripe, pack.stripeLookupKey);

    assertStripePriceMatchesPack(price, pack);
  }

  return `${starterConfig.creditPacks.length} one-time USD Prices verified`;
});

await runCheck('Supabase schema and storage', async () => {
  const supabase = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SECRET_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const publicClient = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_PUBLIC_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  if (authError) {
    throw authError;
  }

  for (const table of [
    'credit_balances',
    'credit_ledger',
    'generations',
    'stripe_customers',
    'processed_stripe_events',
  ]) {
    const { error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
  }

  await assertPublicMutationsBlocked(supabase, publicClient);

  const { data: bucket, error: bucketError } =
    await supabase.storage.getBucket('generated-media');

  if (bucketError) {
    throw bucketError;
  }

  if (bucket.public) {
    throw new Error('generated-media bucket must be private');
  }

  const allowedMimeTypes = new Set(bucket.allowed_mime_types ?? []);

  for (const mimeType of REQUIRED_ASSET_MIME_TYPES) {
    if (!allowedMimeTypes.has(mimeType)) {
      throw new Error(`generated-media bucket missing ${mimeType}`);
    }
  }

  for (const mimeType of ['image/svg+xml', 'application/json', 'text/plain']) {
    if (allowedMimeTypes.has(mimeType)) {
      throw new Error(`generated-media bucket should not allow ${mimeType}`);
    }
  }

  return 'tables, service role, and private bucket verified';
});

await runCheck('Upstash Redis rate-limit store', async () => {
  const url = env('UPSTASH_REDIS_REST_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN');

  if (!url && !token) {
    if (process.env.NODE_ENV === 'production' || isProductionSiteUrl()) {
      throw new Error('Upstash Redis env vars are required for production');
    }

    return warn('not configured; allowed only for local development');
  }

  if (!url || !token) {
    throw new Error('Both Upstash URL and token must be set');
  }

  const redis = new Redis({ url, token });
  await redis.ping();

  return 'REST API ping succeeded';
});

await runCheck('Vercel deployment config', () => {
  const vercel = JSON.parse(readRequiredFile('vercel.json'));

  if (vercel.framework !== 'nextjs') {
    throw new Error('vercel.json framework must be nextjs');
  }

  if (vercel.buildCommand !== 'pnpm build') {
    throw new Error('vercel.json buildCommand must be pnpm build');
  }

  if (vercel.devCommand !== 'pnpm dev') {
    throw new Error('vercel.json devCommand must be pnpm dev');
  }

  if (vercel.installCommand !== 'pnpm install --frozen-lockfile') {
    throw new Error(
      'vercel.json installCommand must be pnpm install --frozen-lockfile',
    );
  }

  return 'Vercel build, install, and dev commands verified';
});

await runCheck('Netlify deployment config', () => {
  const netlify = readRequiredFile('netlify.toml');

  if (!netlify.includes('[build]')) {
    throw new Error('netlify.toml must include a [build] section');
  }

  if (!netlify.includes('command = "pnpm build"')) {
    throw new Error('netlify.toml build command must run pnpm build');
  }

  if (!netlify.includes('publish = ".next"')) {
    throw new Error('netlify.toml publish directory must be .next');
  }

  if (!netlify.includes('NODE_VERSION = "20"')) {
    throw new Error('netlify.toml must pin NODE_VERSION = "20"');
  }

  for (const name of [
    'NEXT_PUBLIC_SITE_URL',
    'BABYSEA_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLIC_KEY',
    'SUPABASE_SECRET_KEY',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ]) {
    if (!netlify.includes(`${name} =`)) {
      throw new Error(`netlify.toml template environment must include ${name}`);
    }
  }

  return 'Netlify build command, publish directory, and Node version verified';
});

await runCheck('Security headers (next.config.ts)', () => {
  const nextConfig = readRequiredFile('next.config.ts');
  const required = [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Strict-Transport-Security',
  ];
  const missing = required.filter((header) => !nextConfig.includes(header));

  if (missing.length > 0) {
    throw new Error(
      `next.config.ts is missing security headers: ${missing.join(', ')}`,
    );
  }

  if (!/headers\(\)/.test(nextConfig)) {
    throw new Error('next.config.ts must declare an async headers() block');
  }

  return `${required.length} baseline security headers declared`;
});

await runCheck('Security headers (deployed origin)', async () => {
  const siteUrl = env('NEXT_PUBLIC_SITE_URL');

  if (!siteUrl) {
    return warn('NEXT_PUBLIC_SITE_URL not set; skipping live header probe');
  }

  let url;

  try {
    url = new URL(siteUrl);
  } catch {
    throw new Error('NEXT_PUBLIC_SITE_URL is not a valid URL');
  }

  if (LOCAL_HOSTNAMES.has(url.hostname.toLowerCase())) {
    return warn('site URL is localhost; skipping live header probe');
  }

  let response;

  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    return warn(
      `could not reach ${url.hostname} to probe headers (${error instanceof Error ? error.message : 'unknown'})`,
    );
  }

  const requiredHeaders = [
    'x-frame-options',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
    'strict-transport-security',
  ];
  const missing = requiredHeaders.filter(
    (header) => !response.headers.get(header),
  );

  if (missing.length > 0) {
    throw new Error(
      `deployed origin is missing headers: ${missing.join(', ')}`,
    );
  }

  return `${requiredHeaders.length} security headers served from ${url.hostname}`;
});

const failed = results.filter((result) => result.status === 'fail');
const warned = results.filter((result) => result.status === 'warn');

console.log(
  `\nSummary: ${results.length - failed.length - warned.length} passed, ${warned.length} warnings, ${failed.length} failed.`,
);

if (failed.length > 0) {
  process.exitCode = 1;
}

function loadEnvFile(fileName, options = {}) {
  const path = resolve(ROOT, fileName);

  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (
      ORIGINAL_ENV_KEYS.has(key) ||
      (process.env[key] !== undefined && !options.override)
    ) {
      continue;
    }

    process.env[key] = stripQuotes(rawValue.trim());
  }
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function runCheck(title, check) {
  try {
    const details = await check();

    if (details?.status === 'warn') {
      record('warn', title, details.message);
    } else {
      record('pass', title, details);
    }
  } catch (error) {
    record('fail', title, sanitizeError(error));
  }
}

function warn(message) {
  return { status: 'warn', message };
}

function record(status, title, details) {
  results.push({ status, title, details });

  const icon = status === 'pass' ? '✓' : status === 'warn' ? '!' : '✕';
  const suffix = details ? ` - ${details}` : '';

  console.log(`${icon} ${title}${suffix}`);
}

function env(name) {
  const value = process.env[name]?.trim();

  return value && value.length > 0 ? value : undefined;
}

function requiredEnv(name) {
  const value = env(name);

  if (!value) {
    throw new Error(`Missing required variable: ${name}`);
  }

  return value;
}

function validateUrlEnv(name, options = {}) {
  const value = env(name);

  if (!value) {
    if (options.optional) {
      return undefined;
    }

    throw new Error(`Missing required variable: ${name}`);
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${name} must use HTTP or HTTPS`);
  }

  const isLocalhost = LOCAL_HOSTNAMES.has(url.hostname.toLowerCase());

  if (isLocalhost && isProductionRuntime()) {
    throw new Error(`${name} cannot use localhost in production`);
  }

  if (url.protocol !== 'https:' && !(options.allowLocalhost && isLocalhost)) {
    throw new Error(`${name} must use HTTPS outside local development`);
  }

  if (
    options.allowedHosts &&
    !options.allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw new Error(`${name} host is not allowed`);
  }

  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';

  return url.toString().replace(/\/+$/, '');
}

function isProductionSiteUrl() {
  const siteUrl = env('NEXT_PUBLIC_SITE_URL');

  if (!siteUrl) {
    return false;
  }

  try {
    const url = new URL(siteUrl);

    return !LOCAL_HOSTNAMES.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL_ENV === 'production'
  );
}

async function assertPublicMutationsBlocked(admin, publicClient) {
  const generationId = randomUUID();
  const userId = randomUUID();
  const ledgerEventId = `evt_doctor_${randomUUID()}`;
  const processedEventId = `evt_doctor_${randomUUID()}`;
  const storagePath = `${randomUUID()}/doctor.txt`;

  await expectInsertBlocked(admin, publicClient, {
    table: 'credit_balances',
    values: {
      user_id: userId,
      credits: 1,
    },
    cleanup: (client) =>
      client.from('credit_balances').delete().eq('user_id', userId),
  });

  await expectInsertBlocked(admin, publicClient, {
    table: 'generations',
    values: {
      id: generationId,
      user_id: userId,
      provider: 'babysea',
      model: starterConfig.babySeaModel,
      prompt: 'doctor mutation probe',
      status: 'queued',
      cost_credits: 0.005,
    },
    cleanup: (client) =>
      client.from('generations').delete().eq('id', generationId),
  });

  await expectInsertBlocked(admin, publicClient, {
    table: 'credit_ledger',
    values: {
      user_id: userId,
      type: 'grant',
      amount: 1,
      stripe_event_id: ledgerEventId,
      description: 'doctor mutation probe',
    },
    cleanup: (client) =>
      client
        .from('credit_ledger')
        .delete()
        .eq('stripe_event_id', ledgerEventId),
  });

  await expectInsertBlocked(admin, publicClient, {
    table: 'stripe_customers',
    values: {
      user_id: userId,
      stripe_customer_id: `cus_doctor_${randomUUID().replaceAll('-', '')}`,
    },
    cleanup: (client) =>
      client.from('stripe_customers').delete().eq('user_id', userId),
  });

  await expectInsertBlocked(admin, publicClient, {
    table: 'processed_stripe_events',
    values: {
      id: processedEventId,
      type: 'doctor.probe',
    },
    cleanup: (client) =>
      client
        .from('processed_stripe_events')
        .delete()
        .eq('id', processedEventId),
  });

  await expectRpcBlocked(publicClient, 'grant_paid_credits', {
    p_user_id: userId,
    p_amount: 1,
    p_stripe_event_id: `evt_doctor_${randomUUID()}`,
    p_description: 'doctor mutation probe',
  });
  await expectRpcBlocked(publicClient, 'complete_generation', {
    p_generation_id: generationId,
    p_storage_path: storagePath,
  });
  await expectRpcBlocked(publicClient, 'fail_generation', {
    p_generation_id: generationId,
    p_error: 'doctor mutation probe',
  });

  const { error: storageError } = await publicClient.storage
    .from('generated-media')
    .upload(storagePath, new Blob(['doctor mutation probe']), {
      contentType: 'text/plain',
      upsert: false,
    });

  if (!storageError) {
    await admin.storage.from('generated-media').remove([storagePath]);

    throw new Error('generated-media storage allowed public upload');
  }
}

async function expectInsertBlocked(admin, publicClient, probe) {
  const { error } = await publicClient.from(probe.table).insert(probe.values);

  if (!error) {
    await probe.cleanup(admin);

    throw new Error(`${probe.table} allowed public insert`);
  }
}

async function expectRpcBlocked(publicClient, functionName, args) {
  const { error } = await publicClient.rpc(functionName, args);

  if (!error) {
    throw new Error(`${functionName} allowed public execution`);
  }
}

async function findPriceByLookupKey(stripe, lookupKey) {
  const prices = await stripe.prices.list({
    active: true,
    limit: 10,
    lookup_keys: [lookupKey],
  });
  const price = prices.data.find(
    (candidate) => candidate.lookup_key === lookupKey,
  );

  if (!price) {
    throw new Error(`Missing Stripe price for lookup key: ${lookupKey}`);
  }

  return price;
}

function assertStripePriceMatchesPack(price, pack) {
  if (!price.active) {
    throw new Error(`Stripe price for ${pack.id} is not active`);
  }

  if (price.currency.toLowerCase() !== 'usd') {
    throw new Error(`Stripe price for ${pack.id} must use USD`);
  }

  if (price.unit_amount !== pack.amountCents) {
    throw new Error(
      `Stripe price for ${pack.id} must be ${pack.amountCents} cents`,
    );
  }

  if (price.recurring) {
    throw new Error(`Stripe price for ${pack.id} must be one-time`);
  }
}

function formatCurrencyCredits(value) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function readStarterConfig() {
  const source = readRequiredFile('lib/app-config.ts');
  const babySeaModel = readStringConst(source, 'BABYSEA_MODEL');
  const outputNumber = Number(
    source.match(/outputNumber:\s*(\d+)/)?.[1] ?? '1',
  );
  const creditPacks = [...source.matchAll(packRegex())].map((match) => ({
    id: match[1],
    name: match[2],
    credits: Number(match[3]),
    amountCents: Number(match[4]),
    stripeLookupKey: match[5],
    stripePriceEnvKey: match[6],
  }));

  if (creditPacks.length === 0) {
    throw new Error('Could not read CREDIT_PACKS from lib/app-config.ts');
  }

  return { babySeaModel, outputNumber, creditPacks };
}

function readStringConst(source, name) {
  const match = source.match(new RegExp(`export const ${name} = '([^']+)';`));

  if (!match?.[1]) {
    throw new Error(`Could not read ${name} from lib/app-config.ts`);
  }

  return match[1];
}

function packRegex() {
  return /\{\s*id: '([^']+)',\s*name: '([^']+)',\s*credits: ([0-9.]+),\s*amountCents: (\d+),\s*stripeLookupKey: '([^']+)',\s*stripePriceEnvKey: '([^']+)',/g;
}

function readRequiredFile(fileName) {
  const path = resolve(ROOT, fileName);

  if (!existsSync(path)) {
    throw new Error(`Missing ${fileName}`);
  }

  return readFileSync(path, 'utf8');
}

function readOptionalFile(fileName) {
  const path = resolve(ROOT, fileName);

  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const secretValues = [
    'BABYSEA_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_SUPABASE_PUBLIC_KEY',
    'SUPABASE_SECRET_KEY',
    'UPSTASH_REDIS_REST_TOKEN',
  ]
    .map(env)
    .filter((value) => value && value.length > 8);

  return secretValues.reduce(
    (sanitized, secret) =>
      sanitized.replaceAll(secret, `${secret.slice(0, 4)}...[redacted]`),
    message,
  );
}
