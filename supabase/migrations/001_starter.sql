-- Generative Media Starter schema
-- Supabase owns auth-linked data, credits, ledger integrity, and storage access.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits numeric(12,3) not null default 0 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'babysea'),
  model text not null,
  prompt text not null check (length(trim(prompt)) > 0),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  cost_credits numeric(12,3) not null default 0.005 check (cost_credits > 0),
  storage_path text,
  remote_url text,
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete set null,
  type text not null check (type in ('grant', 'reserve', 'charge', 'refund')),
  amount numeric(12,3) not null,
  stripe_event_id text,
  description text,
  created_at timestamptz not null default now(),
  constraint credit_ledger_amount_matches_type check (
    (type in ('grant', 'refund') and amount > 0)
    or (type = 'reserve' and amount < 0)
    or (type = 'charge' and amount = 0)
  )
);

create table if not exists public.stripe_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processed_stripe_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

create index if not exists generations_user_created_at_idx
  on public.generations (user_id, created_at desc);

create index if not exists credit_ledger_user_created_at_idx
  on public.credit_ledger (user_id, created_at desc);

create unique index if not exists credit_ledger_grant_event_unique_idx
  on public.credit_ledger (stripe_event_id)
  where type = 'grant' and stripe_event_id is not null;

create unique index if not exists credit_ledger_generation_type_unique_idx
  on public.credit_ledger (generation_id, type)
  where generation_id is not null and type in ('reserve', 'charge', 'refund');

drop trigger if exists set_credit_balances_updated_at on public.credit_balances;
create trigger set_credit_balances_updated_at
  before update on public.credit_balances
  for each row execute function public.set_updated_at();

drop trigger if exists set_generations_updated_at on public.generations;
create trigger set_generations_updated_at
  before update on public.generations
  for each row execute function public.set_updated_at();

drop trigger if exists set_stripe_customers_updated_at on public.stripe_customers;
create trigger set_stripe_customers_updated_at
  before update on public.stripe_customers
  for each row execute function public.set_updated_at();

