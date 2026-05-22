ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS proband_id uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proband_asked boolean NOT NULL DEFAULT false;