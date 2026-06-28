
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'criador', 'validador', 'diretor', 'diretor_geral', 'presidente', 'leitura');
CREATE TYPE public.process_status AS ENUM ('pendente', 'em_analise', 'aprovado', 'rejeitado', 'devolvido', 'concluido');
CREATE TYPE public.process_step_kind AS ENUM ('criador', 'chefe', 'diretor', 'diretor_geral', 'arquivo');
CREATE TYPE public.process_action AS ENUM ('criado', 'encaminhado', 'favoravel', 'nao_favoravel', 'devolvido', 'arquivado');
CREATE TYPE public.process_type AS ENUM ('pagamento', 'patrimonio', 'rh', 'outros');
CREATE TYPE public.process_priority AS ENUM ('baixa', 'media', 'alta');

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  departamento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sequence + numero generator
CREATE SEQUENCE public.process_numero_seq START 1;
CREATE OR REPLACE FUNCTION public.gen_process_numero()
RETURNS TEXT LANGUAGE SQL VOLATILE SET search_path = public AS $$
  SELECT 'PROC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.process_numero_seq')::text, 5, '0')
$$;

-- Processes (no RLS policies yet - need process_steps first)
CREATE TABLE public.processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE DEFAULT public.gen_process_numero(),
  title TEXT NOT NULL,
  type process_type NOT NULL,
  department TEXT NOT NULL,
  description TEXT,
  priority process_priority NOT NULL DEFAULT 'media',
  status process_status NOT NULL DEFAULT 'pendente',
  current_step process_step_kind NOT NULL DEFAULT 'chefe',
  current_user_id UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.processes TO authenticated;
GRANT ALL ON public.processes TO service_role;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

-- Process steps
CREATE TABLE public.process_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  from_user UUID REFERENCES auth.users(id),
  to_user UUID REFERENCES auth.users(id),
  action process_action NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.process_steps TO authenticated;
GRANT ALL ON public.process_steps TO service_role;
ALTER TABLE public.process_steps ENABLE ROW LEVEL SECURITY;

-- Helper: participates in process
CREATE OR REPLACE FUNCTION public.participates_in_process(_process_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.processes p
    WHERE p.id = _process_id AND (p.created_by = _user_id OR p.current_user_id = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.process_steps s
    WHERE s.process_id = _process_id AND (s.from_user = _user_id OR s.to_user = _user_id)
  )
$$;

CREATE POLICY "View own processes" ON public.processes FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR current_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'leitura')
  OR EXISTS (SELECT 1 FROM public.process_steps s WHERE s.process_id = id AND (s.from_user = auth.uid() OR s.to_user = auth.uid()))
);
CREATE POLICY "Insert own processes" ON public.processes FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update if current responsible" ON public.processes FOR UPDATE TO authenticated
USING (current_user_id = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "View steps if can view process" ON public.process_steps FOR SELECT TO authenticated
USING (public.participates_in_process(process_id, auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leitura'));
CREATE POLICY "Insert steps if authenticated" ON public.process_steps FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Attachments
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View attachments if can view process" ON public.attachments FOR SELECT TO authenticated
USING (public.participates_in_process(process_id, auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leitura'));
CREATE POLICY "Insert attachments if participant" ON public.attachments FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid());

-- Notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  process_id UUID REFERENCES public.processes(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER processes_touch BEFORE UPDATE ON public.processes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- New user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, departamento)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'departamento'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'criador') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX idx_processes_current_user ON public.processes(current_user_id);
CREATE INDEX idx_processes_created_by ON public.processes(created_by);
CREATE INDEX idx_processes_status ON public.processes(status);
CREATE INDEX idx_steps_process ON public.process_steps(process_id, created_at);
CREATE INDEX idx_notif_user ON public.notifications(user_id, read);

-- Storage policies for process-attachments bucket
CREATE POLICY "Authenticated read attachments" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'process-attachments');
CREATE POLICY "Authenticated upload attachments" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'process-attachments' AND auth.uid() IS NOT NULL);
