import 'server-only';

import { BabySea } from 'babysea';
import type {
  Generation,
  GenerationProviderOrder,
  ImageGenerationParams,
  Model,
} from 'babysea';

import { BABYSEA_API_BASE_URL, BABYSEA_MODEL } from './app-config';
import { getOptionalEnv, requireEnv } from './env';

export type BabySeaGenerationRequest = {
  prompt: string;
  ratio: string;
  outputFormat: string;
  outputNumber: number;
  providerOrder: GenerationProviderOrder;
};

export type BabySeaModelConfig = {
  modelIdentifier: string;
  costCredits: number;
  schema: {
    ratios: string[];
    outputFormats: string[];
    outputNumber: number;
  };
};

export type BabySeaGenerationStarted = {
  generationId: string;
  modelIdentifier: string;
  providerOrder: string[];
  predictionId: string;
  idempotencyReplayed: boolean;
};

export type BabySeaGenerationResult = {
  generationId: string;
  modelIdentifier: string;
  providerOrder: string[];
  providerUsed: string | null;
  status: Generation['generation_status'];
  outputFile: string[] | null;
  remoteUrl: string | null;
};

const REQUEST_TIMEOUT_MS = 30_000;
const WAIT_TIMEOUT_MS = 2 * 60 * 1000;
const POLL_INTERVAL_MS = 2_000;
const BABYSEA_API_KEY_REGEX = /^bye_[A-Za-z0-9_-]+$/;
const ALLOWED_BABYSEA_API_HOSTS = new Set([
  'api.us.babysea.ai',
  'api.eu.babysea.ai',
  'api.jp.babysea.ai',
]);

export function isBabySeaConfigured() {
  try {
    assertBabySeaConfigured();

    return true;
  } catch {
    return false;
  }
}

export function assertBabySeaConfigured() {
  getBabySeaApiKey();
  getBabySeaBaseUrlOverride();
}

export async function getBabySeaModelConfig(): Promise<BabySeaModelConfig> {
  const client = createBabySeaClient();
  const modelsResponse = await client.library.models();
  const model = modelsResponse.data.models.find(
    (candidate) => candidate.model_identifier === BABYSEA_MODEL,
  );

  if (!model) {
    throw new Error(`BabySea model not found: ${BABYSEA_MODEL}`);
  }

  const estimateResponse = await client.estimate(BABYSEA_MODEL, {
    count: model.schema.generation_output_number,
  });

  return toBabySeaModelConfig(
    model,
    assertValidCostCredits(estimateResponse.data.cost_total_consumed),
  );
}

export async function estimateBabySeaGenerationCostCredits() {
  const modelConfig = await getBabySeaModelConfig();

  return modelConfig.costCredits;
}

export function assertBabySeaRequestMatchesModelSchema(
  request: BabySeaGenerationRequest,
  modelConfig: BabySeaModelConfig,
) {
  if (!modelConfig.schema.ratios.includes(request.ratio)) {
    throw new Error(`Unsupported ratio for ${BABYSEA_MODEL}: ${request.ratio}`);
  }

  if (!modelConfig.schema.outputFormats.includes(request.outputFormat)) {
    throw new Error(
      `Unsupported output format for ${BABYSEA_MODEL}: ${request.outputFormat}`,
    );
  }

  if (request.outputNumber !== modelConfig.schema.outputNumber) {
    throw new Error(`Unexpected output count for ${BABYSEA_MODEL}`);
  }
}

export async function runBabySeaGeneration(input: {
  request: BabySeaGenerationRequest;
  idempotencyKey: string;
  onStarted?: (generation: BabySeaGenerationStarted) => Promise<void>;
}): Promise<BabySeaGenerationResult> {
  const client = createBabySeaClient();
  const params = {
    generation_prompt: input.request.prompt,
    generation_ratio: input.request.ratio,
    generation_output_format: input.request.outputFormat,
    generation_output_number: input.request.outputNumber,
    generation_provider_order: input.request.providerOrder,
  } satisfies ImageGenerationParams;

  const created = await client.generate(BABYSEA_MODEL, params, {
    idempotencyKey: input.idempotencyKey,
  });

  if ('generation_status' in created.data) {
    throw new Error('BabySea generation was canceled before it started');
  }

  await input.onStarted?.({
    generationId: created.data.generation_id,
    modelIdentifier: created.data.model_identifier,
    providerOrder: created.data.generation_provider_order,
    predictionId: created.data.generation_prediction_id,
    idempotencyReplayed: Boolean(created.idempotency_replayed),
  });

  const response = await client.waitForGeneration(created.data.generation_id, {
    timeout: WAIT_TIMEOUT_MS,
    interval: POLL_INTERVAL_MS,
  });
  const generation = response.data;
  const outputFile = generation.generation_output_file ?? null;
  const remoteUrl = firstOutputUrl(outputFile);

  return {
    generationId: generation.generation_id,
    modelIdentifier: generation.model_identifier ?? BABYSEA_MODEL,
    providerOrder: generation.generation_provider_order ?? [],
    providerUsed: generation.generation_provider_used ?? null,
    status: generation.generation_status,
    outputFile,
    remoteUrl,
  };
}

function createBabySeaClient() {
  const apiKey = getBabySeaApiKey();
  const baseUrl = getBabySeaBaseUrlOverride();

  return new BabySea({
    apiKey,
    ...(baseUrl ? { baseUrl } : { region: 'us' as const }),
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 2,
  });
}

function getBabySeaApiKey() {
  const apiKey = requireEnv('BABYSEA_API_KEY').trim();

  if (!BABYSEA_API_KEY_REGEX.test(apiKey)) {
    throw new Error(
      'BABYSEA_API_KEY must be a BabySea API key starting with bye_.',
    );
  }

  return apiKey;
}

function toBabySeaModelConfig(
  model: Model,
  costCredits: number,
): BabySeaModelConfig {
  if (typeof model.model_pricing !== 'number' || model.model_pricing <= 0) {
    throw new Error(`BabySea model ${BABYSEA_MODEL} must use flat pricing`);
  }

  if (model.schema.generation_ratio.length === 0) {
    throw new Error(`BabySea model ${BABYSEA_MODEL} did not return ratios`);
  }

  if (model.schema.generation_output_format.length === 0) {
    throw new Error(
      `BabySea model ${BABYSEA_MODEL} did not return output formats`,
    );
  }

  return {
    modelIdentifier: model.model_identifier,
    costCredits,
    schema: {
      ratios: model.schema.generation_ratio,
      outputFormats: model.schema.generation_output_format,
      outputNumber: model.schema.generation_output_number,
    },
  };
}

function assertValidCostCredits(costCredits: number) {
  if (!Number.isFinite(costCredits) || costCredits <= 0) {
    throw new Error('BabySea returned an invalid generation cost estimate');
  }

  return costCredits;
}

function getBabySeaBaseUrlOverride() {
  const configuredBaseUrl = getOptionalEnv('BABYSEA_API_BASE_URL');

  if (!configuredBaseUrl || configuredBaseUrl === BABYSEA_API_BASE_URL) {
    return undefined;
  }

  const url = new URL(configuredBaseUrl);

  if (url.protocol !== 'https:') {
    throw new Error('BABYSEA_API_BASE_URL must use HTTPS');
  }

  if (!ALLOWED_BABYSEA_API_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('BABYSEA_API_BASE_URL must be a BabySea API host');
  }

  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';

  return url.toString().replace(/\/+$/, '');
}

function firstOutputUrl(outputs: string[] | null) {
  return outputs?.find((value) => value.startsWith('https://')) ?? null;
}
