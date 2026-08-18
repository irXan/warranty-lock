create type public.claim_status as enum ('active', 'released');

create table public.receipt_claims (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.claim_status not null default 'active',
  claimed_at timestamptz not null default now(),
  released_at timestamptz
);

create unique index receipt_claims_one_active_per_receipt
  on public.receipt_claims (receipt_id) where status = 'active';
create unique index receipt_claims_unique_active_user
  on public.receipt_claims (receipt_id, user_id) where status = 'active';
create index receipt_claims_user_idx on public.receipt_claims (user_id);

grant select on public.receipt_claims to authenticated;
grant all on public.receipt_claims to service_role;

alter table public.receipt_claims enable row level security;

create policy receipt_claims_select_own on public.receipt_claims
  for select to authenticated
  using (user_id = auth.uid());

create policy receipt_claims_select_workshop on public.receipt_claims
  for select to authenticated
  using (exists (
    select 1 from public.receipts r
    where r.id = receipt_claims.receipt_id
      and app_private.is_workshop_member(auth.uid(), r.workshop_id)
  ));

create table public.claim_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index claim_attempts_user_idx on public.claim_attempts (user_id, created_at desc);
create index claim_attempts_ip_idx on public.claim_attempts (ip_hash, created_at desc);

grant all on public.claim_attempts to service_role;

alter table public.claim_attempts enable row level security;

create or replace function app_private.has_active_claim(_user_id uuid, _receipt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.receipt_claims c
    where c.user_id = _user_id
      and c.receipt_id = _receipt_id
      and c.status = 'active'
  )
$$;

revoke all on function app_private.has_active_claim(uuid, uuid) from public;
revoke all on function app_private.has_active_claim(uuid, uuid) from anon;
grant execute on function app_private.has_active_claim(uuid, uuid) to authenticated;
grant execute on function app_private.has_active_claim(uuid, uuid) to service_role;

drop policy if exists receipts_customer_select on public.receipts;
create policy receipts_claimant_select on public.receipts
  for select to authenticated
  using (app_private.has_active_claim(auth.uid(), id));

drop policy if exists status_customer_select on public.status_events;
create policy status_claimant_select on public.status_events
  for select to authenticated
  using (app_private.has_active_claim(auth.uid(), receipt_id));

create policy repair_photos_select_claimant on public.repair_photos
  for select to authenticated
  using (app_private.has_active_claim(auth.uid(), receipt_id));