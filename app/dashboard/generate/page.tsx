import type { Metadata } from 'next';

import { ChevronDown } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Generate',
  description: 'Generate images and videos using BabySea-powered AI models.',
  robots: { index: false, follow: false },
};

import {
  BABYSEA_MODEL,
  BABYSEA_PROVIDER_ORDER_DEFAULT,
  GENERATION_COST_CREDITS,
} from '@/lib/app-config';
import { getBabySeaModelConfig, isBabySeaConfigured } from '@/lib/babysea';
import generationDescriptions from '@/lib/generation-descriptions.json';
import { createSignedAssetUrl } from '@/lib/storage';
import { getUser } from '@/lib/supabase/server';
import { formatCredits, formatDate } from '@/lib/utils';

import {
  CopyableGenerationId,
  CopyPromptButton,
} from '../_components/copy-controls';
import { DismissibleBanner } from '../_components/dismissible-banner';
import { generateMedia } from './_lib/server-actions';
import { GenerateSubmitButton } from './_components/generate-submit-button';

export const maxDuration = 180;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const coreSchemaDescriptions = generationDescriptions.fields;
const FALLBACK_GENERATION_RATIO = '1:1';
const FALLBACK_GENERATION_OUTPUT_FORMAT = 'png';
const FALLBACK_GENERATION_OUTPUT_NUMBER = 1;

