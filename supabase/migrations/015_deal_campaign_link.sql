alter table deals
  add column if not exists campaign_id uuid references campaigns(id) on delete set null;

create index if not exists deals_campaign_id_idx on deals(campaign_id);
