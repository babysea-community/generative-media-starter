-- Configure the starter for server-managed BabySea execution.
-- The app reads BABYSEA_API_KEY from server environment variables and never
-- stores user-supplied provider credentials in Supabase.

alter table public.generations
  drop constraint if exists generations_provider_check;

-- The starter records BabySea as the orchestrator. Provider routing is resolved
-- by BabySea from the model schema, and returned execution metadata remains in
-- generations.output.
update public.generations
  set provider = 'babysea'
  where provider <> 'babysea';

alter table public.generations
  add constraint generations_provider_check
  check (provider = 'babysea');

comment on column public.generations.provider is 'Execution orchestrator. The starter records only babysea; model-schema provider routing metadata is stored in generations.output.';
