
-- Add new step kinds for the 4-parecer workflow
ALTER TYPE public.process_step_kind ADD VALUE IF NOT EXISTS 'quarto';
ALTER TYPE public.process_step_kind ADD VALUE IF NOT EXISTS 'adjunta';
ALTER TYPE public.process_step_kind ADD VALUE IF NOT EXISTS 'presidente';
ALTER TYPE public.process_step_kind ADD VALUE IF NOT EXISTS 'pagamento';

-- Add new status for "em pagamento"
ALTER TYPE public.process_status ADD VALUE IF NOT EXISTS 'em_pagamento';

-- Add roles for adjunta and quarto parecer (optional but useful)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'adjunta';

-- Column: optional 4º parecer user (must be set before adjunta if used)
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS quarto_user_id uuid;
