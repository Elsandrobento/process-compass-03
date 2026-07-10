
-- Fix 1: processes SELECT policy subquery bug (s.process_id = s.id -> s.process_id = p.id via processes.id)
DROP POLICY IF EXISTS "View own processes" ON public.processes;
CREATE POLICY "View own processes" ON public.processes
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR current_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'leitura'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.process_steps s
    WHERE s.process_id = processes.id
      AND (s.from_user = auth.uid() OR s.to_user = auth.uid())
  )
);

-- Fix 2: notifications insert must be self or participant/admin
DROP POLICY IF EXISTS "Insert notifications self or by participant" ON public.notifications;
CREATE POLICY "Insert notifications self or by participant" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (process_id IS NOT NULL AND participates_in_process(process_id, auth.uid()))
);

-- Fix 3: process_steps insert must require participation or admin
DROP POLICY IF EXISTS "Insert steps if authenticated" ON public.process_steps;
CREATE POLICY "Insert steps if participant" ON public.process_steps
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR participates_in_process(process_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.processes p WHERE p.id = process_id AND (p.created_by = auth.uid() OR p.current_user_id = auth.uid()))
);

-- Fix 4: profiles SELECT restrict to self / admin / leitura / shared-process participants
DROP POLICY IF EXISTS "Profiles readable by all authenticated" ON public.profiles;
CREATE POLICY "Profiles restricted select" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'leitura'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.processes p
    WHERE (p.created_by = profiles.id OR p.current_user_id = profiles.id)
      AND (p.created_by = auth.uid() OR p.current_user_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.process_steps s
    WHERE (s.from_user = profiles.id OR s.to_user = profiles.id)
      AND (s.from_user = auth.uid() OR s.to_user = auth.uid())
  )
);

-- Fix 5 & 6: storage.objects policies for process-attachments require participation
DROP POLICY IF EXISTS "Authenticated read attachments" ON storage.objects;
CREATE POLICY "Read attachments if participant" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'process-attachments'
  AND EXISTS (
    SELECT 1 FROM public.attachments a
    WHERE a.file_path = storage.objects.name
      AND (
        participates_in_process(a.process_id, auth.uid())
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'leitura'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "Authenticated upload attachments" ON storage.objects;
CREATE POLICY "Upload attachments if participant" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'process-attachments'
  AND auth.uid() IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    -- path convention: "<process_id>/..." — verify participation on that process
    OR participates_in_process(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  )
);

-- Fix 7: revoke EXECUTE on SECURITY DEFINER helper/trigger functions from signed-in users.
-- has_role & participates_in_process must remain executable by authenticated (used in RLS policies),
-- but the trigger/utility fns should not be callable via RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_process_numero() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
