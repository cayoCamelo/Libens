BEGIN;
-- Public registration exposes only active ministry names, never member information.
CREATE FUNCTION public.signup_ministries() RETURNS TABLE(id uuid,name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT id,name FROM public.ministries WHERE active ORDER BY name
$$;
REVOKE ALL ON FUNCTION public.signup_ministries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signup_ministries() TO anon,authenticated;

CREATE FUNCTION public.complete_my_ministries(_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); n integer;
BEGIN
 PERFORM private.require_active_user();
 PERFORM 1 FROM public.profiles WHERE id=uid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.user_ministries WHERE user_id=uid) THEN RAISE EXCEPTION 'Seu ministério já está cadastrado.' USING ERRCODE='P0001'; END IF;
 SELECT count(DISTINCT x) INTO n FROM unnest(_ids) x;
 IF n NOT BETWEEN 1 AND 2 OR cardinality(_ids)<>n OR EXISTS(SELECT 1 FROM unnest(_ids) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM public.ministries m WHERE m.id=x AND m.active)) THEN
  RAISE EXCEPTION 'Selecione um ou dois ministérios ativos.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.user_ministries(user_id,ministry_id) SELECT uid,x FROM unnest(_ids) x;
END $$;
REVOKE ALL ON FUNCTION public.complete_my_ministries(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_my_ministries(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ids uuid[]; n integer;
BEGIN
 INSERT INTO public.profiles(id,full_name,email,role) VALUES(NEW.id,left(coalesce(NEW.raw_user_meta_data->>'full_name',''),120),coalesce(NEW.email,''),'servo');
 IF NEW.raw_user_meta_data ? 'ministry_ids' THEN
  SELECT array_agg(value::uuid) INTO ids FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'ministry_ids');
  SELECT count(DISTINCT x) INTO n FROM unnest(ids) x;
  IF n NOT BETWEEN 1 AND 2 OR cardinality(ids)<>n OR EXISTS(SELECT 1 FROM unnest(ids) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM public.ministries m WHERE m.id=x AND m.active)) THEN
   RAISE EXCEPTION 'Selecione um ou dois ministérios ativos.' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.user_ministries(user_id,ministry_id) SELECT NEW.id,x FROM unnest(ids) x;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
-- Keep one existing administrator; no authenticated operation can mint another.
CREATE UNIQUE INDEX profiles_one_admin ON public.profiles ((role)) WHERE role='admin';
CREATE OR REPLACE FUNCTION public.profiles_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 NEW.updated_at:=now();
 IF auth.uid() IS NOT NULL THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
   RAISE EXCEPTION 'Identidade e e-mail são protegidos.' USING ERRCODE='42501'; END IF;
  IF (NEW.role='admin' OR OLD.role='admin') AND NEW.role IS DISTINCT FROM OLD.role THEN
   RAISE EXCEPTION 'A conta administrativa é única e protegida.' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(auth.uid(),'admin') THEN
   IF ROW(NEW.active,NEW.deleted_at,NEW.deleted_by) IS DISTINCT FROM ROW(OLD.active,OLD.deleted_at,OLD.deleted_by) THEN
    RAISE EXCEPTION 'Somente Admin altera status e exclusão.' USING ERRCODE='42501'; END IF;
   IF NEW.role IS DISTINCT FROM OLD.role AND NOT (public.has_role(auth.uid(),'pastor') AND OLD.id<>auth.uid() AND OLD.role IN ('servo','lider') AND NEW.role IN ('servo','lider')) THEN
    RAISE EXCEPTION 'Sem permissão para alterar função.' USING ERRCODE='42501'; END IF;
  END IF;
 END IF;
 IF OLD.deleted_at IS NOT NULL AND (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by OR NEW.active OR NEW.role<>'servo') THEN
  RAISE EXCEPTION 'Cadastro excluído não pode ser reativado por esta operação.' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
