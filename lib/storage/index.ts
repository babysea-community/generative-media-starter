import 'server-only';

import { Buffer } from 'node:buffer';

import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'generated-media';
const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const ASSET_FETCH_TIMEOUT_MS = 30_000;
const ALLOWED_ASSET_HOST_SUFFIXES = [
  'app.us.babysea.ai',
  'app.eu.babysea.ai',
  'app.jp.babysea.ai',
];
const ALLOWED_ASSET_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
]);

export async function persistRemoteAsset(input: {
  supabase: SupabaseClient;
  userId: string;
  generationId: string;
  remoteUrl: string | null;
}) {
  if (!input.remoteUrl) {
    return null;
  }

  const assetUrl = parseAllowedAssetUrl(input.remoteUrl);
  const response = await fetch(assetUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(ASSET_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Could not download generated asset: ${response.status}`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const contentLength = contentLengthHeader
    ? Number(contentLengthHeader)
    : null;

  if (contentLength && contentLength > MAX_ASSET_BYTES) {
    throw new Error('Generated asset is larger than the starter limit');
  }

  const contentType = normalizeContentType(
    response.headers.get('content-type'),
  );

  if (!ALLOWED_ASSET_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Unsupported generated asset content type: ${contentType}`);
  }

  const extension = extensionForContentType(contentType);
  const path = `${input.userId}/${input.generationId}.${extension}`;
  const body = await readLimitedBody(response);

  const { error } = await input.supabase.storage
    .from(BUCKET)
    .upload(path, body, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return path;
}

export async function createSignedAssetUrl(
  supabase: SupabaseClient,
  storagePath: string | null,
) {
  if (!storagePath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 10);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

function parseAllowedAssetUrl(remoteUrl: string) {
  const url = new URL(remoteUrl);

  if (url.protocol !== 'https:') {
    throw new Error('Generated asset URL must use HTTPS');
  }

  const hostname = url.hostname.toLowerCase();
  const isAllowedHost = ALLOWED_ASSET_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );

  if (!isAllowedHost) {
    throw new Error(`Unsupported generated asset host: ${hostname}`);
  }

  return url;
}

function normalizeContentType(contentType: string | null) {
  return contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
}

async function readLimitedBody(response: Response) {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('Generated asset response did not include a body');
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;

    if (totalBytes > MAX_ASSET_BYTES) {
      throw new Error('Generated asset is larger than the starter limit');
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks, totalBytes);
}

function extensionForContentType(contentType: string) {
  if (contentType.includes('image/png')) {
    return 'png';
  }

  if (contentType.includes('image/jpeg')) {
    return 'jpg';
  }

  if (contentType.includes('image/webp')) {
    return 'webp';
  }

  if (contentType.includes('image/gif')) {
    return 'gif';
  }

  if (contentType.includes('video/mp4')) {
    return 'mp4';
  }

  return 'bin';
}
