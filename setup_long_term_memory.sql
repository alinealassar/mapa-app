-- 1. Habilitar a extensão pgvector
create extension if not exists vector;

-- 2. Criar a tabela de memórias
create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  embedding vector(1536), -- Dimensão padrão para modelos como o da OpenAI ou Supabase
  created_at timestamp with time zone default now()
);

-- 3. Habilitar RLS na tabela
alter table public.user_memories enable row level security;

-- 4. Criar políticas de acesso
create policy "Usuárias podem ver suas próprias memórias"
  on public.user_memories for select
  using (auth.uid() = user_id);

create policy "Usuárias podem inserir suas próprias memórias"
  on public.user_memories for insert
  with check (auth.uid() = user_id);

-- 5. Criar a função RPC para busca vetorial
create or replace function match_memories (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    user_memories.id,
    user_memories.content,
    1 - (user_memories.embedding <=> query_embedding) as similarity
  from user_memories
  where user_memories.user_id = p_user_id
    and 1 - (user_memories.embedding <=> query_embedding) > match_threshold
  order by user_memories.embedding <=> query_embedding
  limit match_count;
end;
$$;
