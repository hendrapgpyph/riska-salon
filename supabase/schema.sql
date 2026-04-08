-- Riska Salon — jalankan di Supabase SQL Editor (satu kali).
-- Sesuaikan jika skema Anda sudah ada.

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null check (price >= 0)
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  user_id uuid references auth.users (id) on delete set null
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_date date not null default (timezone('utc', now()))::date,
  service_id uuid references public.services (id) on delete set null,
  service_name text not null,
  price numeric not null check (price >= 0),
  keterangan text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transaction_staff (
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  primary key (transaction_id, staff_id)
);

alter table public.services enable row level security;
alter table public.staff enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_staff enable row level security;

create policy "services_select_auth" on public.services
  for select to authenticated using (true);

create policy "staff_select_auth" on public.staff
  for select to authenticated using (true);

create policy "transactions_crud_own" on public.transactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transaction_staff_via_transaction" on public.transaction_staff
  for all to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_staff.transaction_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_staff.transaction_id
        and t.user_id = auth.uid()
    )
  );
