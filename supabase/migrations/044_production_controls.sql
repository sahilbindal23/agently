-- Production controls: audit logs, rate-limit ledger, demo data flags, and
-- stricter internal-table visibility.

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references profiles(id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text,
  entity_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_created_idx on audit_logs(actor_profile_id, created_at desc);
create index if not exists audit_logs_action_created_idx on audit_logs(action, created_at desc);
create index if not exists audit_logs_entity_idx on audit_logs(entity_type, entity_id);

alter table audit_logs enable row level security;

drop policy if exists "admins read audit logs" on audit_logs;
create policy "admins read audit logs" on audit_logs
  for select using (public.is_admin());

drop policy if exists "admins write audit logs" on audit_logs;
create policy "admins write audit logs" on audit_logs
  for insert with check (public.is_admin());

create table if not exists app_rate_limits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  key text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, key, window_start)
);

create index if not exists app_rate_limits_key_window_idx on app_rate_limits(key, window_start desc);

alter table app_rate_limits enable row level security;

drop policy if exists "admins manage app rate limits" on app_rate_limits;
create policy "admins manage app rate limits" on app_rate_limits
  for all using (public.is_admin())
  with check (public.is_admin());

create or replace function public.touch_rate_limit(
  rate_key text,
  max_count integer,
  window_seconds integer default 3600,
  rate_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  window_epoch numeric;
  window_start_at timestamptz;
  next_count integer;
begin
  if current_profile_id is null then
    return jsonb_build_object('allowed', false, 'count', 0, 'limit', max_count, 'reason', 'not_authenticated');
  end if;

  window_epoch := floor(extract(epoch from now()) / greatest(window_seconds, 1)) * greatest(window_seconds, 1);
  window_start_at := to_timestamp(window_epoch);

  insert into app_rate_limits (profile_id, key, window_start, count, metadata, updated_at)
  values (current_profile_id, rate_key, window_start_at, 1, rate_metadata, now())
  on conflict (profile_id, key, window_start)
  do update set
    count = app_rate_limits.count + 1,
    metadata = app_rate_limits.metadata || excluded.metadata,
    updated_at = now()
  returning count into next_count;

  return jsonb_build_object(
    'allowed', next_count <= max_count,
    'count', next_count,
    'limit', max_count,
    'window_start', window_start_at,
    'window_seconds', window_seconds
  );
end;
$$;

grant execute on function public.touch_rate_limit(text, integer, integer, jsonb) to authenticated;

-- Demo-data flags let production separate seed/sample records from real
-- onboarding records without deleting useful investor-demo content.
alter table profiles add column if not exists is_demo boolean not null default false;
alter table creators add column if not exists is_demo boolean not null default false;
alter table freelancers add column if not exists is_demo boolean not null default false;
alter table brands add column if not exists is_demo boolean not null default false;
alter table campaigns add column if not exists is_demo boolean not null default false;
alter table deals add column if not exists is_demo boolean not null default false;
alter table freelancer_projects add column if not exists is_demo boolean not null default false;

update profiles set is_demo = true where lower(email) like '%@agently.demo';
update creators set is_demo = true where profile_id in (select id from profiles where is_demo);
update freelancers set is_demo = true where profile_id in (select id from profiles where is_demo);
update brands set is_demo = true where lower(contact_email) like '%@agently.demo' or status like 'demo%';
update campaigns set is_demo = true where profile_id in (select id from profiles where is_demo);
update deals set is_demo = true where creator_id in (select id from creators where is_demo) or brand_id in (select id from brands where is_demo);
update freelancer_projects set is_demo = true where freelancer_id in (select id from freelancers where is_demo) or brand_id in (select id from brands where is_demo);

create index if not exists profiles_is_demo_idx on profiles(is_demo);
create index if not exists creators_is_demo_idx on creators(is_demo);
create index if not exists freelancers_is_demo_idx on freelancers(is_demo);
create index if not exists brands_is_demo_idx on brands(is_demo);
create index if not exists campaigns_is_demo_idx on campaigns(is_demo);
create index if not exists deals_is_demo_idx on deals(is_demo);
create index if not exists freelancer_projects_is_demo_idx on freelancer_projects(is_demo);

-- Internal engine data should remain visible only to admins unless a specific
-- user-facing view is intentionally built later. The underlying migrations
-- already enable admin-only RLS; this migration avoids assuming every optional
-- engine table exists in all environments.
alter table product_events enable row level security;

-- Product events are telemetry. Users can write their own client-safe events,
-- but reads stay scoped to own rows or admin views.
drop policy if exists "Users can create their own product events" on product_events;
create policy "Users can create their own product events"
  on product_events for insert
  with check (profile_id = auth.uid());

drop policy if exists "Users can read their own product events" on product_events;
create policy "Users can read their own product events"
  on product_events for select
  using (profile_id = auth.uid());

drop policy if exists "Admins can manage product events" on product_events;
create policy "Admins can manage product events"
  on product_events for all
  using (public.is_admin())
  with check (public.is_admin());
