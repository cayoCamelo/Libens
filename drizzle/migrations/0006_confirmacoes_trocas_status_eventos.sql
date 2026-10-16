ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS response text NOT NULL DEFAULT 'pending' CHECK (response IN ('pending','confirmed','declined'));
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS responded_at timestamptz;
UPDATE public.schedules SET response='confirmed' WHERE status='confirmed';

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled'));

CREATE OR REPLACE FUNCTION public.event_status_calc(_date date, _start time, _end time, _now timestamptz DEFAULT now())
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _now >= ((_date + coalesce(_end, _start + interval '2 hours')) AT TIME ZONE 'America/Fortaleza') THEN 'completed'
    WHEN _now >= ((_date + _start) AT TIME ZONE 'America/Fortaleza') THEN 'in_progress'
    ELSE 'scheduled' END
$$;

UPDATE public.events SET status = public.event_status_calc(date, start_time, end_time) WHERE status <> 'cancelled';

CREATE OR REPLACE FUNCTION public.refresh_event_statuses()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  UPDATE events SET status = event_status_calc(date, start_time, end_time)
  WHERE status <> 'cancelled' AND status IS DISTINCT FROM event_status_calc(date, start_time, end_time);
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE schedules s SET status='completed' FROM events e
  WHERE e.id=s.event_id AND e.status='completed' AND s.status IN ('scheduled','confirmed');
  RETURN n;
END $$;

