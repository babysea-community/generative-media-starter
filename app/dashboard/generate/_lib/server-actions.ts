'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  BABYSEA_MODEL,
  BABYSEA_PROVIDER_ORDER_DEFAULT,
} from '@/lib/app-config';
import {
  type BabySeaGenerationRequest,
  assertBabySeaRequestMatchesModelSchema,
  getBabySeaModelConfig,
  isBabySeaConfigured,
  runBabySeaGeneration,
  type BabySeaGenerationStarted,
} from '@/lib/inference/babysea';
import {
  assertGenerationRateLimit,
  isGenerationRateLimitError,
} from '@/lib/security/rate-limit';
import { captureServerError } from '@/lib/monitoring/sentry-server';
import { persistRemoteAsset } from '@/lib/storage';
import { createSupabaseAdminClient } from '@/lib/database/admin';
import { getUser } from '@/lib/database/server';
import { errorMessage } from '@/lib/utils';

const GenerateSchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  generation_ratio: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1).max(16),
  ),
  generation_output_format: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1).max(16),
  ),
});

function emptyStringToUndefined(value: unknown) {
  return value === '' || value === null ? undefined : value;
}

export async function generateMedia(formData: FormData) {
  const { supabase, user } = await getUser();

  if (!user) {
    redirect('/login');
  }

  const parsed = GenerateSchema.parse({
    prompt: formData.get('prompt'),
    generation_ratio: formData.get('generation_ratio'),
    generation_output_format: formData.get('generation_output_format'),
  });

  if (!isBabySeaConfigured()) {
    redirect('/dashboard/generate?error=configuration');
  }

  const modelConfig = await getBabySeaModelConfig();
  const costCredits = modelConfig.costCredits;
  const request: BabySeaGenerationRequest = {
    prompt: parsed.prompt,
    ratio: parsed.generation_ratio,
    outputFormat: parsed.generation_output_format,
    outputNumber: modelConfig.schema.outputNumber,
    providerOrder: BABYSEA_PROVIDER_ORDER_DEFAULT,
  };

  assertBabySeaRequestMatchesModelSchema(request, modelConfig);

  try {
    await assertGenerationRateLimit(user.id);
  } catch (error) {
    if (isGenerationRateLimitError(error)) {
      redirect('/dashboard/generate?error=rate_limit');
    }

    throw error;
  }

  const admin = createSupabaseAdminClient();
  const { data: generation, error: generationError } = await admin
    .from('generations')
    .insert({
      user_id: user.id,
      provider: 'babysea',
      model: BABYSEA_MODEL,
      prompt: request.prompt,
      status: 'queued',
      cost_credits: costCredits,
    })
    .select('id')
    .single();

  if (generationError) {
    throw generationError;
  }

  const generationId = generation.id;

  const { data: reserved, error: reserveError } = await supabase.rpc(
    'reserve_generation_credits',
    {
      p_generation_id: generationId,
    },
  );

  if (reserveError) {
    throw reserveError;
  }

  if (!reserved) {
    await admin
      .from('generations')
      .update({
        status: 'failed',
        error: 'Insufficient credits. Buy a credit pack before generating.',
      })
      .eq('id', generationId);

    revalidatePath('/dashboard/generate');
    redirect('/dashboard/generate?error=insufficient_credits');
  }

  await admin
    .from('generations')
    .update({ status: 'running', error: null })
    .eq('id', generationId);

  let startedMetadata: BabySeaGenerationStarted | null = null;

  try {
    const babySeaResult = await runBabySeaGeneration({
      request,
      idempotencyKey: generationId,
      onStarted: async (started) => {
        startedMetadata = started;

        try {
          const { error: metadataError } = await admin
            .from('generations')
            .update({
              output: {
                ...babySeaRequestMetadataOutput(request),
                ...babySeaStartedMetadataOutput(started),
              },
            })
            .eq('id', generationId);

          if (metadataError) {
            console.error(
              'Could not persist started BabySea metadata',
              metadataError,
            );
          }
        } catch (metadataError) {
          console.error(
            'Could not persist started BabySea metadata',
            metadataError,
          );
        }
      },
    });
    const storagePath = await persistRemoteAsset({
      supabase: admin,
      userId: user.id,
      generationId,
      remoteUrl: babySeaResult.remoteUrl,
    });

    if (!storagePath) {
      throw new Error('BabySea did not return a downloadable asset');
    }

    const { error: completeError } = await admin.rpc('complete_generation', {
      p_generation_id: generationId,
      p_storage_path: storagePath,
    });

    if (completeError) {
      throw completeError;
    }

    try {
      const { error: metadataError } = await admin
        .from('generations')
        .update({
          output: {
            ...babySeaRequestMetadataOutput(request),
            ...(startedMetadata
              ? babySeaStartedMetadataOutput(startedMetadata)
              : {}),
            babysea_generation_id: babySeaResult.generationId,
            babysea_model_identifier: babySeaResult.modelIdentifier,
            babysea_generation_provider_order: babySeaResult.providerOrder,
            babysea_generation_provider_used: babySeaResult.providerUsed,
            babysea_generation_status: babySeaResult.status,
            babysea_generation_output_file: babySeaResult.outputFile,
          },
        })
        .eq('id', generationId);

      if (metadataError) {
        console.error(
          'Could not persist final BabySea metadata',
          metadataError,
        );
      }
    } catch (metadataError) {
      console.error('Could not persist final BabySea metadata', metadataError);
    }
  } catch (error) {
    const { error: failError } = await admin.rpc('fail_generation', {
      p_generation_id: generationId,
      p_error: errorMessage(error),
    });

    if (failError) {
      throw failError;
    }

    if (startedMetadata) {
      try {
        const { error: metadataError } = await admin
          .from('generations')
          .update({
            output: {
              ...babySeaRequestMetadataOutput(request),
              ...babySeaStartedMetadataOutput(startedMetadata),
              babysea_local_error: errorMessage(error),
            },
          })
          .eq('id', generationId);

        if (metadataError) {
          console.error(
            'Could not persist failed BabySea metadata',
            metadataError,
          );
        }
      } catch (metadataError) {
        console.error(
          'Could not persist failed BabySea metadata',
          metadataError,
        );
      }
    }

    await captureServerError(error, {
      tags: {
        action: 'generateMedia',
        generationId,
        model: BABYSEA_MODEL,
      },
    });

    revalidatePath('/dashboard/generate');
    redirect(`/dashboard/generate?error=babysea&generation=${generationId}`);
  }

  revalidatePath('/dashboard/generate');
  revalidatePath('/dashboard/billing');
  redirect(`/dashboard/generate?created=${generationId}`);
}

function babySeaRequestMetadataOutput(request: BabySeaGenerationRequest) {
  return {
    babysea_request_schema: {
      generation_prompt: request.prompt,
      generation_ratio: request.ratio,
      generation_output_format: request.outputFormat,
      generation_output_number: request.outputNumber,
      generation_provider_order: request.providerOrder,
    },
  };
}

function babySeaStartedMetadataOutput(started: BabySeaGenerationStarted) {
  return {
    babysea_generation_id: started.generationId,
    babysea_model_identifier: started.modelIdentifier,
    babysea_generation_provider_order: started.providerOrder,
    babysea_generation_prediction_id: started.predictionId,
    babysea_idempotency_replayed: started.idempotencyReplayed,
  };
}
