-- Timestamp de quando a usuaria optou por desativar os lembretes.
-- NULL = nunca desativou (default). Setado quando disableReminders e' chamado
-- (toggle no /eu OU dispense do banner RemindersPrompt na /registrar).
-- Limpo (volta a NULL) quando reativar via enableReminders.
-- Aplicada via MCP em 16/05/2026.

alter table public.profiles
  add column if not exists reminders_disabled_at timestamptz default null;
