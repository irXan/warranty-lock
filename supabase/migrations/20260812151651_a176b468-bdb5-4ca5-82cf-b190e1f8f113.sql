-- 1) Enum for workshop membership role
create type public.workshop_role as enum ('owner', 'staff');

-- 2) Workshops
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  contact_phone text,
  contact_email text,
  address text,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.workshops to authenticated;
grant all on public.workshops to service_role;
alter table public.workshops enable row level security;

-- 3) Members
create table public.workshop_members (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role workshop_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (workshop_id, user_id)
);

grant select, insert, update, delete on public.workshop_members to authenticated;
grant all on public.workshop_members to service_role;
alter table public.workshop_members enable row level security;

-- 4) Helper functions (security definer, avoid recursive RLS)
create or replace function public.is_workshop_member(_user_id uuid, _workshop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workshop_members
    where user_id = _user_id and workshop_id = _workshop_id
  )
$$;

create or replace function public.is_workshop_owner(_user_id uuid, _workshop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workshop_members
    where user_id = _user_id and workshop_id = _workshop_id and role = 'owner'
  )
$$;

create or replace function public.current_workshop_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workshop_id from public.workshop_members
  where user_id = _user_id
  order by case when role = 'owner' then 0 else 1 end, created_at
  limit 1
$$;

grant execute on function public.is_workshop_member(uuid, uuid) to authenticated;
grant execute on function public.is_workshop_owner(uuid, uuid) to authenticated;
grant execute on function public.current_workshop_id(uuid) to authenticated;

-- 5) Policies for workshops / members
create policy workshops_select_member on public.workshops
  for select to authenticated
  using (public.is_workshop_member(auth.uid(), id) or public.has_role(auth.uid(), 'admin'));

create policy workshops_update_owner on public.workshops
  for update to authenticated
  using (public.is_workshop_owner(auth.uid(), id))
  with check (public.is_workshop_owner(auth.uid(), id));

create policy workshops_insert_self on public.workshops
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy members_select_same_workshop on public.workshop_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_workshop_member(auth.uid(), workshop_id));

create policy members_manage_owner on public.workshop_members
  for all to authenticated
  using (public.is_workshop_owner(auth.uid(), workshop_id))
  with check (public.is_workshop_owner(auth.uid(), workshop_id));

-- 6) Tenancy column on receipts
alter table public.receipts add column workshop_id uuid references public.workshops(id) on delete restrict;

insert into public.workshops (name, slug, contact_phone, contact_email)
values ('Warranty Flow Workshop', 'warranty-flow', null, null);

update public.receipts
  set workshop_id = (select id from public.workshops where slug = 'warranty-flow')
  where workshop_id is null;

alter table public.receipts alter column workshop_id set not null;
create index receipts_workshop_id_idx on public.receipts (workshop_id);

-- 7) Allow workshop_id through the immutability trigger only on insert (it is core/immutable)
create or replace function public.enforce_receipt_immutability()
returns trigger
language plpgsql
as $function$
begin
  if old.id is distinct from new.id
     or old.track_id is distinct from new.track_id
     or old.workshop_id is distinct from new.workshop_id
     or old.customer_name is distinct from new.customer_name
     or old.customer_phone is distinct from new.customer_phone
     or old.customer_email is distinct from new.customer_email
     or old.device_model is distinct from new.device_model
     or old.serial_number is distinct from new.serial_number
     or old.issue_description is distinct from new.issue_description
     or old.warranty_days is distinct from new.warranty_days
     or old.created_by is distinct from new.created_by
     or old.created_at is distinct from new.created_at
  then
    raise exception 'Receipt core fields are immutable';
  end if;
  return new;
end;
$function$;

-- 8) Workshop-scoped RLS on receipts
drop policy if exists receipts_admin_select on public.receipts;
drop policy if exists receipts_admin_insert on public.receipts;
drop policy if exists receipts_admin_update on public.receipts;

create policy receipts_admin_select on public.receipts
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') and public.is_workshop_member(auth.uid(), workshop_id));

create policy receipts_admin_insert on public.receipts
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') and public.is_workshop_member(auth.uid(), workshop_id));

create policy receipts_admin_update on public.receipts
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin') and public.is_workshop_member(auth.uid(), workshop_id))
  with check (public.has_role(auth.uid(), 'admin') and public.is_workshop_member(auth.uid(), workshop_id));

-- 9) Workshop-scoped RLS on status_events
drop policy if exists status_admin_select on public.status_events;
drop policy if exists status_admin_insert on public.status_events;

create policy status_admin_select on public.status_events
  for select to authenticated
  using (exists (
    select 1 from public.receipts r
    where r.id = status_events.receipt_id
      and public.has_role(auth.uid(), 'admin')
      and public.is_workshop_member(auth.uid(), r.workshop_id)
  ));

create policy status_admin_insert on public.status_events
  for insert to authenticated
  with check (exists (
    select 1 from public.receipts r
    where r.id = status_events.receipt_id
      and public.has_role(auth.uid(), 'admin')
      and public.is_workshop_member(auth.uid(), r.workshop_id)
  ));

-- 10) updated_at trigger for workshops
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_workshops_updated_at
before update on public.workshops
for each row execute function public.update_updated_at_column();