-- Pastor also manages ministry creation; role assignments remain separately protected.
DROP POLICY "Admin cria ministérios" ON public.ministries;
CREATE POLICY "Gestão cria ministérios" ON public.ministries FOR INSERT TO authenticated WITH CHECK(public.is_admin_or_pastor(auth.uid()));
DROP POLICY "Líder adiciona membros" ON public.user_ministries;
DROP POLICY "Líder remove membros" ON public.user_ministries;

ALTER TABLE public.substitution_requests ADD COLUMN agreed_in_advance boolean NOT NULL DEFAULT false;
-- A new API coexists with the old approval workflow for requests already in progress.
CREATE FUNCTION public.substitution_options(_sid uuid,_agreed boolean DEFAULT false)
RETURNS TABLE(user_id uuid,full_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,p.full_name FROM public.schedules s JOIN public.events e ON e.id=s.event_id
 JOIN public.user_ministries um ON um.ministry_id=s.ministry_id
 JOIN public.profiles p ON p.id=um.user_id AND p.active AND p.deleted_at IS NULL
 WHERE private.is_active_user() AND s.id=_sid AND s.user_id=auth.uid() AND s.status IN ('scheduled','confirmed')
 AND p.id<>s.user_id AND e.active AND public.event_status_calc(e.date,e.start_time,e.end_time)<>'completed' AND e.status<>'cancelled'
 AND (_agreed OR EXISTS(SELECT 1 FROM public.availability a WHERE a.user_id=p.id AND a.date=e.date AND a.available))
 AND NOT EXISTS(SELECT 1 FROM public.schedules x JOIN public.events ex ON ex.id=x.event_id WHERE x.user_id=p.id AND x.status NOT IN ('cancelled','replaced','completed') AND ex.active AND ex.status NOT IN ('cancelled','completed') AND
  (x.event_id=e.id OR (
   (ex.date+ex.start_time) AT TIME ZONE 'America/Fortaleza' < (e.date+coalesce(e.end_time,e.start_time)+CASE WHEN e.end_time IS NULL THEN interval '2 hours' WHEN e.end_time<=e.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'America/Fortaleza'
   AND (ex.date+coalesce(ex.end_time,ex.start_time)+CASE WHEN ex.end_time IS NULL THEN interval '2 hours' WHEN ex.end_time<=ex.start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'America/Fortaleza' > (e.date+e.start_time) AT TIME ZONE 'America/Fortaleza')))
 ORDER BY p.full_name
$$;
CREATE FUNCTION public.request_substitution_v2(_sid uuid,_substitute uuid,_agreed boolean DEFAULT false,_reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE; rid uuid; ev public.events%ROWTYPE;
BEGIN
 PERFORM private.require_active_user();
 SELECT * INTO s FROM public.schedules WHERE id=_sid FOR UPDATE;
 IF s.id IS NULL OR s.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Você só pode pedir troca das suas escalas.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.substitution_options(_sid,coalesce(_agreed,false)) WHERE user_id=_substitute) THEN RAISE EXCEPTION 'Substituto indisponível ou com conflito.' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM public.substitution_requests WHERE schedule_id=_sid AND status IN ('pending_substitute','pending_leader')) THEN RAISE EXCEPTION 'Já existe um pedido em andamento.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.substitution_requests(schedule_id,event_id,ministry_id,requester_id,substitute_id,agreed_in_advance,reason)
 VALUES(s.id,s.event_id,s.ministry_id,s.user_id,_substitute,coalesce(_agreed,false),left(nullif(trim(_reason),''),300)) RETURNING id INTO rid;
 SELECT * INTO ev FROM public.events WHERE id=s.event_id;
 INSERT INTO public.notifications(user_id,type,title,body,schedule_id,event_id,channel) VALUES(_substitute,'troca_pedido:'||rid,'Pedido de substituição',format('Você foi convidado para servir em %s, %s às %s · %s. Abra Escalas para aceitar ou recusar.',ev.name,to_char(ev.date,'DD/MM/YYYY'),to_char(ev.start_time,'HH24:MI'),(SELECT name FROM public.ministries WHERE id=s.ministry_id)),s.id,s.event_id,'app');
 RETURN rid;
END $$;
CREATE FUNCTION public.respond_substitution_v2(_rid uuid,_accept boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.substitution_requests%ROWTYPE; s public.schedules%ROWTYPE; ev public.events%ROWTYPE; nid uuid; uid uuid;
BEGIN
 PERFORM private.require_active_user();
 IF _accept IS NULL THEN RAISE EXCEPTION 'Resposta inválida.' USING ERRCODE='P0001'; END IF;
 SELECT * INTO r FROM public.substitution_requests WHERE id=_rid FOR UPDATE;
 IF r.id IS NULL OR r.substitute_id IS DISTINCT FROM auth.uid() OR r.status<>'pending_substitute' THEN RAISE EXCEPTION 'Pedido não encontrado ou já respondido.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.schedules WHERE id=r.schedule_id FOR UPDATE;
 PERFORM public._evento_aberto(r.event_id);
 IF s.id IS NULL OR s.user_id IS DISTINCT FROM r.requester_id OR s.status NOT IN ('scheduled','confirmed') THEN RAISE EXCEPTION 'A escala mudou. Solicite nova troca.' USING ERRCODE='P0001'; END IF;
 IF _accept THEN
  -- Shared person locks serialize with every schedule writer; integrity trigger checks conflicts again.
  PERFORM 1 FROM public.profiles WHERE id IN (r.requester_id,r.substitute_id) ORDER BY id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=r.requester_id AND active AND deleted_at IS NULL) OR
     NOT EXISTS(SELECT 1 FROM public.user_ministries WHERE user_id=r.substitute_id AND ministry_id=r.ministry_id) THEN RAISE EXCEPTION 'O vínculo do membro mudou.' USING ERRCODE='P0001'; END IF;
  IF NOT r.agreed_in_advance AND NOT EXISTS(SELECT 1 FROM public.availability a JOIN public.events e ON e.id=r.event_id WHERE a.user_id=r.substitute_id AND a.date=e.date AND a.available) THEN RAISE EXCEPTION 'A disponibilidade mudou.' USING ERRCODE='P0001'; END IF;
  UPDATE public.schedules SET status='replaced' WHERE id=s.id;
  INSERT INTO public.schedules(event_id,ministry_id,user_id,status,position,replaces_schedule_id,created_by,response) VALUES(s.event_id,s.ministry_id,r.substitute_id,'scheduled',s.position,s.id,auth.uid(),'confirmed') RETURNING id INTO nid;
 END IF;
 UPDATE public.substitution_requests SET status=CASE WHEN _accept THEN 'approved' ELSE 'declined' END,substitute_responded_at=now(),decided_at=now(),decided_by=auth.uid(),new_schedule_id=nid,updated_at=now() WHERE id=_rid;
 SELECT * INTO ev FROM public.events WHERE id=r.event_id;
 FOR uid IN SELECT r.requester_id UNION SELECT user_id FROM public.ministry_leaders WHERE ministry_id=r.ministry_id LOOP
  INSERT INTO public.notifications(user_id,type,title,body,schedule_id,event_id,channel) VALUES(uid,'troca_resultado:'||_rid||':'||uid,CASE WHEN _accept THEN 'Substituição confirmada' ELSE 'Substituição recusada' END,format('%s · %s às %s · %s. %s',ev.name,to_char(ev.date,'DD/MM/YYYY'),to_char(ev.start_time,'HH24:MI'),(SELECT name FROM public.ministries WHERE id=r.ministry_id),CASE WHEN _accept THEN 'A escala foi atualizada após o aceite do substituto.' ELSE 'A escala original foi mantida.' END),r.schedule_id,r.event_id,'app');
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.substitution_options(uuid,boolean),public.request_substitution_v2(uuid,uuid,boolean,text),public.respond_substitution_v2(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.substitution_options(uuid,boolean),public.request_substitution_v2(uuid,uuid,boolean,text),public.respond_substitution_v2(uuid,boolean) TO authenticated;
COMMIT;
