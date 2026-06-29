GRANT EXECUTE ON FUNCTION public.participates_in_process(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gen_process_numero() TO authenticated, service_role;