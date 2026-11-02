-- PROPOSTA: validada localmente; ainda não aplicada à produção.
-- Aplicar em transação, antes do frontend desta branch, após autorização específica.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_active_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active)
$$;
REVOKE ALL ON FUNCTION private.is_active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_active_user() TO authenticated;

CREATE OR REPLACE FUNCTION private.require_active_user()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_active_user() THEN
    RAISE EXCEPTION 'Sessão válida e conta ativa são obrigatórias.' USING ERRCODE='42501';
  END IF;
  RETURN auth.uid();
END $$;
REVOKE ALL ON FUNCTION private.require_active_user() FROM PUBLIC, anon, authenticated;

-- Contatos não são parte do diretório público de membros.
CREATE OR REPLACE FUNCTION public.list_people()
RETURNS TABLE(id uuid, full_name text, email text, phone text, role public.app_role, active boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id,p.full_name,
    CASE WHEN p.id=auth.uid() OR public.is_admin_or_pastor(auth.uid()) OR public.leads_user(auth.uid(),p.id) THEN p.email ELSE '' END,
    CASE WHEN p.id=auth.uid() OR public.is_admin_or_pastor(auth.uid()) OR public.leads_user(auth.uid(),p.id) THEN p.phone ELSE NULL END,
    p.role,p.active,p.created_at
  FROM public.profiles p
  WHERE p.id=auth.uid() OR (private.is_active_user() AND
    (public.is_admin_or_pastor(auth.uid()) OR public.shares_ministry(auth.uid(),p.id)))
$$;
REVOKE ALL ON FUNCTION public.list_people() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_people() TO authenticated;
-- A revogação das colunas ocorre na etapa 2, após publicar o frontend compatível.

-- Regras restritivas combinam com as políticas existentes (AND).
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ministries','user_ministries','ministry_leaders','availability','events',
    'event_ministry_needs','schedules','notifications','event_templates','substitution_requests'] LOOP
    EXECUTE format('CREATE POLICY "Conta ativa obrigatória" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.is_active_user()) WITH CHECK (private.is_active_user())',t);
  END LOOP;
END $$;
CREATE POLICY "Perfil: leitura ativa ou própria" ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (id=auth.uid() OR private.is_active_user());
CREATE POLICY "Perfil: atualização ativa" ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (private.is_active_user()) WITH CHECK (private.is_active_user());

DROP POLICY "Todos leem membros" ON public.user_ministries;
CREATE POLICY "Vínculos visíveis" ON public.user_ministries FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.is_admin_or_pastor(auth.uid()) OR public.shares_ministry(auth.uid(),user_id));
DROP POLICY "Todos leem líderes" ON public.ministry_leaders;
CREATE POLICY "Lideranças visíveis" ON public.ministry_leaders FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.is_admin_or_pastor(auth.uid()) OR public.shares_ministry(auth.uid(),user_id));

DROP POLICY "Avatar: ver" ON storage.objects;
CREATE POLICY "Avatar: ver autorizado" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='avatars' AND private.is_active_user() AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id::text=(storage.foldername(name))[1]
      AND (p.id=auth.uid() OR public.is_admin_or_pastor(auth.uid()) OR public.shares_ministry(auth.uid(),p.id))));
CREATE POLICY "Avatar: conta ativa" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id <> 'avatars' OR private.is_active_user())
  WITH CHECK (bucket_id <> 'avatars' OR private.is_active_user());
UPDATE storage.buckets SET allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp']
  WHERE id='avatars';

-- Término padrão também funciona após meia-noite.
CREATE OR REPLACE FUNCTION public.event_status_calc(_date date, _start time, _end time, _now timestamptz DEFAULT now())
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN _now >= ((_date + coalesce(_end,_start) +
      CASE WHEN _end IS NULL THEN interval '2 hours' WHEN _end<=_start THEN interval '1 day' ELSE interval '0' END)
      AT TIME ZONE 'America/Fortaleza') THEN 'completed'
    WHEN _now >= ((_date+_start) AT TIME ZONE 'America/Fortaleza') THEN 'in_progress'
    ELSE 'scheduled' END
$$;

