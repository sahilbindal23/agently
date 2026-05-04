alter table app_notifications
  add column if not exists category text default 'workflow';

create table if not exists notification_preferences (
  profile_id uuid primary key references profiles(id) on delete cascade,
  delivery_mode text check (delivery_mode in ('in_app_only', 'important_only', 'daily_digest', 'paused')) default 'in_app_only',
  enabled_categories text[] default array['offer', 'payment', 'contract', 'delivery', 'message', 'verification', 'campaign', 'workflow'],
  digest_hour integer check (digest_hour between 0 and 23) default 9,
  email_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table notification_preferences enable row level security;

drop policy if exists "users manage own notification preferences" on notification_preferences;
create policy "users manage own notification preferences" on notification_preferences
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "admins read notification preferences" on notification_preferences;
create policy "admins read notification preferences" on notification_preferences
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
