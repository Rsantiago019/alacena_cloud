-- ==========================================================================
-- ALACENA — esquema de base de datos
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query
-- ==========================================================================

create table if not exists public.productos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  categoria     text not null default 'Otros',
  cantidad      numeric not null default 0 check (cantidad >= 0),
  unidad        text not null default 'unidades',
  stock_minimo  numeric not null default 0 check (stock_minimo >= 0),
  precio        numeric,
  fecha_compra  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.productos is 'Inventario de productos de la despensa del hogar';

create index if not exists productos_categoria_idx on public.productos (categoria);
create index if not exists productos_nombre_idx on public.productos (nombre);

-- --------------------------------------------------------------------------
-- Trigger: mantiene updated_at al día en cada UPDATE
-- --------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists productos_set_updated_at on public.productos;
create trigger productos_set_updated_at
  before update on public.productos
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- Row Level Security
-- Esta app es de uso personal (sin login), por lo que se habilita acceso
-- completo con la clave "anon". Si en el futuro sumás autenticación,
-- reemplazá estas políticas por reglas basadas en auth.uid().
-- --------------------------------------------------------------------------
alter table public.productos enable row level security;

drop policy if exists "Acceso completo anon" on public.productos;
create policy "Acceso completo anon"
  on public.productos
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- --------------------------------------------------------------------------
-- Vista opcional: productos en stock bajo (útil para dashboards o cron jobs)
-- --------------------------------------------------------------------------
create or replace view public.productos_stock_bajo as
  select * from public.productos
  where cantidad <= stock_minimo
  order by (cantidad - stock_minimo) asc;
