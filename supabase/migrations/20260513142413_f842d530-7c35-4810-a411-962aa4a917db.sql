-- Multi-agent runs
create type agent_provider as enum ('gemini','openai','anthropic');
create type agent_status as enum ('queued','running','done','error','cancelled');

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  titulo text not null,
  prompt text not null,
  contexto jsonb not null default '{}'::jsonb,
  provider agent_provider not null,
  modelo text not null,
  status agent_status not null default 'queued',
  resultado text,
  error text,
  tokens_in int,
  tokens_out int,
  duracion_ms int,
  persona_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.agent_runs enable row level security;
create policy agent_runs_sel on public.agent_runs for select using (auth.uid() = user_id);
create policy agent_runs_ins on public.agent_runs for insert with check (auth.uid() = user_id);
create policy agent_runs_upd on public.agent_runs for update using (auth.uid() = user_id);
create policy agent_runs_del on public.agent_runs for delete using (auth.uid() = user_id);
create trigger agent_runs_set_updated before update on public.agent_runs for each row execute function public.set_updated_at();
alter publication supabase_realtime add table public.agent_runs;

-- App configuration per user (auto-config preferences)
create table public.app_config (
  user_id uuid primary key,
  tema text not null default 'liquid-glass',
  acento text not null default 'azul',
  idioma text not null default 'es',
  region_busqueda text,
  proveedor_default agent_provider not null default 'gemini',
  modelo_default text not null default 'google/gemini-3-flash-preview',
  proveedores_activos jsonb not null default '["gemini"]'::jsonb,
  asistente_voz boolean not null default false,
  investigacion_auto boolean not null default true,
  configurado boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
create policy app_config_sel on public.app_config for select using (auth.uid() = user_id);
create policy app_config_ins on public.app_config for insert with check (auth.uid() = user_id);
create policy app_config_upd on public.app_config for update using (auth.uid() = user_id);
create trigger app_config_set_updated before update on public.app_config for each row execute function public.set_updated_at();