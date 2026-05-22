-- Preserve BabySea metadata written to generations.output during settlement.
-- The starter stores remote BabySea generation IDs/provider metadata in output so
-- failed or timed-out jobs can be reconciled without exposing API keys.

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
        error = v_error
    where id = p_generation_id;

  return coalesce(v_inserted, false);
end;
$$;

revoke execute on function public.complete_generation(uuid, text) from public, anon, authenticated;
revoke execute on function public.fail_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_generation(uuid, text) to service_role;
grant execute on function public.fail_generation(uuid, text) to service_role;
