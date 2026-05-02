alter table deals
  add column if not exists offer_status text default 'submitted',
  add column if not exists talent_response text,
  add column if not exists responded_at timestamptz;
