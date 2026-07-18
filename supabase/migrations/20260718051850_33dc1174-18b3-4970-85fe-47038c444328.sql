
-- Enums
create type public.app_role as enum ('admin', 'customer');
create type public.repair_status as enum ('Received', 'Diagnosing', 'In Repair', 'Ready for Pickup', 'Delivered');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- has_role security-definer function (avoids recursive RLS on user_roles)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, anon;

-- Auto-create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Profiles policies
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- user_roles policies
create policy "user_roles_select_own_or_admin" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "user_roles_admin_manage" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- receipts (immutable core)
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  track_id text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  device_model text not null,
  serial_number text not null,
  issue_description text not null,
  warranty_days int not null default 90,
  current_status public.repair_status not null default 'Received',
  delivered_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.receipts to authenticated;
grant all on public.receipts to service_role;
alter table public.receipts enable row level security;

-- Immutability trigger: only current_status and delivered_at may change
create or replace function public.enforce_receipt_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.id is distinct from new.id
     or old.track_id is distinct from new.track_id
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
$$;

create trigger receipts_immutable
before update on public.receipts
for each row execute function public.enforce_receipt_immutability();

-- receipts policies
create policy "receipts_admin_select" on public.receipts
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "receipts_customer_select" on public.receipts
  for select to authenticated
  using (
    customer_email is not null
    and lower(customer_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
create policy "receipts_admin_insert" on public.receipts
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "receipts_admin_update" on public.receipts
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- status_events (append-only)
create table public.status_events (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  status public.repair_status not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
grant select, insert on public.status_events to authenticated;
grant all on public.status_events to service_role;
alter table public.status_events enable row level security;

create index status_events_receipt_created_idx
  on public.status_events (receipt_id, created_at);

-- Sync current_status + delivered_at when a status event is inserted
create or replace function public.sync_receipt_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.receipts
    set current_status = new.status,
        delivered_at = case
          when new.status = 'Delivered' and delivered_at is null then new.created_at
          else delivered_at
        end
    where id = new.receipt_id;
  return new;
end;
$$;

create trigger status_events_sync
after insert on public.status_events
for each row execute function public.sync_receipt_status();

-- Seed initial 'Received' event on receipt creation
create or replace function public.seed_initial_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.status_events (receipt_id, status, created_by)
  values (new.id, 'Received', new.created_by);
  return new;
end;
$$;

create trigger receipts_seed_status
after insert on public.receipts
for each row execute function public.seed_initial_status();

-- status_events policies
create policy "status_admin_select" on public.status_events
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "status_customer_select" on public.status_events
  for select to authenticated
  using (
    exists (
      select 1 from public.receipts r
      where r.id = receipt_id
        and r.customer_email is not null
        and lower(r.customer_email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );
create policy "status_admin_insert" on public.status_events
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- Public tracking RPC — returns one receipt + status history by Track ID
create or replace function public.get_receipt_by_track_id(_track_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'track_id', r.track_id,
    'customer_name', r.customer_name,
    'customer_phone', r.customer_phone,
    'device_model', r.device_model,
    'serial_number', r.serial_number,
    'issue_description', r.issue_description,
    'warranty_days', r.warranty_days,
    'current_status', r.current_status,
    'delivered_at', r.delivered_at,
    'created_at', r.created_at,
    'status_history', coalesce((
      select jsonb_agg(
        jsonb_build_object('status', s.status, 'updated_at', s.created_at)
        order by s.created_at
      )
      from public.status_events s where s.receipt_id = r.id
    ), '[]'::jsonb)
  )
  from public.receipts r
  where upper(r.track_id) = upper(trim(_track_id))
  limit 1
$$;
grant execute on function public.get_receipt_by_track_id(text) to anon, authenticated;