-- Validação central: se qualquer chamada falhar, o chamador transacional reverte tudo.
CREATE OR REPLACE FUNCTION private.schedule_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ev public.events%ROWTYPE; inicio timestamptz; fim timestamptz;
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IN ('cancelled','replaced','completed') AND
    (NEW.user_id,NEW.event_id,NEW.ministry_id) IS NOT DISTINCT FROM (OLD.user_id,OLD.event_id,OLD.ministry_id) THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' AND NEW.status NOT IN ('draft','scheduled') THEN
    RAISE EXCEPTION 'Uma escala nova deve ser rascunho ou publicada.' USING ERRCODE='P0001';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.user_id,NEW.event_id,NEW.ministry_id,NEW.status) IS NOT DISTINCT FROM
    (OLD.user_id,OLD.event_id,OLD.ministry_id,OLD.status) THEN RETURN NEW; END IF;
  -- Todos os escritores de escalas usam o mesmo bloqueio de pessoa.
  PERFORM 1 FROM public.profiles WHERE id=NEW.user_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=NEW.user_id AND active) OR
     NOT EXISTS (SELECT 1 FROM public.user_ministries WHERE user_id=NEW.user_id AND ministry_id=NEW.ministry_id) THEN
    RAISE EXCEPTION 'Selecione um membro ativo deste ministério.' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO ev FROM public.events WHERE id=NEW.event_id;
  IF ev.id IS NULL OR NOT ev.active OR ev.status='cancelled' OR public.event_status_calc(ev.date,ev.start_time,ev.end_time)='completed' THEN
    RAISE EXCEPTION 'Evento encerrado, cancelado ou inexistente.' USING ERRCODE='P0001';
  END IF;
  inicio := (ev.date+ev.start_time) AT TIME ZONE 'America/Fortaleza';
  fim := (ev.date+coalesce(ev.end_time,ev.start_time)+
    CASE WHEN ev.end_time IS NULL THEN interval '2 hours' WHEN ev.end_time<=ev.start_time THEN interval '1 day' ELSE interval '0' END)
    AT TIME ZONE 'America/Fortaleza';
  IF EXISTS (SELECT 1 FROM public.schedules s JOIN public.events e ON e.id=s.event_id
    WHERE s.user_id=NEW.user_id AND s.id IS DISTINCT FROM NEW.id AND s.status NOT IN ('cancelled','replaced','completed')
      AND e.active AND e.status NOT IN ('cancelled','completed') AND
      ((s.event_id=NEW.event_id) OR
      ((e.date+e.start_time) AT TIME ZONE 'America/Fortaleza' < fim AND
       (e.date+coalesce(e.end_time,e.start_time)+CASE WHEN e.end_time IS NULL THEN interval '2 hours'
        WHEN e.end_time<=e.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'America/Fortaleza' > inicio))) THEN
    RAISE EXCEPTION 'Este membro já tem escala neste evento ou em horário conflitante.' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.schedule_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER schedule_integrity BEFORE INSERT OR UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION private.schedule_guard();

CREATE OR REPLACE FUNCTION public.save_schedule(_event_id uuid,_ministry_id uuid,_users uuid[],_publish boolean,_required integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid; uid uuid; ev public.events%ROWTYPE;
BEGIN
  actor := private.require_active_user();
  IF NOT public.can_manage_ministry(actor,_ministry_id) THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE='42501'; END IF;
  IF _users IS NULL OR _publish IS NULL OR _required IS NULL OR _required NOT BETWEEN 0 AND 100 OR cardinality(_users)>100
    OR EXISTS (SELECT 1 FROM unnest(_users) u WHERE u IS NULL) THEN RAISE EXCEPTION 'Dados inválidos.' USING ERRCODE='P0001'; END IF;
  -- Serializa edições da mesma escala; não apaga histórico publicado.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_event_id::text||_ministry_id::text,0));
  SELECT * INTO ev FROM public.events WHERE id=_event_id FOR SHARE;
  IF ev.id IS NULL OR NOT ev.active OR ev.status='cancelled' OR public.event_status_calc(ev.date,ev.start_time,ev.end_time)='completed' THEN
    RAISE EXCEPTION 'Evento encerrado ou cancelado.' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=ANY(_users) ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM unnest(_users) u WHERE NOT EXISTS
    (SELECT 1 FROM public.profiles p JOIN public.user_ministries m ON m.user_id=p.id
      WHERE p.id=u AND p.active AND m.ministry_id=_ministry_id)) THEN
    RAISE EXCEPTION 'Selecione um membro ativo deste ministério.' USING ERRCODE='P0001';
  END IF;
  IF NOT public.is_admin_or_pastor(actor) AND EXISTS (SELECT 1 FROM public.schedules
    WHERE event_id=_event_id AND ministry_id=_ministry_id AND status NOT IN ('cancelled','replaced','completed')
      AND created_by IS DISTINCT FROM actor AND (NOT user_id=ANY(_users) OR (_publish AND status='draft'))) THEN
    RAISE EXCEPTION 'Você só pode alterar as escalas que criou.' USING ERRCODE='42501'; END IF;
  DELETE FROM public.schedules WHERE event_id=_event_id AND ministry_id=_ministry_id AND status='draft' AND NOT user_id=ANY(_users);
  UPDATE public.schedules SET status='cancelled' WHERE event_id=_event_id AND ministry_id=_ministry_id
    AND status IN ('scheduled','confirmed') AND NOT user_id=ANY(_users);
  FOREACH uid IN ARRAY _users LOOP
    IF NOT EXISTS (SELECT 1 FROM public.schedules WHERE event_id=_event_id AND ministry_id=_ministry_id AND user_id=uid
      AND status NOT IN ('cancelled','replaced')) THEN
      INSERT INTO public.schedules(event_id,ministry_id,user_id,status,created_by)
        VALUES (_event_id,_ministry_id,uid,CASE WHEN _publish THEN 'scheduled' ELSE 'draft' END,actor);
    END IF;
  END LOOP;
  IF _publish THEN UPDATE public.schedules SET status='scheduled' WHERE event_id=_event_id AND ministry_id=_ministry_id AND status='draft'; END IF;
  INSERT INTO public.event_ministry_needs(event_id,ministry_id,required_count) VALUES (_event_id,_ministry_id,_required)
    ON CONFLICT(event_id,ministry_id) DO UPDATE SET required_count=excluded.required_count;
