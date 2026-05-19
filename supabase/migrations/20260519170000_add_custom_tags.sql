-- Migration: Add custom tags for users
CREATE TABLE IF NOT EXISTS public.custom_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.custom_tags ENABLE ROW LEVEL SECURITY;

-- Política de leitura: a usuária só pode ver as próprias tags
CREATE POLICY "Usuárias podem ver suas próprias custom tags"
ON public.custom_tags FOR SELECT
USING (auth.uid() = user_id);

-- Política de inserção: a usuária só pode inserir tags atreladas ao próprio ID
CREATE POLICY "Usuárias podem inserir suas próprias custom tags"
ON public.custom_tags FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política de deleção (opcional para o futuro)
CREATE POLICY "Usuárias podem deletar suas próprias custom tags"
ON public.custom_tags FOR DELETE
USING (auth.uid() = user_id);
