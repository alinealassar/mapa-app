-- FURO 5: hardening SQL (defesa em profundidade)
-- Funções internas não devem ser chamáveis via API REST
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

-- match_memories: fixar search_path (advisor) e revogar acesso de anon
-- (RLS já impede vazamento cross-user; Edge Functions usam SERVICE_ROLE, não afeta)
alter function public.match_memories(vector, double precision, integer, uuid)
  set search_path = public, extensions;
revoke execute on function public.match_memories(vector, double precision, integer, uuid) from anon;