CREATE TABLE public.substitution_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  ministry_id uuid NOT NULL REFERENCES public.ministries(id),
  requester_id uuid NOT NULL REFERENCES public.profiles(id),
  substitute_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending_substitute' CHECK (status IN ('pending_substitute','pending_leader','approved','rejected','declined','cancelled')),
  reason text CHECK (char_length(reason) <= 300),
  substitute_responded_at timestamptz,
  decided_by uuid REFERENCES public.profiles(id),
  decided_at timestamptz,
  new_schedule_id uuid REFERENCES public.schedules(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX substitution_open_unique ON public.substitution_requests(schedule_id) WHERE status IN ('pending_substitute','pending_leader');
GRANT SELECT ON public.substitution_requests TO authenticated;
GRANT ALL ON public.substitution_requests TO service_role;
ALTER TABLE public.substitution_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ler trocas" ON public.substitution_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR substitute_id = auth.uid() OR public.can_manage_ministry(auth.uid(), ministry_id));

CREATE OR REPLACE FUNCTION public._notify(_uid uuid, _sid uuid, _eid uuid, _type text, _title text, _body text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO notifications(user_id, type, title, body, schedule_id, event_id, channel)
  VALUES (_uid, _type, _title, _body, _sid, _eid, 'app')
  ON CONFLICT (schedule_id, type, channel) WHERE schedule_id IS NOT NULL DO NOTHING
$$;
REVOKE ALL ON FUNCTION public._notify(uuid,uuid,uuid,text,text,text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._evento_aberto(_eid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE st text;
BEGIN
  SELECT CASE WHEN status='cancelled' THEN 'cancelled' ELSE event_status_calc(date,start_time,end_time) END INTO st FROM events WHERE id=_eid;
  IF st IN ('completed','cancelled') THEN RAISE EXCEPTION 'Este evento já foi concluído ou cancelado.' USING ERRCODE='P0001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.respond_schedule(_sid uuid, _response text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s schedules%ROWTYPE; ev events%ROWTYPE; l record;
BEGIN
  IF _response NOT IN ('confirmed','declined') THEN RAISE EXCEPTION 'Resposta inválida' USING ERRCODE='P0001'; END IF;
  SELECT * INTO s FROM schedules WHERE id=_sid;
  IF s.id IS NULL OR s.user_id <> auth.uid() THEN RAISE EXCEPTION 'Você só pode responder às suas escalas.' USING ERRCODE='P0001'; END IF;
  IF s.status NOT IN ('scheduled','confirmed') THEN RAISE EXCEPTION 'Esta escala não está publicada.' USING ERRCODE='P0001'; END IF;
  PERFORM _evento_aberto(s.event_id);
  UPDATE schedules SET response=_response, responded_at=now(),
    status = CASE WHEN _response='confirmed' THEN 'confirmed' ELSE 'scheduled' END WHERE id=_sid;
  IF _response='declined' THEN
    SELECT * INTO ev FROM events WHERE id=s.event_id;
    FOR l IN SELECT user_id FROM ministry_leaders WHERE ministry_id=s.ministry_id AND user_id<>s.user_id LOOP
      INSERT INTO notifications(user_id,type,title,body,schedule_id,event_id,channel)
      VALUES (l.user_id,'recusa:'||l.user_id,'Servo não poderá comparecer',
        format('%s informou que não poderá servir em %s (%s).', (SELECT full_name FROM profiles WHERE id=s.user_id), ev.name, to_char(ev.date,'DD/MM')),
        s.id, s.event_id,'app')
      ON CONFLICT (schedule_id,type,channel) WHERE schedule_id IS NOT NULL DO NOTHING;
    END LOOP;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.substitute_candidates(_sid uuid)
RETURNS TABLE(user_id uuid, full_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.full_name FROM schedules s
  JOIN events e ON e.id=s.event_id
  JOIN user_ministries um ON um.ministry_id=s.ministry_id
  JOIN profiles p ON p.id=um.user_id AND p.active
  WHERE s.id=_sid AND (s.user_id=auth.uid() OR can_manage_ministry(auth.uid(), s.ministry_id))
    AND p.id<>s.user_id
    AND NOT EXISTS (SELECT 1 FROM availability a WHERE a.user_id=p.id AND a.date=e.date AND NOT a.available)
    AND NOT EXISTS (SELECT 1 FROM schedules x JOIN events ex ON ex.id=x.event_id
       WHERE x.user_id=p.id AND x.status NOT IN ('cancelled','replaced') AND ex.date=e.date
         AND ex.start_time < coalesce(e.end_time, e.start_time + interval '2 hours')
         AND coalesce(ex.end_time, ex.start_time + interval '2 hours') > e.start_time)
  ORDER BY p.full_name
$$;

CREATE OR REPLACE FUNCTION public.request_substitution(_sid uuid, _substitute uuid, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s schedules%ROWTYPE; rid uuid; ev events%ROWTYPE;
BEGIN
  SELECT * INTO s FROM schedules WHERE id=_sid;
  IF s.id IS NULL OR s.user_id<>auth.uid() THEN RAISE EXCEPTION 'Você só pode pedir troca das suas escalas.' USING ERRCODE='P0001'; END IF;
  IF s.status NOT IN ('scheduled','confirmed') THEN RAISE EXCEPTION 'Esta escala não está publicada.' USING ERRCODE='P0001'; END IF;
  PERFORM _evento_aberto(s.event_id);
  IF NOT EXISTS (SELECT 1 FROM substitute_candidates(_sid) c WHERE c.user_id=_substitute) THEN
    RAISE EXCEPTION 'Este substituto não está disponível.' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM substitution_requests WHERE schedule_id=_sid AND status IN ('pending_substitute','pending_leader')) THEN
    RAISE EXCEPTION 'Já existe um pedido de troca em andamento para esta escala.' USING ERRCODE='P0001'; END IF;
  INSERT INTO substitution_requests(schedule_id,event_id,ministry_id,requester_id,substitute_id,reason)
  VALUES (_sid,s.event_id,s.ministry_id,auth.uid(),_substitute,nullif(trim(_reason),'')) RETURNING id INTO rid;
  SELECT * INTO ev FROM events WHERE id=s.event_id;
  INSERT INTO notifications(user_id,type,title,body,schedule_id,event_id,channel)
  VALUES (_substitute,'troca_pedido:'||rid,'Pedido de substituição',
    format('%s pediu que você o substitua em %s (%s). Responda em Escalas.', (SELECT full_name FROM profiles WHERE id=auth.uid()), ev.name, to_char(ev.date,'DD/MM')),
    _sid,s.event_id,'app') ON CONFLICT (schedule_id,type,channel) WHERE schedule_id IS NOT NULL DO NOTHING;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.respond_substitution(_rid uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r substitution_requests%ROWTYPE; l record;
BEGIN
  SELECT * INTO r FROM substitution_requests WHERE id=_rid FOR UPDATE;
  IF r.id IS NULL OR r.substitute_id<>auth.uid() THEN RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE='P0001'; END IF;
  IF r.status<>'pending_substitute' THEN RAISE EXCEPTION 'Este pedido já foi respondido.' USING ERRCODE='P0001'; END IF;
  PERFORM _evento_aberto(r.event_id);
  UPDATE substitution_requests SET status=CASE WHEN _accept THEN 'pending_leader' ELSE 'declined' END,
    substitute_responded_at=now(), updated_at=now() WHERE id=_rid;
  INSERT INTO notifications(user_id,type,title,body,schedule_id,event_id,channel)
  VALUES (r.requester_id,'troca_resp:'||_rid, CASE WHEN _accept THEN 'Substituto aceitou' ELSE 'Substituto recusou' END,
    CASE WHEN _accept THEN 'Seu pedido de troca aguarda aprovação do líder.' ELSE 'Seu pedido de troca foi recusado pelo substituto.' END,
    r.schedule_id,r.event_id,'app') ON CONFLICT (schedule_id,type,channel) WHERE schedule_id IS NOT NULL DO NOTHING;
  IF _accept THEN
    FOR l IN SELECT user_id FROM ministry_leaders WHERE ministry_id=r.ministry_id LOOP
      INSERT INTO notifications(user_id,type,title,body,schedule_id,event_id,channel)
      VALUES (l.user_id,'troca_aprovar:'||_rid||':'||l.user_id,'Troca aguardando aprovação','Há um pedido de substituição para aprovar em Escalas.',
        r.schedule_id,r.event_id,'app') ON CONFLICT (schedule_id,type,channel) WHERE schedule_id IS NOT NULL DO NOTHING;
    END LOOP;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.decide_substitution(_rid uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r substitution_requests%ROWTYPE; s schedules%ROWTYPE; nid uuid; u uuid;
BEGIN
  SELECT * INTO r FROM substitution_requests WHERE id=_rid FOR UPDATE;
  IF r.id IS NULL OR NOT can_manage_ministry(auth.uid(), r.ministry_id) THEN RAISE EXCEPTION 'Você não tem permissão para essa ação.' USING ERRCODE='P0001'; END IF;
  IF r.status<>'pending_leader' THEN RAISE EXCEPTION 'Este pedido não está aguardando aprovação.' USING ERRCODE='P0001'; END IF;
  PERFORM _evento_aberto(r.event_id);
  IF _approve THEN
    SELECT * INTO s FROM schedules WHERE id=r.schedule_id FOR UPDATE;
    UPDATE schedules SET status='replaced' WHERE id=s.id;
    INSERT INTO schedules(event_id,ministry_id,user_id,status,position,replaces_schedule_id,created_by)
    VALUES (s.event_id,s.ministry_id,r.substitute_id,'scheduled',s.position,s.id,auth.uid()) RETURNING id INTO nid;
  END IF;
  UPDATE substitution_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    decided_by=auth.uid(), decided_at=now(), new_schedule_id=nid, updated_at=now() WHERE id=_rid;
  FOREACH u IN ARRAY ARRAY[r.requester_id, r.substitute_id] LOOP
    INSERT INTO notifications(user_id,type,title,body,schedule_id,event_id,channel)
    VALUES (u,'troca_decisao:'||_rid||':'||u, CASE WHEN _approve THEN 'Troca aprovada' ELSE 'Troca rejeitada' END,
      CASE WHEN _approve THEN 'A escala foi atualizada com a substituição.' ELSE 'O líder rejeitou a substituição; a escala original foi mantida.' END,
      r.schedule_id,r.event_id,'app') ON CONFLICT (schedule_id,type,channel) WHERE schedule_id IS NOT NULL DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_substitution(_rid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE substitution_requests SET status='cancelled', updated_at=now()
  WHERE id=_rid AND requester_id=auth.uid() AND status IN ('pending_substitute','pending_leader');
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não pode ser cancelado.' USING ERRCODE='P0001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_event_cancelled(_eid uuid, _cancelled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e events%ROWTYPE;
BEGIN
  SELECT * INTO e FROM events WHERE id=_eid;
  IF e.id IS NULL OR NOT (is_admin_or_pastor(auth.uid()) OR (e.created_by=auth.uid() AND is_any_leader(auth.uid()))) THEN
    RAISE EXCEPTION 'Você não tem permissão para essa ação.' USING ERRCODE='P0001'; END IF;
  UPDATE events SET status = CASE WHEN _cancelled THEN 'cancelled' ELSE event_status_calc(date,start_time,end_time) END WHERE id=_eid;
  IF _cancelled THEN
    UPDATE substitution_requests SET status='cancelled', updated_at=now() WHERE event_id=_eid AND status IN ('pending_substitute','pending_leader');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.events_status_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.status := event_status_calc(NEW.date,NEW.start_time,NEW.end_time);
  ELSIF OLD.status='cancelled' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN NULL;
  ELSIF NEW.status IS NOT DISTINCT FROM OLD.status THEN NEW.status := event_status_calc(NEW.date,NEW.start_time,NEW.end_time);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_status_guard BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.events_status_guard();

CREATE OR REPLACE FUNCTION public.process_schedule_reminders()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n integer := 0; c integer;
BEGIN
  PERFORM refresh_event_statuses();
  WITH base AS (
    SELECT s.id sid, s.user_id, e.id eid, e.name ename, e.date, e.start_time, m.name mname, p.full_name,
           ((e.date + e.start_time) AT TIME ZONE 'America/Fortaleza') ts
    FROM schedules s
    JOIN events e ON e.id = s.event_id AND e.active AND e.status <> 'cancelled'
    JOIN ministries m ON m.id = s.ministry_id
    JOIN profiles p ON p.id = s.user_id AND p.active AND p.reminders_enabled
    WHERE s.status IN ('scheduled','confirmed') AND s.response <> 'declined'
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
           ((e.date + e.start_time) AT TIME ZONE 'America/Fortaleza') ts
    FROM schedules s
    JOIN events e ON e.id = s.event_id AND e.active AND e.status <> 'cancelled'
    JOIN ministries m ON m.id = s.ministry_id
    JOIN profiles p ON p.id = s.user_id AND p.active AND p.reminders_enabled
    WHERE s.status IN ('scheduled','confirmed') AND s.response <> 'declined'
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
END $function$;

GRANT EXECUTE ON FUNCTION public.respond_schedule(uuid,text), public.substitute_candidates(uuid), public.request_substitution(uuid,uuid,text),
  public.respond_substitution(uuid,boolean), public.decide_substitution(uuid,boolean), public.cancel_substitution(uuid), public.set_event_cancelled(uuid,boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_event_statuses(), public._evento_aberto(uuid) FROM public, anon, authenticated;