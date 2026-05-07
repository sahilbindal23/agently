alter table contracts
  add column if not exists file_name text,
  add column if not exists file_type text,
  add column if not exists file_size integer,
  add column if not exists uploaded_by uuid references profiles(id) on delete set null,
  add column if not exists review_status text default 'needs_review' check (review_status in ('needs_review', 'safe_to_accept', 'needs_negotiation', 'blocked'));

create index if not exists contracts_deal_created_idx on contracts(deal_id, created_at desc);
create index if not exists contracts_review_status_idx on contracts(review_status);

insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;
