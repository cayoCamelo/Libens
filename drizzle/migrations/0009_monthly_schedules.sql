-- Custom SQL migration file, put your code below! --
-- Geração mensal aditiva: mantém escalas existentes e grava o mês em uma transação.
CREATE OR REPLACE FUNCTION public.month_schedule_context(_ministry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid; mes date; resultado jsonb;
BEGIN
  actor := private.require_active_user();
  IF NOT public.can_manage_ministry(actor,_ministry_id) THEN
    RAISE EXCEPTION 'Você não gerencia este ministério.' USING ERRCODE='42501';
  END IF;
  mes := date_trunc('month',now() AT TIME ZONE 'America/Fortaleza')::date;
  SELECT jsonb_build_object('month',mes,'people',coalesce((
    SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,
      'month_count',(SELECT count(*) FROM public.schedules s JOIN public.events e ON e.id=s.event_id
        WHERE s.user_id=p.id AND s.status IN ('draft','scheduled','confirmed','completed') AND e.status<>'cancelled'
          AND e.date>=mes AND e.date<(mes+interval '1 month')),
      'previous_count',(SELECT count(*) FROM public.schedules s JOIN public.events e ON e.id=s.event_id
        WHERE s.user_id=p.id AND s.status IN ('scheduled','confirmed','completed') AND e.status<>'cancelled' AND e.date<mes),
      'last_date',(SELECT max(e.date) FROM public.schedules s JOIN public.events e ON e.id=s.event_id
        WHERE s.user_id=p.id AND s.status IN ('scheduled','confirmed','completed') AND e.status<>'cancelled' AND e.date<(now() AT TIME ZONE 'America/Fortaleza')::date)) ORDER BY p.full_name,p.id)
    FROM public.profiles p JOIN public.user_ministries m ON m.user_id=p.id
      WHERE m.ministry_id=_ministry_id AND p.active),'[]'::jsonb),
    'events',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'date',e.date,
      'start_time',e.start_time,'end_time',e.end_time,
      'required_count',coalesce((SELECT required_count FROM public.event_ministry_needs n WHERE n.event_id=e.id AND n.ministry_id=_ministry_id),0),
      'existing',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'user_id',s.user_id,'name',p.full_name,'status',s.status,
        'available',(SELECT a.available FROM public.availability a WHERE a.user_id=s.user_id AND a.date=e.date)) ORDER BY s.id)
        FROM public.schedules s JOIN public.profiles p ON p.id=s.user_id
        WHERE s.event_id=e.id AND s.ministry_id=_ministry_id AND s.status NOT IN ('cancelled','replaced')),'[]'::jsonb),
      'candidates',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',p.id,
        'available',(SELECT a.available FROM public.availability a WHERE a.user_id=p.id AND a.date=e.date),
        'conflict',EXISTS(SELECT 1 FROM public.schedules s JOIN public.events other ON other.id=s.event_id
          WHERE s.user_id=p.id AND s.status IN ('draft','scheduled','confirmed') AND other.active AND other.status NOT IN ('cancelled','completed')
            AND (s.event_id=e.id OR tsrange(e.date+e.start_time,
              e.date+coalesce(e.end_time,e.start_time)+CASE WHEN e.end_time IS NULL THEN interval '2 hours' WHEN e.end_time<=e.start_time THEN interval '1 day' ELSE interval '0' END,'[)')
            && tsrange(other.date+other.start_time,other.date+coalesce(other.end_time,other.start_time)+CASE WHEN other.end_time IS NULL THEN interval '2 hours' WHEN other.end_time<=other.start_time THEN interval '1 day' ELSE interval '0' END,'[)')))) ORDER BY p.id)
        FROM public.profiles p JOIN public.user_ministries m ON m.user_id=p.id
        WHERE m.ministry_id=_ministry_id AND p.active),'[]'::jsonb)) ORDER BY e.date,e.start_time,e.id)
      FROM public.events e WHERE e.active AND e.status NOT IN ('cancelled','completed')
        AND e.date>=mes AND e.date<(mes+interval '1 month')
        AND (e.date+e.start_time) AT TIME ZONE 'America/Fortaleza'>now()),'[]'::jsonb)) INTO resultado;
  RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.month_schedule_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.month_schedule_context(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_month_schedule(_ministry_id uuid,_month date,_plan jsonb,_publish boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid; mes date; item jsonb; escolhido jsonb; ev public.events%ROWTYPE;
  uid uuid; users uuid[]; expected uuid[]; current_ids uuid[]; required integer; added integer:=0;
BEGIN
  actor := private.require_active_user();
  IF NOT public.can_manage_ministry(actor,_ministry_id) THEN RAISE EXCEPTION 'Sem permissão para este ministério.' USING ERRCODE='42501'; END IF;
  mes := date_trunc('month',now() AT TIME ZONE 'America/Fortaleza')::date;
  IF _month IS DISTINCT FROM mes OR _publish IS NULL OR _plan IS NULL OR jsonb_typeof(_plan)<>'array' THEN
    RAISE EXCEPTION 'Gere novamente a sugestão do mês atual.' USING ERRCODE='P0001'; END IF;
  IF jsonb_array_length(_plan) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Quantidade de eventos inválida.' USING ERRCODE='P0001'; END IF;
  IF (SELECT count(DISTINCT x->>'event_id') FROM jsonb_array_elements(_plan) x)<>jsonb_array_length(_plan) THEN
    RAISE EXCEPTION 'Eventos repetidos ou inválidos.' USING ERRCODE='P0001'; END IF;
  -- Mesmo bloqueio usado pelo salvamento individual. Ordem fixa evita inversões entre eventos.
  FOR item IN SELECT x FROM jsonb_array_elements(_plan) x ORDER BY x->>'event_id' LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended((item->>'event_id')||_ministry_id::text,0));
  END LOOP;
  -- Mesma ordem de pessoas em toda a gravação; o trigger valida conflitos no banco.
  PERFORM 1 FROM public.profiles WHERE id IN (SELECT (s->>'user_id')::uuid FROM jsonb_array_elements(_plan) x
    CROSS JOIN LATERAL jsonb_array_elements(x->'selections') s) ORDER BY id FOR UPDATE;
  FOR item IN SELECT x FROM jsonb_array_elements(_plan) x ORDER BY x->>'event_id' LOOP
    SELECT * INTO ev FROM public.events WHERE id=(item->>'event_id')::uuid FOR SHARE;
    IF ev.id IS NULL OR NOT ev.active OR ev.status IN ('cancelled','completed') OR ev.date<mes OR ev.date>=mes+interval '1 month'
      OR (ev.date+ev.start_time) AT TIME ZONE 'America/Fortaleza'<=now() THEN
      RAISE EXCEPTION 'Um evento mudou ou já começou. Gere novamente a sugestão.' USING ERRCODE='P0001'; END IF;
    required := (item->>'required_count')::integer;
    IF required IS NULL OR required NOT BETWEEN 1 AND 100 OR jsonb_typeof(item->'selections') IS DISTINCT FROM 'array'
      OR jsonb_typeof(item->'existing_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Plano inválido.' USING ERRCODE='P0001'; END IF;
    SELECT coalesce(array_agg(x::uuid ORDER BY x::uuid),'{}'::uuid[]) INTO expected FROM jsonb_array_elements_text(item->'existing_ids') x;
    SELECT coalesce(array_agg(s.id ORDER BY s.id),'{}'::uuid[]) INTO current_ids FROM public.schedules s
      WHERE s.event_id=ev.id AND s.ministry_id=_ministry_id AND s.status NOT IN ('cancelled','replaced');
    IF expected IS DISTINCT FROM current_ids THEN RAISE EXCEPTION 'Uma escala foi alterada por outro gestor. Gere novamente para preservar os dados.' USING ERRCODE='P0001'; END IF;
    SELECT coalesce(array_agg((x->>'user_id')::uuid),'{}'::uuid[]) INTO users FROM jsonb_array_elements(item->'selections') x;
    IF cardinality(users)+cardinality(current_ids)>required OR (SELECT count(DISTINCT x) FROM unnest(users) x)<>cardinality(users)
      OR EXISTS(SELECT 1 FROM unnest(users) x WHERE x IS NULL) THEN RAISE EXCEPTION 'Membros repetidos ou quantidade inválida.' USING ERRCODE='P0001'; END IF;
    IF EXISTS(SELECT 1 FROM public.event_ministry_needs n WHERE n.event_id=ev.id AND n.ministry_id=_ministry_id AND n.required_count>required) THEN
      RAISE EXCEPTION 'A quantidade necessária mudou. Gere novamente a sugestão.' USING ERRCODE='P0001'; END IF;
    IF _publish AND cardinality(users)+cardinality(current_ids)<required THEN
      RAISE EXCEPTION 'Complete as vagas pendentes antes de publicar.' USING ERRCODE='P0001'; END IF;
    IF EXISTS(SELECT 1 FROM public.schedules s WHERE s.id=ANY(current_ids) AND s.user_id=ANY(users)) THEN
      RAISE EXCEPTION 'Um membro selecionado já está neste evento.' USING ERRCODE='P0001'; END IF;
    FOR escolhido IN SELECT x FROM jsonb_array_elements(item->'selections') x LOOP
      uid := (escolhido->>'user_id')::uuid;
      IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.user_ministries m ON m.user_id=p.id
        WHERE p.id=uid AND p.active AND m.ministry_id=_ministry_id) THEN
        RAISE EXCEPTION 'Selecione apenas membros ativos do ministério.' USING ERRCODE='P0001'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.availability a WHERE a.user_id=uid AND a.date=ev.date AND a.available)
        AND coalesce((escolhido->>'manual_confirmed')::boolean,false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Confirme a disponibilidade dos membros escolhidos manualmente.' USING ERRCODE='P0001'; END IF;
      INSERT INTO public.schedules(event_id,ministry_id,user_id,status,created_by)
        VALUES(ev.id,_ministry_id,uid,CASE WHEN _publish THEN 'scheduled' ELSE 'draft' END,actor);
      added:=added+1;
    END LOOP;
    IF _publish THEN
      IF NOT public.is_admin_or_pastor(actor) AND EXISTS(SELECT 1 FROM public.schedules s WHERE s.id=ANY(current_ids)
        AND s.status='draft' AND s.created_by IS DISTINCT FROM actor) THEN
        RAISE EXCEPTION 'Há rascunhos de outro gestor. Peça a publicação deles antes de continuar.' USING ERRCODE='P0001'; END IF;
      IF EXISTS(SELECT 1 FROM public.schedules s WHERE s.id=ANY(current_ids) AND s.status='draft'
        AND NOT EXISTS(SELECT 1 FROM public.availability a WHERE a.user_id=s.user_id AND a.date=ev.date AND a.available)
        AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(item->'confirmed_existing','[]'::jsonb)) c WHERE c#>>'{}'=s.user_id::text)) THEN
        RAISE EXCEPTION 'Confirme a disponibilidade dos rascunhos existentes antes de publicar.' USING ERRCODE='P0001'; END IF;
      UPDATE public.schedules SET status='scheduled' WHERE id=ANY(current_ids) AND status='draft';
    END IF;
    INSERT INTO public.event_ministry_needs(event_id,ministry_id,required_count) VALUES(ev.id,_ministry_id,required)
      ON CONFLICT(event_id,ministry_id) DO UPDATE SET required_count=greatest(public.event_ministry_needs.required_count,excluded.required_count);
  END LOOP;
  RETURN added;
END $$;
REVOKE ALL ON FUNCTION public.save_month_schedule(uuid,date,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_month_schedule(uuid,date,jsonb,boolean) TO authenticated;
