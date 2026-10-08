ALTER TABLE public.events ADD COLUMN created_by uuid REFERENCES public.profiles(id);
CREATE OR REPLACE FUNCTION public.events_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_audit BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.events_audit();

CREATE OR REPLACE FUNCTION public.is_any_leader(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM ministry_leaders l JOIN profiles p ON p.id=l.user_id WHERE l.user_id=_uid AND p.active)
$$;

DROP POLICY IF EXISTS "Admin/pastor gerenciam eventos" ON public.events;
CREATE POLICY "Criar eventos" ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_pastor(auth.uid()) OR public.is_any_leader(auth.uid()));
CREATE POLICY "Alterar eventos" ON public.events FOR UPDATE TO authenticated
  USING (public.is_admin_or_pastor(auth.uid()) OR (created_by = auth.uid() AND public.is_any_leader(auth.uid())))
  WITH CHECK (public.is_admin_or_pastor(auth.uid()) OR (created_by = auth.uid() AND public.is_any_leader(auth.uid())));
CREATE POLICY "Excluir eventos" ON public.events FOR DELETE TO authenticated
  USING (public.is_admin_or_pastor(auth.uid()) OR (created_by = auth.uid() AND public.is_any_leader(auth.uid())));

ALTER TABLE public.profiles ADD COLUMN avatar_url text;
ALTER TABLE public.profiles ADD COLUMN bio text CHECK (bio IS NULL OR char_length(bio) <= 300);
ALTER TABLE public.profiles ADD COLUMN whatsapp text CHECK (whatsapp IS NULL OR whatsapp ~ '^[0-9]{10,13}$');
ALTER TABLE public.profiles ADD COLUMN reminders_enabled boolean NOT NULL DEFAULT true;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, email, phone, role, active, created_at, updated_at, avatar_url, bio, reminders_enabled) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.profile_whatsapp(_uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT whatsapp FROM profiles WHERE id = _uid AND (_uid = auth.uid() OR public.is_admin_or_pastor(auth.uid()))
$$;
REVOKE EXECUTE ON FUNCTION public.profile_whatsapp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_whatsapp(uuid) TO authenticated;

ALTER TABLE public.notifications ADD COLUMN channel text NOT NULL DEFAULT 'app';
ALTER TABLE public.notifications ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX notifications_schedule_type_channel ON public.notifications(schedule_id, type, channel) WHERE schedule_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.process_schedule_reminders() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer := 0; c integer;
BEGIN
  WITH base AS (
    SELECT s.id sid, s.user_id, e.id eid, e.name ename, e.date, e.start_time, m.name mname, p.full_name,
           ((e.date + e.start_time) AT TIME ZONE 'America/Sao_Paulo') ts
    FROM schedules s
    JOIN events e ON e.id = s.event_id AND e.active
    JOIN ministries m ON m.id = s.ministry_id
    JOIN profiles p ON p.id = s.user_id AND p.active AND p.reminders_enabled
    WHERE s.status IN ('scheduled','confirmed')
      AND e.date BETWEEN current_date - 1 AND current_date + 2
  )
  INSERT INTO notifications(user_id, type, title, body, schedule_id, event_id, channel)
  SELECT user_id, 'reminder_24h', 'Lembrete de escala',
    format('Olá, %s! Você está escalado amanhã: %s — %s, %s às %s. Acesse o Libens para consultar sua escala.',
      split_part(coalesce(nullif(full_name,''),'servo'),' ',1), ename, mname, to_char(date,'DD/MM/YYYY'), to_char(start_time,'HH24:MI')),
    sid, eid, 'app'
  FROM base WHERE now() >= ts - interval '24 hours' AND now() < ts - interval '2 hours'
  ON CONFLICT (schedule_id, type, channel) WHERE schedule_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;

  WITH base AS (
    SELECT s.id sid, s.user_id, e.id eid, e.name ename, e.start_time, m.name mname, p.full_name,
           ((e.date + e.start_time) AT TIME ZONE 'America/Sao_Paulo') ts
    FROM schedules s
    JOIN events e ON e.id = s.event_id AND e.active
    JOIN ministries m ON m.id = s.ministry_id
    JOIN profiles p ON p.id = s.user_id AND p.active AND p.reminders_enabled
    WHERE s.status IN ('scheduled','confirmed')
      AND e.date BETWEEN current_date - 1 AND current_date + 1
  )
  INSERT INTO notifications(user_id, type, title, body, schedule_id, event_id, channel)
  SELECT user_id, 'reminder_2h', 'Sua escala começa em 2 horas',
    format('Olá, %s! Você está escalado para %s — Ministério: %s, às %s. Caso tenha algum imprevisto, acesse o Libens.',
      split_part(coalesce(nullif(full_name,''),'servo'),' ',1), ename, mname, to_char(start_time,'HH24:MI')),
    sid, eid, 'app'
  FROM base WHERE now() >= ts - interval '2 hours' AND now() < ts
  ON CONFLICT (schedule_id, type, channel) WHERE schedule_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.process_schedule_reminders() FROM PUBLIC, anon, authenticated;

CREATE POLICY "Avatar: ver" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Avatar: enviar o próprio" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar: alterar o próprio" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar: remover o próprio" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);