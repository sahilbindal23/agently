insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do update set public = true;

alter table creators
  add column if not exists image_url text;

alter table freelancers
  add column if not exists image_url text;

alter table brands
  add column if not exists image_url text;