END $$;
REVOKE ALL ON FUNCTION public.save_schedule(uuid,uuid,uuid[],boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_schedule(uuid,uuid,uuid[],boolean,integer) TO authenticated;

-- RPCs existentes endurecidas abaixo; nenhuma tabela de membros é apagada.
CREATE OR REPLACE FUNCTION public.respond_schedule(_sid uuid, _response text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s schedules%ROWTYPE; ev events%ROWTYPE; l record;
BEGIN
  PERFORM private.require_active_user();
  IF _response IS NULL OR _response NOT IN ('confirmed','declined') THEN RAISE EXCEPTION 'Resposta inválida' USING ERRCODE='P0001'; END IF;
  SELECT * INTO s FROM schedules WHERE id=_sid;
  IF s.id IS NULL OR s.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Você só pode responder às suas escalas.' USING ERRCODE='P0001'; END IF;
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

CREATE OR REPLACE FUNCTION public.request_substitution(_sid uuid, _substitute uuid, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s schedules%ROWTYPE; rid uuid; ev events%ROWTYPE;
BEGIN
  PERFORM private.require_active_user();
  SELECT * INTO s FROM schedules WHERE id=_sid;
  IF s.id IS NULL OR s.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Você só pode pedir troca das suas escalas.' USING ERRCODE='P0001'; END IF;
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
  PERFORM private.require_active_user();
  IF _accept IS NULL THEN RAISE EXCEPTION 'Resposta inválida'; END IF;
  SELECT * INTO r FROM substitution_requests WHERE id=_rid FOR UPDATE;
  IF r.id IS NULL OR r.substitute_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE='P0001'; END IF;
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
  PERFORM private.require_active_user();
  IF _approve IS NULL THEN RAISE EXCEPTION 'Resposta inválida'; END IF;
  SELECT * INTO r FROM substitution_requests WHERE id=_rid FOR UPDATE;
  IF r.id IS NULL OR NOT can_manage_ministry(auth.uid(), r.ministry_id) THEN RAISE EXCEPTION 'Você não tem permissão para essa ação.' USING ERRCODE='P0001'; END IF;
  IF r.status<>'pending_leader' THEN RAISE EXCEPTION 'Este pedido não está aguardando aprovação.' USING ERRCODE='P0001'; END IF;
  PERFORM _evento_aberto(r.event_id);
  IF _approve THEN
    SELECT * INTO s FROM schedules WHERE id=r.schedule_id FOR UPDATE;
    PERFORM 1 FROM profiles WHERE id=r.substitute_id FOR UPDATE;
    IF s.id IS NULL OR s.status NOT IN ('scheduled','confirmed') OR s.user_id IS DISTINCT FROM r.requester_id
      OR NOT EXISTS (SELECT 1 FROM substitute_candidates(s.id) c WHERE c.user_id=r.substitute_id) THEN
      RAISE EXCEPTION 'A escala ou disponibilidade do substituto mudou. Solicite nova troca.' USING ERRCODE='P0001';
    END IF;
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
  PERFORM private.require_active_user();
  UPDATE substitution_requests SET status='cancelled', updated_at=now()
  WHERE id=_rid AND requester_id=auth.uid() AND status IN ('pending_substitute','pending_leader');
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não pode ser cancelado.' USING ERRCODE='P0001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_event_cancelled(_eid uuid, _cancelled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e events%ROWTYPE;
BEGIN
  PERFORM private.require_active_user();
  IF _cancelled IS NULL THEN RAISE EXCEPTION 'Resposta inválida'; END IF;
  SELECT * INTO e FROM events WHERE id=_eid;
  IF e.id IS NULL OR NOT (is_admin_or_pastor(auth.uid()) OR (e.created_by=auth.uid() AND is_any_leader(auth.uid()))) THEN
    RAISE EXCEPTION 'Você não tem permissão para essa ação.' USING ERRCODE='P0001'; END IF;
  UPDATE events SET status = CASE WHEN _cancelled THEN 'cancelled' ELSE event_status_calc(date,start_time,end_time) END WHERE id=_eid;
  IF _cancelled THEN
    UPDATE substitution_requests SET status='cancelled', updated_at=now() WHERE event_id=_eid AND status IN ('pending_substitute','pending_leader');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.substitute_candidates(_sid uuid)
RETURNS TABLE(user_id uuid, full_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.full_name FROM schedules s
  JOIN events e ON e.id=s.event_id
  JOIN user_ministries um ON um.ministry_id=s.ministry_id
  JOIN profiles p ON p.id=um.user_id AND p.active
  WHERE private.is_active_user() AND s.id=_sid AND (s.user_id=auth.uid() OR can_manage_ministry(auth.uid(), s.ministry_id))
    AND p.id<>s.user_id
    AND NOT EXISTS (SELECT 1 FROM availability a WHERE a.user_id=p.id AND a.date=e.date AND NOT a.available)
    AND NOT EXISTS (SELECT 1 FROM schedules x JOIN events ex ON ex.id=x.event_id
       WHERE x.user_id=p.id AND x.status NOT IN ('cancelled','replaced') AND ex.date=e.date
         AND ex.start_time < coalesce(e.end_time, e.start_time + interval '2 hours')
         AND coalesce(ex.end_time, ex.start_time + interval '2 hours') > e.start_time)
  ORDER BY p.full_name
$$;

REVOKE EXECUTE ON FUNCTION public.respond_schedule(uuid,text),public.request_substitution(uuid,uuid,text),
 public.respond_substitution(uuid,boolean),public.decide_substitution(uuid,boolean),public.cancel_substitution(uuid),
 public.set_event_cancelled(uuid,boolean),public.substitute_candidates(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_schedule(uuid,text),public.request_substitution(uuid,uuid,text),
 public.respond_substitution(uuid,boolean),public.decide_substitution(uuid,boolean),public.cancel_substitution(uuid),
 public.set_event_cancelled(uuid,boolean),public.substitute_candidates(uuid) TO authenticated;
COMMIT;
