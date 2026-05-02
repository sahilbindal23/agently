create table if not exists tester_feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  role text,
  page_path text,
  workflow text,
  rating integer check (rating between 1 and 5),
  what_worked text,
  what_was_confusing text,
  missing_feature text,
  would_use text,
  created_at timestamptz default now()
);

alter table tester_feedback enable row level security;

create policy "users create own tester feedback" on tester_feedback
  for insert with check (auth.uid() = profile_id);

create policy "admins read tester feedback" on tester_feedback
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
