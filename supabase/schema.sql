-- =====================================================================
-- Votación de disfraces de Halloween — esquema de Supabase
-- Pegar TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Antes de correrlo, reemplazá el email de la última sección por el
-- email con el que vas a entrar como anfitrión.
-- =====================================================================

-- ---------- Tablas ----------

-- Emails que pueden administrar (el anfitrión).
create table public.admins (
  email text primary key
);

-- Una sola fila con el estado de la votación.
create table public.settings (
  id int primary key default 1 check (id = 1),
  status text not null default 'preparando'
    check (status in ('preparando', 'abierta', 'cerrada'))
);
insert into public.settings (id) values (1);

create table public.costumes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  photo_path text not null,
  created_at timestamptz not null default now()
);

-- Un voto por dispositivo: voter_token es un ID guardado en el navegador del invitado.
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  voter_token uuid not null unique,
  voter_name text not null check (char_length(voter_name) between 1 and 60),
  first_id uuid references public.costumes (id) on delete set null,
  second_id uuid references public.costumes (id) on delete set null,
  third_id uuid references public.costumes (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Funciones ----------

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- Única forma en que un invitado puede votar. Valida todo y es atómica:
-- si llegan 100 votos a la vez, cada uno se guarda una sola vez.
create or replace function public.submit_vote(
  p_token uuid,
  p_name text,
  p_first uuid,
  p_second uuid,
  p_third uuid
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
  v_found int;
begin
  select status into v_status from public.settings where id = 1;
  if v_status is distinct from 'abierta' then
    return 'cerrada';
  end if;

  p_name := btrim(coalesce(p_name, ''));
  if p_token is null or p_name = '' or char_length(p_name) > 60 then
    return 'invalido';
  end if;

  if p_first is null or p_second is null or p_third is null
     or p_first = p_second or p_first = p_third or p_second = p_third then
    return 'invalido';
  end if;

  select count(*) into v_found
  from public.costumes
  where id in (p_first, p_second, p_third);
  if v_found <> 3 then
    return 'invalido';
  end if;

  insert into public.votes (voter_token, voter_name, first_id, second_id, third_id)
  values (p_token, p_name, p_first, p_second, p_third);
  return 'ok';
exception
  when unique_violation then
    return 'ya_votaste';
end;
$$;

create or replace function public.has_voted(p_token uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.votes where voter_token = p_token);
$$;

-- Ranking ponderado: 1° = 3 pts, 2° = 2 pts, 3° = 1 pt.
-- Desempate: más primeros puestos, después más segundos.
create or replace function public.get_results()
returns table (
  id uuid,
  name text,
  photo_path text,
  points bigint,
  firsts bigint,
  seconds bigint,
  thirds bigint
)
language sql stable security definer set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.photo_path,
    coalesce(sum(
      case
        when v.first_id = c.id then 3
        when v.second_id = c.id then 2
        when v.third_id = c.id then 1
      end
    ), 0) as points,
    count(*) filter (where v.first_id = c.id) as firsts,
    count(*) filter (where v.second_id = c.id) as seconds,
    count(*) filter (where v.third_id = c.id) as thirds
  from public.costumes c
  left join public.votes v on c.id in (v.first_id, v.second_id, v.third_id)
  where public.is_admin()
  group by c.id
  order by points desc, firsts desc, seconds desc, c.name;
$$;

revoke execute on function public.get_results() from public, anon;
grant execute on function public.get_results() to authenticated;
grant execute on function public.submit_vote(uuid, text, uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.has_voted(uuid) to anon, authenticated;

-- ---------- Permisos de la API ----------

grant select on public.settings, public.costumes to anon, authenticated;
grant update on public.settings to authenticated;
grant insert, update, delete on public.costumes to authenticated;
grant select, delete on public.votes to authenticated;

-- ---------- Seguridad (Row Level Security) ----------

alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.costumes enable row level security;
alter table public.votes enable row level security;

create policy "todos ven el estado" on public.settings
  for select using (true);
create policy "admin cambia el estado" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "todos ven los disfraces" on public.costumes
  for select using (true);
create policy "admin agrega disfraces" on public.costumes
  for insert to authenticated with check (public.is_admin());
create policy "admin edita disfraces" on public.costumes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin borra disfraces" on public.costumes
  for delete to authenticated using (public.is_admin());

-- Los invitados no leen ni escriben votos directo: solo vía submit_vote().
create policy "admin ve los votos" on public.votes
  for select to authenticated using (public.is_admin());
create policy "admin borra votos" on public.votes
  for delete to authenticated using (public.is_admin());

-- ---------- Fotos (Storage) ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "admin sube fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos' and public.is_admin());
create policy "admin ve fotos" on storage.objects
  for select to authenticated using (bucket_id = 'fotos' and public.is_admin());
create policy "admin borra fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos' and public.is_admin());

-- ---------- Anfitrión ----------
-- Reemplazá por TU email (el mismo con el que vas a crear el usuario en Authentication).

insert into public.admins (email) values ('santigonzalezdangelo@gmail.com');
