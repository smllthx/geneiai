ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS openai_api_key text,
  ADD COLUMN IF NOT EXISTS ai_preferred_provider text NOT NULL DEFAULT 'auto';