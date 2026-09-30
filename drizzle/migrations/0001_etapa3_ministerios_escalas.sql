-- Admin único
CREATE UNIQUE INDEX IF NOT EXISTS profiles_single_admin ON public.profiles ((role)) WHERE role = 'admin';

CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Não é permitido alterar id ou e-mail';
  END IF;
  IF OLD.role = 'admin' AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active) THEN
    RAISE EXCEPTION 'A conta administradora é protegida';
  END IF;
  IF NEW.role = 'admin' AND OLD.role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Não é permitido criar outro administrador';
  END IF;
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active)
     AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Somente o administrador altera funções e status';
  END IF;
  RETURN NEW;
END $$;

-- Tabelas
CREATE TABLE public.ministries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_ministries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ministry_id)
);
CREATE TABLE public.ministry_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ministry_id)
);
CREATE TABLE public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  available boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.event_ministry_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  required_count integer NOT NULL DEFAULT 1 CHECK (required_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, ministry_id)
);
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  ministry_id uuid NOT NULL REFERENCES public.ministries(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','confirmed','cancelled','completed','replaced')),
  position text,
  replaces_schedule_id uuid REFERENCES public.schedules(id),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX schedules_user_idx ON public.schedules(user_id);
CREATE INDEX schedules_event_idx ON public.schedules(event_id, ministry_id);
CREATE UNIQUE INDEX schedules_active_unique ON public.schedules(event_id, ministry_id, user_id) WHERE status NOT IN ('cancelled','replaced');
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  schedule_id uuid REFERENCES public.schedules(id),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ministries, public.user_ministries, public.ministry_leaders, public.availability, public.events, public.event_ministry_needs, public.schedules TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.ministries, public.user_ministries, public.ministry_leaders, public.availability, public.events, public.event_ministry_needs, public.schedules, public.notifications TO service_role;

-- Funções auxiliares
CREATE OR REPLACE FUNCTION public.is_admin_or_pastor(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id=_uid AND active AND role IN ('admin','pastor'))
$$;
CREATE OR REPLACE FUNCTION public.is_ministry_leader(_uid uuid, _mid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM ministry_leaders l JOIN profiles p ON p.id=l.user_id WHERE l.user_id=_uid AND l.ministry_id=_mid AND p.active)
$$;
CREATE OR REPLACE FUNCTION public.is_ministry_member(_uid uuid, _mid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM user_ministries WHERE user_id=_uid AND ministry_id=_mid)
$$;
CREATE OR REPLACE FUNCTION public.can_manage_ministry(_uid uuid, _mid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin_or_pastor(_uid) OR public.is_ministry_leader(_uid,_mid)
$$;
CREATE OR REPLACE FUNCTION public.leads_user(_leader uuid, _member uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM ministry_leaders l JOIN user_ministries m ON m.ministry_id=l.ministry_id WHERE l.user_id=_leader AND m.user_id=_member)
$$;
CREATE OR REPLACE FUNCTION public.shares_ministry(_a uuid, _b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM (SELECT ministry_id FROM user_ministries WHERE user_id=_a UNION SELECT ministry_id FROM ministry_leaders WHERE user_id=_a) x
    JOIN (SELECT ministry_id FROM user_ministries WHERE user_id=_b UNION SELECT ministry_id FROM ministry_leaders WHERE user_id=_b) y USING (ministry_id))
$$;

-- RLS
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ministry_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ministry_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leem profiles do mesmo ministério" ON public.profiles FOR SELECT TO authenticated USING (public.shares_ministry(auth.uid(), id));

CREATE POLICY "Todos leem ministérios" ON public.ministries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/pastor gerenciam ministérios" ON public.ministries FOR ALL TO authenticated USING (public.is_admin_or_pastor(auth.uid())) WITH CHECK (public.is_admin_or_pastor(auth.uid()));

CREATE POLICY "Todos leem membros" ON public.user_ministries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/pastor gerenciam membros" ON public.user_ministries FOR ALL TO authenticated USING (public.is_admin_or_pastor(auth.uid())) WITH CHECK (public.is_admin_or_pastor(auth.uid()));

CREATE POLICY "Todos leem líderes" ON public.ministry_leaders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/pastor gerenciam líderes" ON public.ministry_leaders FOR ALL TO authenticated USING (public.is_admin_or_pastor(auth.uid())) WITH CHECK (public.is_admin_or_pastor(auth.uid()));

CREATE POLICY "Ler disponibilidade" ON public.availability FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_or_pastor(auth.uid()) OR public.leads_user(auth.uid(), user_id));
CREATE POLICY "Inserir própria disponibilidade" ON public.availability FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Alterar própria disponibilidade" ON public.availability FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Apagar própria disponibilidade" ON public.availability FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Todos leem eventos" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/pastor gerenciam eventos" ON public.events FOR ALL TO authenticated USING (public.is_admin_or_pastor(auth.uid())) WITH CHECK (public.is_admin_or_pastor(auth.uid()));

CREATE POLICY "Todos leem necessidades" ON public.event_ministry_needs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores gerenciam necessidades" ON public.event_ministry_needs FOR ALL TO authenticated USING (public.can_manage_ministry(auth.uid(), ministry_id)) WITH CHECK (public.can_manage_ministry(auth.uid(), ministry_id));

CREATE POLICY "Ler escalas" ON public.schedules FOR SELECT TO authenticated USING (
  public.can_manage_ministry(auth.uid(), ministry_id)
  OR (status <> 'draft' AND (user_id = auth.uid() OR public.is_ministry_member(auth.uid(), ministry_id))));
CREATE POLICY "Gestores criam escalas" ON public.schedules FOR INSERT TO authenticated WITH CHECK (public.can_manage_ministry(auth.uid(), ministry_id));
CREATE POLICY "Gestores alteram escalas" ON public.schedules FOR UPDATE TO authenticated USING (public.can_manage_ministry(auth.uid(), ministry_id)) WITH CHECK (public.can_manage_ministry(auth.uid(), ministry_id));
CREATE POLICY "Gestores apagam rascunhos" ON public.schedules FOR DELETE TO authenticated USING (status = 'draft' AND public.can_manage_ministry(auth.uid(), ministry_id));

CREATE POLICY "Lê próprias notificações" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Marca própria notificação" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER t_ministries BEFORE UPDATE ON public.ministries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_availability BEFORE UPDATE ON public.availability FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_events BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_needs BEFORE UPDATE ON public.event_ministry_needs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_schedules BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed ministérios
INSERT INTO public.ministries (name) VALUES ('Mídia'),('Transmissão'),('Portaria'),('Louvor'),('Projeção'),('Intercessão'),('Infantil') ON CONFLICT (name) DO NOTHING;