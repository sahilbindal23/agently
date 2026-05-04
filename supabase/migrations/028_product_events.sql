create table if not exists product_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  role text,
  event_name text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_events_event_created_idx on product_events(event_name, created_at desc);
create index if not exists product_events_profile_created_idx on product_events(profile_id, created_at desc);
create index if not exists product_events_entity_idx on product_events(entity_type, entity_id);
create index if not exists product_events_metadata_gin_idx on product_events using gin (metadata);

alter table product_events enable row level security;

drop policy if exists "Admins can manage product events" on product_events;
create policy "Admins can manage product events"
  on product_events
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

drop policy if exists "Users can read their own product events" on product_events;
create policy "Users can read their own product events"
  on product_events
  for select
  using (profile_id = auth.uid());
