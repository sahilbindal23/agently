alter table message_threads
  add column if not exists context_type text default 'general',
  add column if not exists context_id uuid;

alter table message_thread_participants
  add column if not exists last_read_at timestamptz;

create index if not exists message_threads_context_idx on message_threads(context_type, context_id);
create index if not exists messages_unread_idx on messages(thread_id, sender_profile_id, created_at);
