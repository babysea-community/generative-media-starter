import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

import { getOptionalEnv } from './env';

let limiter: Ratelimit | null = null;

export const GENERATION_RATE_LIMIT_MESSAGE =
  'Rate limit exceeded. Please wait before generating again.';

export class GenerationRateLimitError extends Error {
  constructor() {
    super(GENERATION_RATE_LIMIT_MESSAGE);
    this.name = 'GenerationRateLimitError';
  }
}

export function isGenerationRateLimitError(error: unknown) {
  return error instanceof GenerationRateLimitError;
}

function getLimiter() {
  if (limiter) {
    return limiter;
  }

  if (
    !getOptionalEnv('UPSTASH_REDIS_REST_URL') ||
    !getOptionalEnv('UPSTASH_REDIS_REST_TOKEN')
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Upstash Redis env vars are required in production');
    }

    return null;
  }

  limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    analytics: true,
    prefix: 'generative-media-starter',
  });

  return limiter;
}

export async function assertGenerationRateLimit(userId: string) {
  const activeLimiter = getLimiter();

  if (!activeLimiter) {
    return;
  }

  const result = await activeLimiter.limit(`generate:${userId}`);

  if (!result.success) {
    throw new GenerationRateLimitError();
  }
}