create or replace function public.grant_paid_credits(
  p_user_id uuid,
  p_amount numeric,
  p_stripe_event_id text,
  p_description text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_amount <= 0 then
    raise exception 'p_amount must be positive';
  end if;

  if p_stripe_event_id is null or length(trim(p_stripe_event_id)) = 0 then
    raise exception 'p_stripe_event_id is required';
  end if;

  insert into public.credit_ledger (
    user_id,
    type,
    amount,
    stripe_event_id,
    description
  )
  values (
    p_user_id,
    'grant',
    p_amount,
    p_stripe_event_id,
    coalesce(p_description, 'Stripe credit grant')
  )
  on conflict do nothing
  returning true into v_inserted;

  if coalesce(v_inserted, false) = false then
    return false;
  end if;

  insert into public.credit_balances (user_id, credits)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set credits = public.credit_balances.credits + excluded.credits;

  return true;
end;
$$;

drop function if exists public.reserve_generation_credits(uuid, numeric);

create or replace function public.reserve_generation_credits(
  p_generation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount numeric;
  v_reserved boolean;
  v_inserted boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_generation_id is null then
    raise exception 'p_generation_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_generation_id::text)::bigint);

  select cost_credits into v_amount
  from public.generations
  where id = p_generation_id and user_id = v_user_id;

  if v_amount is null then
    raise exception 'generation not found';
  end if;

  if v_amount <= 0 then
    raise exception 'generation cost must be positive';
  end if;

  if exists (
    select 1 from public.credit_ledger
    where generation_id = p_generation_id and type = 'reserve'
  ) then
    return true;
  end if;

  insert into public.credit_balances (user_id, credits)
  values (v_user_id, 0)
  on conflict (user_id) do nothing;

  update public.credit_balances
    set credits = credits - v_amount
    where user_id = v_user_id and credits >= v_amount
    returning true into v_reserved;

  if coalesce(v_reserved, false) = false then
    return false;
  end if;

  insert into public.credit_ledger (
    user_id,
    generation_id,
    type,
    amount,
    description
  )
  values (
    v_user_id,
    p_generation_id,
    'reserve',
    -v_amount,
    'Reserved credits before provider dispatch'
  )
  on conflict do nothing
  returning true into v_inserted;

  if coalesce(v_inserted, false) = false then
    update public.credit_balances
      set credits = credits + v_amount
      where user_id = v_user_id;
  end if;

  return true;
end;
$$;

create or replace function public.charge_generation_credits(
  p_generation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_generation_id is null then
    raise exception 'p_generation_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_generation_id::text)::bigint);

  if not exists (
    select 1 from public.credit_ledger
    where user_id = v_user_id
      and generation_id = p_generation_id
      and type = 'reserve'
  ) then
    raise exception 'reservation not found';
  end if;

  if exists (
    select 1 from public.credit_ledger
    where user_id = v_user_id
      and generation_id = p_generation_id
      and type = 'refund'
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.credit_ledger
    where user_id = v_user_id
      and generation_id = p_generation_id
      and type = 'charge'
  ) then
    return false;
  end if;

  insert into public.credit_ledger (
    user_id,
    generation_id,
    type,
    amount,
    description
  )
  values (
    v_user_id,
    p_generation_id,
    'charge',
    0,
    'Confirmed successful generation; reservation remains spent'
  )
  on conflict do nothing
  returning true into v_inserted;

  return coalesce(v_inserted, false);
end;
$$;

drop function if exists public.refund_generation_credits(uuid, numeric);

create or replace function public.refund_generation_credits(
  p_generation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted boolean;
  v_refund_amount numeric;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_generation_id is null then
    raise exception 'p_generation_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_generation_id::text)::bigint);

  if exists (
    select 1 from public.credit_ledger
    where user_id = v_user_id
      and generation_id = p_generation_id
      and type = 'charge'
  ) then
    return false;
  end if;

  select abs(amount) into v_refund_amount
  from public.credit_ledger
  where user_id = v_user_id
    and generation_id = p_generation_id
    and type = 'reserve';

  if v_refund_amount is null then
    raise exception 'reservation not found';
  end if;

  insert into public.credit_ledger (
    user_id,
    generation_id,
    type,
    amount,
    description
  )
  values (
    v_user_id,
    p_generation_id,
    'refund',
    v_refund_amount,
    'Returned reserved credits after provider failure'
  )
  on conflict do nothing
  returning true into v_inserted;

  if coalesce(v_inserted, false) then
    update public.credit_balances
      set credits = credits + v_refund_amount
      where user_id = v_user_id;
  end if;

  return coalesce(v_inserted, false);
end;
$$;

create or replace function public.complete_generation(
  p_generation_id uuid,
  p_storage_path text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_inserted boolean;
begin
  if p_generation_id is null then
    raise exception 'p_generation_id is required';
  end if;

  if p_storage_path is null or length(trim(p_storage_path)) = 0 then
    raise exception 'p_storage_path is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_generation_id::text)::bigint);

  select user_id into v_user_id
  from public.generations
  where id = p_generation_id
  for update;

  if v_user_id is null then
    raise exception 'generation not found';
  end if;

  if not exists (
    select 1 from public.credit_ledger
    where user_id = v_user_id
      and generation_id = p_generation_id
      and type = 'reserve'
  ) then
    raise exception 'reservation not found';
  end if;

  if exists (
    select 1 from public.credit_ledger
    where user_id = v_user_id
      and generation_id = p_generation_id
      and type = 'refund'
  ) then
    raise exception 'generation already refunded';
  end if;

  insert into public.credit_ledger (
    user_id,
    generation_id,
    type,
    amount,
    description
  )
  values (
    v_user_id,
    p_generation_id,
    'charge',
    0,
    'Confirmed successful generation; reservation remains spent'
  )
  on conflict do nothing
  returning true into v_inserted;

  update public.generations
    set status = 'succeeded',
        storage_path = p_storage_path,
        remote_url = null,
        output = null,
        error = null
    where id = p_generation_id;

  return coalesce(v_inserted, false);
end;
$$;

create or replace function public.fail_generation(
  p_generation_id uuid,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_inserted boolean;
  v_refund_amount numeric;
  v_error text := coalesce(nullif(trim(p_error), ''), 'Generation failed');
begin
  if p_generation_id is null then
    raise exception 'p_generation_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_generation_id::text)::bigint);

  select user_id into v_user_id
  from public.generations
  where id = p_generation_id
  for update;

  if v_user_id is null then
    raise exception 'generation not found';
  end if;

  if exists (
    select 1 from public.credit_ledger
    where user_id = v_user_id
      and generation_id = p_generation_id
      and type = 'charge'
  ) then
    raise exception 'generation already charged';
  end if;

  select abs(amount) into v_refund_amount
  from public.credit_ledger
  where user_id = v_user_id
    and generation_id = p_generation_id
    and type = 'reserve';

  if v_refund_amount is not null then
    insert into public.credit_ledger (
      user_id,
      generation_id,
      type,
      amount,
      description
    )
    values (
      v_user_id,
      p_generation_id,
      'refund',
      v_refund_amount,
      'Returned reserved credits after provider failure'
    )
    on conflict do nothing
    returning true into v_inserted;

    if coalesce(v_inserted, false) then
      update public.credit_balances
        set credits = credits + v_refund_amount
        where user_id = v_user_id;
    end if;
  end if;

  update public.generations
    set status = 'failed',
        storage_path = null,
        remote_url = null,
        output = null,
        error = v_error
    where id = p_generation_id;

  return coalesce(v_inserted, false);
end;
$$;

alter table public.credit_balances enable row level security;
alter table public.generations enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.processed_stripe_events enable row level security;

drop policy if exists credit_balances_select_own on public.credit_balances;
create policy credit_balances_select_own
  on public.credit_balances for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists generations_select_own on public.generations;
create policy generations_select_own
  on public.generations for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists generations_insert_own on public.generations;

drop policy if exists generations_update_own on public.generations;

drop policy if exists credit_ledger_select_own on public.credit_ledger;
create policy credit_ledger_select_own
  on public.credit_ledger for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists stripe_customers_select_own on public.stripe_customers;
create policy stripe_customers_select_own
  on public.stripe_customers for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists stripe_customers_insert_own on public.stripe_customers;

drop policy if exists stripe_customers_update_own on public.stripe_customers;

-- No direct authenticated mutation policies for generations, stripe_customers,
-- processed_stripe_events, or generated media storage.
-- Trusted server actions and webhooks write them with the service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-media',
  'generated-media',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists generated_media_select_own on storage.objects;
create policy generated_media_select_own
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'generated-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists generated_media_insert_own on storage.objects;

drop policy if exists generated_media_update_own on storage.objects;

comment on table public.credit_balances is 'Current spendable credits per authenticated user.';
comment on table public.credit_ledger is 'Immutable credit events. amount is signed balance delta: grant/refund positive, reserve negative, charge zero.';
comment on table public.generations is 'Minimal generative-media job records for the starter dashboard.';

revoke execute on function public.set_updated_at() from public, anon, authenticated;

revoke execute on function public.grant_paid_credits(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.grant_paid_credits(uuid, numeric, text, text) to service_role;

revoke execute on function public.reserve_generation_credits(uuid) from public, anon;
revoke execute on function public.charge_generation_credits(uuid) from public, anon, authenticated;
revoke execute on function public.refund_generation_credits(uuid) from public, anon, authenticated;
revoke execute on function public.complete_generation(uuid, text) from public, anon, authenticated;
revoke execute on function public.fail_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_generation_credits(uuid) to authenticated;
grant execute on function public.complete_generation(uuid, text) to service_role;
grant execute on function public.fail_generation(uuid, text) to service_role;
