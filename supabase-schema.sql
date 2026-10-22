-- Execute este arquivo no SQL Editor do Supabase.
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(), name text not null, code text not null unique,
  category text not null, location text not null, status text not null default 'available' check (status in ('available', 'borrowed')),
  notes text, quantity_total integer not null default 1 check (quantity_total > 0), quantity_available integer not null default 1 check (quantity_available >= 0), created_at timestamptz not null default now()
);
alter table public.equipment add column if not exists quantity_total integer not null default 1;
alter table public.equipment add column if not exists quantity_available integer not null default 1;
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(), equipment_id uuid not null references public.equipment(id) on delete cascade,
  person_name text not null, taken_at timestamptz not null default now(), expected_return_at timestamptz not null, returned_at timestamptz, quantity integer not null default 1 check (quantity > 0)
);
alter table public.loans add column if not exists quantity integer not null default 1;
create table if not exists public.printer_reservations (
  id uuid primary key default gen_random_uuid(), student_name text not null, student_email text not null,
  teacher_name text not null, teacher_email text not null, reservation_date date not null, start_time time not null, end_time time not null,
  purpose text not null, status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')), created_at timestamptz not null default now()
);
alter table public.equipment enable row level security;
alter table public.loans enable row level security;
alter table public.printer_reservations enable row level security;
drop policy if exists "public can read equipment" on public.equipment;
drop policy if exists "public can insert equipment" on public.equipment;
drop policy if exists "public can update equipment" on public.equipment;
drop policy if exists "public can read loans" on public.loans;
drop policy if exists "public can insert loans" on public.loans;
drop policy if exists "public can update loans" on public.loans;
drop policy if exists "public can read reservations" on public.printer_reservations;
drop policy if exists "public can insert reservations" on public.printer_reservations;
drop policy if exists "public can update reservations" on public.printer_reservations;
create policy "public can read equipment" on public.equipment for select using (true);
create policy "public can insert equipment" on public.equipment for insert with check (true);
create policy "public can update equipment" on public.equipment for update using (true);
create policy "public can read loans" on public.loans for select using (true);
create policy "public can insert loans" on public.loans for insert with check (true);
create policy "public can update loans" on public.loans for update using (true);
create policy "public can read reservations" on public.printer_reservations for select using (true);
create policy "public can insert reservations" on public.printer_reservations for insert with check (true);
create policy "public can update reservations" on public.printer_reservations for update using (true);
