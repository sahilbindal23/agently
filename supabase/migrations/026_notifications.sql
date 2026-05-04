create table if not exists app_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  dedupe_key text not null,
  title text not null,
  body text,
  href text,
  cta text,
  severity text check (severity in ('high', 'medium', 'low', 'info')) default 'info',
  group_name text,
  entity_type text,
  entity_id uuid,
  status text check (status in ('unread', 'read', 'dismissed')) default 'unread',
  created_at timestamptz default now(),
  read_at timestamptz,
  dismissed_at timestamptz
);

create unique index if not exists app_notifications_profile_dedupe_key
  on app_notifications(profile_id, dedupe_key);

create index if not exists app_notifications_profile_status_idx
  on app_notifications(profile_id, status, created_at desc);

alter table app_notifications enable row level security;

drop policy if exists "users read own app notifications" on app_notifications;
create policy "users read own app notifications" on app_notifications
  for select using (profile_id = auth.uid());

drop policy if exists "users update own app notifications" on app_notifications;
create policy "users update own app notifications" on app_notifications
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "admins manage app notifications" on app_notifications;
create policy "admins manage app notifications" on app_notifications
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
