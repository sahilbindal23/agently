do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'campaign_shortlists_campaign_entity_unique'
  ) then
    alter table campaign_shortlists
      add constraint campaign_shortlists_campaign_entity_unique unique (campaign_id, entity_type, entity_id);
  end if;
end $$;
