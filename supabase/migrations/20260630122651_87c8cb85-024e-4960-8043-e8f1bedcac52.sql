GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_comments TO authenticated;
GRANT ALL ON public.process_comments TO service_role;
NOTIFY pgrst, 'reload schema';