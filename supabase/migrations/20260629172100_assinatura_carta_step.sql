
-- Add new step kind for bank letter signature
ALTER TYPE public.process_step_kind ADD VALUE IF NOT EXISTS 'assinatura_carta';

-- Add new status for awaiting signature
ALTER TYPE public.process_status ADD VALUE IF NOT EXISTS 'aguarda_assinatura';

-- Add new action for signed letter
ALTER TYPE public.process_action ADD VALUE IF NOT EXISTS 'carta_assinada';
