-- Run this entire file once in the Supabase SQL Editor. It is safe to rerun.
-- No existing application data, tables, users or Storage objects are deleted.
begin;

create table if not exists public.buildflow_snapshots (
  user_id uuid primary key references auth.users(id),
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint buildflow_payload_v1 check (coalesce(
    (payload ->> 'version') = '1'
    and jsonb_typeof(payload -> 'construction') = 'object'
    and jsonb_typeof(payload #> '{construction,projects}') = 'array'
    and jsonb_typeof(payload #> '{construction,trades}') = 'array'
    and jsonb_typeof(payload #> '{construction,issues}') = 'array'
    and jsonb_typeof(payload -> 'library') = 'array'
    and jsonb_typeof(payload -> 'quotes') = 'object'
    and jsonb_typeof(payload -> 'equipmentQuotes') = 'object'
  , false))
);
alter table public.buildflow_snapshots enable row level security;
revoke all on public.buildflow_snapshots from public, anon, authenticated;
grant select on public.buildflow_snapshots to authenticated;

drop policy if exists buildflow_read_own_snapshot on public.buildflow_snapshots;
create policy buildflow_read_own_snapshot on public.buildflow_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);

-- The function uses auth.uid(), never a caller-supplied owner ID.
-- Browser roles cannot bypass the revision check with direct INSERT/UPDATE/DELETE.
create or replace function public.buildflow_save_snapshot(p_payload jsonb, p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  saved_revision bigint;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not coalesce(
    jsonb_typeof(p_payload) = 'object'
    and p_payload ->> 'version' = '1'
    and jsonb_typeof(p_payload #> '{construction,projects}') = 'array'
    and jsonb_typeof(p_payload #> '{construction,trades}') = 'array'
    and jsonb_typeof(p_payload #> '{construction,issues}') = 'array'
    and jsonb_typeof(p_payload -> 'library') = 'array'
    and jsonb_typeof(p_payload #> '{quotes,items}') = 'array'
    and jsonb_typeof(p_payload #> '{quotes,vendors}') = 'array'
    and jsonb_typeof(p_payload #> '{equipmentQuotes,items}') = 'array'
    and jsonb_typeof(p_payload #> '{equipmentQuotes,vendors}') = 'array', false
  ) then raise exception 'Invalid BuildFlow snapshot'; end if;

  if p_expected_revision is null then
    insert into public.buildflow_snapshots(user_id,payload)
      values(caller,p_payload) on conflict (user_id) do nothing
      returning revision into saved_revision;
  else
    update public.buildflow_snapshots
      set payload=p_payload, revision=revision+1, updated_at=now()
      where user_id=caller and revision=p_expected_revision
      returning revision into saved_revision;
  end if;
  if saved_revision is null then
    raise exception 'BF_REVISION_CONFLICT' using errcode = '40001';
  end if;
  return saved_revision;
end;
$$;
revoke all on function public.buildflow_save_snapshot(jsonb,bigint) from public, anon;
grant execute on function public.buildflow_save_snapshot(jsonb,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
