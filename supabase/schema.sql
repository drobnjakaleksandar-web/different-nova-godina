-- Restoran Different · Nova Godina 2027
-- Pokrenuti jednom u Supabase: SQL Editor -> New query -> nalepiti sve -> Run

create table if not exists public.reservations (
  id          uuid primary key default gen_random_uuid(),
  table_no    int  not null check (table_no between 1 and 36),
  name        text not null check (char_length(name) between 1 and 120),
  phone       text not null default '' check (char_length(phone) <= 40),
  seats       int  not null check (seats between 1 and 12),
  paid        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists reservations_table_idx on public.reservations (table_no);

-- Pristup ima samo server aplikacije (tajni ključ). Bez polisa niko drugi ne može da čita ni piše.
alter table public.reservations enable row level security;

-- Dodavanje uz proveru slobodnih mesta. Zaključava sto dok se proverava,
-- pa dve istovremene prodaje ne mogu da prepune isti sto.
create or replace function public.add_reservation(
  p_table int, p_cap int, p_name text, p_phone text, p_seats int, p_paid boolean
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  used int;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(2027, p_table);
  select coalesce(sum(seats), 0) into used from reservations where table_no = p_table;
  if used + p_seats > p_cap then
    return json_build_object('ok', false, 'free', p_cap - used);
  end if;
  insert into reservations (table_no, name, phone, seats, paid)
  values (p_table, p_name, p_phone, p_seats, p_paid)
  returning id into new_id;
  return json_build_object('ok', true, 'id', new_id);
end;
$$;

revoke execute on function public.add_reservation(int, int, text, text, int, boolean) from public, anon, authenticated;
grant execute on function public.add_reservation(int, int, text, text, int, boolean) to service_role;
