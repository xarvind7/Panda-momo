do $$
declare t text;
begin
  foreach t in array array['menu_items','orders','calls','reviews','stock','meta'] loop
    execute format('create table if not exists public.%I (id text primary key, data jsonb not null)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "demo_all" on public.%I', t);
    execute format('create policy "demo_all" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;
