alter table payments
  add column if not exists provider text default 'stripe',
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_signature text,
  add column if not exists provider_payload jsonb;

alter table payments
  drop constraint if exists payments_provider_check;

alter table payments
  add constraint payments_provider_check check (provider in ('stripe', 'razorpay', 'manual'));

create index if not exists payments_provider_idx on payments(provider, status);
create index if not exists payments_razorpay_order_id_idx on payments(razorpay_order_id) where razorpay_order_id is not null;
create index if not exists payments_razorpay_payment_id_idx on payments(razorpay_payment_id) where razorpay_payment_id is not null;
