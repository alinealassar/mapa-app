-- Adiciona flag para usuária ativar/desativar lembretes diários (push + email)
-- Default true: comportamento antigo (todo mundo recebe) preservado para perfis existentes.
-- A Edge Function `daily-reminder` filtra por essa coluna.

alter table public.profiles
  add column if not exists reminders_enabled boolean default true;

-- Garante que perfis antigos fiquem com true (e não null) caso a default não tenha aplicado
update public.profiles set reminders_enabled = true where reminders_enabled is null;
