-- 1. Add SLA alert flag to processes
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS sla_alert_sent BOOLEAN NOT NULL DEFAULT false;

-- 2. Add step_id to attachments (optional link to specific step)
ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS step_id UUID REFERENCES public.process_steps(id) ON DELETE CASCADE;

-- 3. Create process_comments for internal forum/chat
CREATE TABLE IF NOT EXISTS public.process_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissions for comments
GRANT SELECT, INSERT ON public.process_comments TO authenticated;
GRANT ALL ON public.process_comments TO service_role;

ALTER TABLE public.process_comments ENABLE ROW LEVEL SECURITY;

-- Allow participants to read comments
CREATE POLICY "View comments if can view process" ON public.process_comments FOR SELECT TO authenticated
USING (public.participates_in_process(process_id, auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leitura'));

-- Allow inserting comments if authenticated
CREATE POLICY "Insert comments if participant" ON public.process_comments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND (public.participates_in_process(process_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')));

-- Index for fast chat loading
CREATE INDEX IF NOT EXISTS idx_process_comments_process_id ON public.process_comments(process_id, created_at);
