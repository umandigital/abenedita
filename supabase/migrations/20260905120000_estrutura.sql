-- =====================================================================
-- a Benedita Floristeria — estrutura inicial
--
-- Idempotente do começo ao fim: `create ... if not exists`, `add column if
-- not exists`, `on conflict do nothing`, e cada política é derrubada antes
-- de ser recriada. Rodar num banco que já tem tudo não duplica nem apaga.
--
-- Regra que importa: cada mudança de estrutura daqui pra frente é um
-- ARQUIVO NOVO. Nunca se edita um arquivo já aplicado — o Supabase guarda
-- pelo carimbo de tempo do nome quais migrações já rodaram, e editar uma
-- que já rodou não tem efeito nenhum.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- PERFIS — quem pode editar o conteúdo
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  papel      text not null default 'leitor',
  criado_em  timestamptz not null default now()
);

create or replace function public.e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and papel = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- CATEGORIAS
-- ---------------------------------------------------------------------
create table if not exists public.categorias (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  slug      text not null unique,
  acento    text not null default '#C0356B',
  video     text,          -- vídeo do bloco (toca no hover)
  capa      text,          -- quadro parado, mostrado no repouso e no celular
  ordem     int  not null default 0,
  ativa     boolean not null default true
);

-- ---------------------------------------------------------------------
-- PRODUTOS
-- Os tamanhos variam de um a três por produto e sempre são lidos juntos
-- com ele, então moram num jsonb no formato
--   [{"rotulo":"P","preco":149}, {"rotulo":"M","preco":189}]
-- em vez de uma tabela filha que só serviria para dar um join a mais.
-- ---------------------------------------------------------------------
create table if not exists public.produtos (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  nome         text not null,
  categoria_id uuid references public.categorias(id) on delete set null,
  descricao    text,
  acento       text not null default '#C0356B',
  foto         text,
  tamanhos     jsonb not null default '[]'::jsonb,
  ordem        int  not null default 0,
  ativo        boolean not null default true
);
create index if not exists produtos_categoria_idx on public.produtos (categoria_id);

-- ---------------------------------------------------------------------
-- GALERIAS — fotos das áreas Loja e Eventos
-- ---------------------------------------------------------------------
create table if not exists public.galerias (
  id     uuid primary key default gen_random_uuid(),
  area   text not null check (area in ('loja','eventos','assinatura')),
  foto   text not null,
  alt    text,
  ordem  int not null default 0
);
create index if not exists galerias_area_idx on public.galerias (area, ordem);

-- ---------------------------------------------------------------------
-- DEPOIMENTOS
-- ---------------------------------------------------------------------
create table if not exists public.depoimentos (
  id       uuid primary key default gen_random_uuid(),
  nome     text not null,
  contexto text,           -- "Assinante quinzenal · Cidade Baixa"
  citacao  text not null,
  foto     text,
  ordem    int not null default 0,
  ativo    boolean not null default true
);

-- ---------------------------------------------------------------------
-- DÚVIDAS
-- ---------------------------------------------------------------------
create table if not exists public.faq (
  id       uuid primary key default gen_random_uuid(),
  pergunta text not null,
  resposta text not null,
  ordem    int not null default 0,
  ativa    boolean not null default true
);

-- ---------------------------------------------------------------------
-- CONFIG — chave/valor para o que a loja ajusta sem mexer no código
-- (arte do banner da estação, textos das sócias, diferenciais, WhatsApp)
-- ---------------------------------------------------------------------
create table if not exists public.config (
  chave       text primary key,
  valor       jsonb not null default '{}'::jsonb,
  atualizado  timestamptz not null default now()
);

insert into public.config (chave, valor) values
  ('whatsapp',  '{"numero":"5551985054194"}'::jsonb),
  ('estacao',   '{"ligado":true,"arte":null,"destino":"evento"}'::jsonb)
on conflict (chave) do nothing;

-- =====================================================================
-- POLÍTICAS
-- Leitura pública só do que está ativo; escrita só para admin.
-- Cada política é derrubada antes de recriada para o arquivo poder rodar
-- de novo sem erro.
-- =====================================================================
alter table public.perfis      enable row level security;
alter table public.categorias  enable row level security;
alter table public.produtos    enable row level security;
alter table public.galerias    enable row level security;
alter table public.depoimentos enable row level security;
alter table public.faq         enable row level security;
alter table public.config      enable row level security;

drop policy if exists "perfil proprio"      on public.perfis;
create policy "perfil proprio" on public.perfis
  for select using (id = auth.uid() or public.e_admin());

do $$
declare r record;
begin
  for r in
    select * from (values
      ('categorias','ativa'), ('produtos','ativo'),
      ('depoimentos','ativo'), ('faq','ativa')
    ) as v(tabela, coluna)
  loop
    execute format('drop policy if exists %I on public.%I', 'leitura publica', r.tabela);
    execute format(
      'create policy %I on public.%I for select using (%I = true or public.e_admin())',
      'leitura publica', r.tabela, r.coluna);
  end loop;
end $$;

-- galerias e config não têm coluna de ativo: são públicas inteiras.
drop policy if exists "leitura publica" on public.galerias;
create policy "leitura publica" on public.galerias for select using (true);

drop policy if exists "leitura publica" on public.config;
create policy "leitura publica" on public.config for select using (true);

-- Escrita: apenas admin, em todas as tabelas de conteúdo.
do $$
declare t text;
begin
  foreach t in array array['categorias','produtos','galerias','depoimentos','faq','config']
  loop
    execute format('drop policy if exists %I on public.%I', 'escrita admin', t);
    execute format(
      'create policy %I on public.%I for all using (public.e_admin()) with check (public.e_admin())',
      'escrita admin', t);
  end loop;
end $$;

-- =====================================================================
-- ARMAZENAMENTO — bucket das mídias enviadas pelo painel
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('midia', 'midia', true)
on conflict (id) do nothing;

drop policy if exists "midia leitura publica" on storage.objects;
create policy "midia leitura publica" on storage.objects
  for select using (bucket_id = 'midia');

drop policy if exists "midia escrita admin" on storage.objects;
create policy "midia escrita admin" on storage.objects
  for all using (bucket_id = 'midia' and public.e_admin())
  with check (bucket_id = 'midia' and public.e_admin());