export default async function GeneratePage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const { supabase, user } = await getUser();

  const { data: generations } = await supabase
    .from('generations')
    .select(
      'id,provider,model,prompt,status,cost_credits,storage_path,error,created_at',
    )
    .eq('user_id', user?.id ?? '')
    .order('created_at', { ascending: false });

  const { data: balance } = await supabase
    .from('credit_balances')
    .select('credits')
    .eq('user_id', user?.id ?? '')
    .maybeSingle();

  const hasBabySeaApiKey = isBabySeaConfigured();
  const modelConfig = hasBabySeaApiKey
    ? await getBabySeaModelConfig().catch((error) => {
        console.error('Could not load BabySea model schema', error);

        return null;
      })
    : null;
  const generationCostCredits =
    modelConfig?.costCredits ?? GENERATION_COST_CREDITS;
  const availableCredits = Number(balance?.credits ?? 0);
  const hasCreditsForGeneration = availableCredits >= generationCostCredits;
  const canSubmitGeneration = hasBabySeaApiKey && hasCreditsForGeneration;
  const generationRatios = modelConfig?.schema.ratios.length
    ? modelConfig.schema.ratios
    : [FALLBACK_GENERATION_RATIO];
  const generationOutputFormats = modelConfig?.schema.outputFormats.length
    ? modelConfig.schema.outputFormats
    : [FALLBACK_GENERATION_OUTPUT_FORMAT];
  const generationOutputNumber =
    modelConfig?.schema.outputNumber ?? FALLBACK_GENERATION_OUTPUT_NUMBER;
  const defaultRatio = generationRatios[0] ?? FALLBACK_GENERATION_RATIO;
  const defaultOutputFormat =
    generationOutputFormats[0] ?? FALLBACK_GENERATION_OUTPUT_FORMAT;
  const generationsWithAssets = await Promise.all(
    (generations ?? []).map(async (generation) => ({
      ...generation,
      assetUrl: await createSignedAssetUrl(supabase, generation.storage_path),
    })),
  );

  return (
    <main className="w-full space-y-6">
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-teal-200">
            Generate
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            BabySea SDK execution pipeline.
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            On submit, the server validates the request against the BabySea SDK
            schema, rate-limits the user, creates a generation record, reserves
            credits atomically, dispatches the workload with a server-managed
            BabySea API key, stores the returned asset privately, then charges
            or refunds the reservation.
          </p>
        </div>

        <div className="space-y-4">
          {!hasBabySeaApiKey ? (
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
              Server BabySea configuration is missing. Set BABYSEA_API_KEY in
              the deployment environment before enabling generation.
            </div>
          ) : null}

          {hasBabySeaApiKey && !hasCreditsForGeneration ? (
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
              Add credits before generating. This model costs{' '}
              {formatCredits(generationCostCredits)} per output and your current
              balance is {formatCredits(availableCredits)}.
            </div>
          ) : null}

          <form
            action={canSubmitGeneration ? generateMedia : undefined}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur"
          >
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
              Image model: {BABYSEA_MODEL} ·{' '}
              {formatCredits(generationCostCredits)}/output
            </div>
            <div className="mt-4 rounded-2xl border border-teal-300/10 bg-teal-300/5 p-4">
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">
                    Core schema
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Core generation parameters shared across providers. These
                    fields are normalized by BabySea, so you can send one
                    unified request shape while BabySea maps it to the provider
                    selected for execution.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-200 sm:col-span-2">
                  <code className="text-teal-100">generation_prompt</code>
                  <textarea
                    required
                    name="prompt"
                    rows={5}
                    placeholder="A baby seal plays in the Arctic"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-teal-300/60"
                  />
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {coreSchemaDescriptions.generation_prompt}.
                  </span>
                </label>

                <label className="text-sm font-medium text-slate-200">
                  <code className="text-teal-100">generation_ratio</code>
                  <div className="relative mt-2">
                    <select
                      name="generation_ratio"
                      defaultValue={defaultRatio}
                      className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 pr-14 text-sm text-white outline-none transition focus:border-teal-300/60"
                    >
                      {generationRatios.map((ratio) => (
                        <option key={ratio} value={ratio}>
                          {ratio}
                        </option>
                      ))}
                    </select>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-slate-400"
                    >
                      <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                  </div>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {coreSchemaDescriptions.generation_ratio}.
                  </span>
                </label>

                <label className="text-sm font-medium text-slate-200">
                  <code className="text-teal-100">
                    generation_output_format
                  </code>
                  <div className="relative mt-2">
                    <select
                      name="generation_output_format"
                      defaultValue={defaultOutputFormat}
                      className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 pr-14 text-sm text-white outline-none transition focus:border-teal-300/60"
                    >
                      {generationOutputFormats.map((format) => (
                        <option key={format} value={format}>
                          {format.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-slate-400"
                    >
                      <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                  </div>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {coreSchemaDescriptions.generation_output_format}.
                  </span>
                </label>

                <label className="text-sm font-medium text-slate-200">
                  <code className="text-teal-100">
                    generation_output_number
                  </code>
                  <div
                    aria-disabled="true"
                    className="mt-2 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white"
                  >
                    {generationOutputNumber}
                  </div>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {coreSchemaDescriptions.generation_output_number}.
                  </span>
                </label>

                <label className="text-sm font-medium text-slate-200">
                  <code className="text-teal-100">
                    generation_provider_order
                  </code>
                  <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white">
                    {BABYSEA_PROVIDER_ORDER_DEFAULT}
                  </div>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {coreSchemaDescriptions.generation_provider_order}
                  </span>
                </label>
              </div>
            </div>

            <GenerateSubmitButton
              disabled={!canSubmitGeneration}
              disabledLabel={
                !hasBabySeaApiKey
                  ? 'Generation unavailable'
                  : !hasCreditsForGeneration
                    ? 'Add credits to generate'
                    : undefined
              }
            />
          </form>
        </div>
      </section>

      <section id="recent-generations" className="space-y-4">
        {params.created ? (
          <DismissibleBanner tone="success">
            Generation settled successfully. Latest output appears below.
          </DismissibleBanner>
        ) : null}

        {params.error === 'rate_limit' ? (
          <DismissibleBanner tone="warning">
            Rate limit exceeded. Please wait before generating again.
          </DismissibleBanner>
        ) : null}

        {params.error === 'insufficient_credits' ? (
          <DismissibleBanner tone="warning">
            Insufficient credits. Buy a credit pack before generating.
          </DismissibleBanner>
        ) : null}

        {params.error === 'babysea' ? (
          <DismissibleBanner tone="error">
            BabySea generation failed. Reserved credits were refunded.
          </DismissibleBanner>
        ) : null}

        {params.error === 'configuration' ? (
          <DismissibleBanner tone="warning">
            Generation is temporarily disabled because the server BabySea
            configuration is missing or invalid.
          </DismissibleBanner>
        ) : null}

        {generationsWithAssets.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {generationsWithAssets.map((generation) => (
              <article
                key={generation.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur"
              >
                <div className="flex flex-col gap-3">
                  <div>
                    <CopyableGenerationId
                      generationId={generation.id}
                      showLabel={false}
                      iconOnly
                      className="text-xs text-slate-500"
                    />
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {formatDate(generation.created_at)} · {generation.model}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="inline-flex h-8 items-center rounded-full border border-white/10 px-3 text-xs text-slate-300">
                      {formatCredits(generation.cost_credits)} credits
                    </p>
                    <CopyPromptButton
                      prompt={generation.prompt}
                      iconOnly
                      className="h-8 w-8 shrink-0"
                    />
                  </div>
                </div>

                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-200">
                  {generation.prompt}
                </p>

                {generation.assetUrl ? (
                  <a
                    href={generation.assetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 block overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80"
                  >
                    <div
                      className="h-44 bg-cover bg-center"
                      style={{ backgroundImage: `url(${generation.assetUrl})` }}
                    />
                  </a>
                ) : null}

                {generation.error ? (
                  <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">
                    {generation.error}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
