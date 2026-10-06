CREATE TABLE public.event_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time,
  location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_templates TO authenticated;
GRANT ALL ON public.event_templates TO service_role;
ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem eventos padrão" ON public.event_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/pastor gerenciam eventos padrão" ON public.event_templates FOR ALL TO authenticated
  USING (public.is_admin_or_pastor(auth.uid())) WITH CHECK (public.is_admin_or_pastor(auth.uid()));
INSERT INTO public.event_templates(name, weekday, start_time, end_time) VALUES
  ('Culto da Palavra', 4, '19:30', '21:00'),
  ('Culto de Celebração', 0, '18:00', '20:00')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.events ADD COLUMN template_id uuid REFERENCES public.event_templates(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX events_template_date_unique ON public.events(template_id, date) WHERE template_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_template_events(_months int DEFAULT 3)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_admin_or_pastor(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _months < 1 OR _months > 6 THEN RAISE EXCEPTION 'Período inválido'; END IF;
  INSERT INTO public.events(name, date, start_time, end_time, location, template_id)
  SELECT t.name, d::date, t.start_time, t.end_time, t.location, t.id
  FROM public.event_templates t
  CROSS JOIN generate_series(current_date, current_date + make_interval(months => _months), interval '1 day') d
  WHERE t.active AND extract(dow FROM d) = t.weekday
  ON CONFLICT (template_id, date) WHERE template_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.generate_template_events(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_template_events(int) TO authenticated;

ALTER TABLE public.schedules ADD COLUMN updated_by uuid REFERENCES public.profiles(id);
CREATE OR REPLACE FUNCTION public.schedules_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
    NEW.updated_by := NEW.created_by;
  ELSE
    NEW.created_by := OLD.created_by;
    IF auth.uid() IS NOT NULL THEN NEW.updated_by := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER schedules_audit BEFORE INSERT OR UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.schedules_audit();

CREATE UNIQUE INDEX schedules_user_event_unique ON public.schedules(event_id, user_id) WHERE status NOT IN ('cancelled','replaced');

DROP POLICY IF EXISTS "Gestores alteram escalas" ON public.schedules;
DROP POLICY IF EXISTS "Gestores apagam rascunhos" ON public.schedules;
CREATE POLICY "Alterar escalas" ON public.schedules FOR UPDATE TO authenticated
  USING (public.is_admin_or_pastor(auth.uid()) OR (created_by = auth.uid() AND public.is_ministry_leader(auth.uid(), ministry_id)))
  WITH CHECK (public.is_admin_or_pastor(auth.uid()) OR public.is_ministry_leader(auth.uid(), ministry_id));
CREATE POLICY "Excluir escalas" ON public.schedules FOR DELETE TO authenticated
  USING (public.is_admin_or_pastor(auth.uid()) OR (created_by = auth.uid() AND public.is_ministry_leader(auth.uid(), ministry_id)));

CREATE OR REPLACE FUNCTION public.limit_user_ministries() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (SELECT count(*) FROM public.user_ministries WHERE user_id = NEW.user_id AND ministry_id <> NEW.ministry_id) >= 2 THEN
    RAISE EXCEPTION 'Cada membro pode participar de no máximo 2 ministérios.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER limit_user_ministries BEFORE INSERT ON public.user_ministries FOR EACH ROW EXECUTE FUNCTION public.limit_user_ministries();

ALTER TABLE public.event_ministry_needs DROP CONSTRAINT IF EXISTS event_ministry_needs_required_count_check;
ALTER TABLE public.event_ministry_needs ADD CONSTRAINT event_ministry_needs_required_count_range CHECK (required_count BETWEEN 0 AND 100) NOT VALID;