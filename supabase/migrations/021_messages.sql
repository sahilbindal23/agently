create table if not exists message_threads (
  id uuid primary key default gen_random_uuid(),
  subject text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists message_thread_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references message_threads(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (thread_id, profile_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references message_threads(id) on delete cascade,
  sender_profile_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists message_thread_participants_profile_idx on message_thread_participants(profile_id);
create index if not exists messages_thread_idx on messages(thread_id, created_at);

alter table message_threads enable row level security;
alter table message_thread_participants enable row level security;
alter table messages enable row level security;

create policy "admins manage message threads" on message_threads
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "participants read message threads" on message_threads
  for select using (exists (
    select 1 from message_thread_participants mtp
    where mtp.thread_id = message_threads.id
      and mtp.profile_id = auth.uid()
  ));

create policy "admins manage message participants" on message_thread_participants
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "participants read message participants" on message_thread_participants
  for select using (exists (
    select 1 from message_thread_participants mtp
    where mtp.thread_id = message_thread_participants.thread_id
      and mtp.profile_id = auth.uid()
  ));

create policy "admins manage messages" on messages
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "participants read messages" on messages
  for select using (exists (
    select 1 from message_thread_participants mtp
    where mtp.thread_id = messages.thread_id
      and mtp.profile_id = auth.uid()
  ));
