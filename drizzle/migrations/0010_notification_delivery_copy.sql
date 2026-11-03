-- Only triggers may use these privileged helpers: no callable public notification RPC.
CREATE OR REPLACE FUNCTION private.notification_copy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ev public.events%ROWTYPE; s public.schedules%ROWTYPE; ministry text; context text; kind text; req public.substitution_requests%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.user_id AND active) THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.schedules WHERE id=NEW.schedule_id;
  SELECT * INTO ev FROM public.events WHERE id=coalesce(NEW.event_id,s.event_id);
  SELECT name INTO ministry FROM public.ministries WHERE id=s.ministry_id;
  kind:=split_part(NEW.type,':',1);
  IF ev.id IS NOT NULL THEN
    context:=format('%s às %s · %s · %s (Fortaleza).',to_char(ev.date,'DD/MM/YYYY'),to_char(ev.start_time,'HH24:MI'),left(coalesce(ministry,'Equipe'),60),left(ev.name,90));
    CASE kind
      WHEN 'schedule_published' THEN NEW.title:='Você foi escalado'; NEW.body:=context||' Confira sua escala e confirme presença no Libens.';
      WHEN 'reminder_24h' THEN NEW.title:='Lembrete da sua escala'; NEW.body:=context||' Confira os detalhes e confirme sua presença.';
      WHEN 'reminder_2h' THEN NEW.title:='Sua escala se aproxima'; NEW.body:=context||' Prepare-se para servir. Em caso de imprevisto, avise pelo Libens.';
      WHEN 'troca_pedido' THEN
        SELECT * INTO req FROM public.substitution_requests WHERE id=split_part(NEW.type,':',2)::uuid;
        NEW.title:='Pedido de substituição'; NEW.body:=format('%s pediu sua ajuda. %s Responda em Escalas.',left(coalesce((SELECT full_name FROM public.profiles WHERE id=req.requester_id),'Um membro'),60),context);
      WHEN 'troca_resp' THEN
        SELECT * INTO req FROM public.substitution_requests WHERE id=split_part(NEW.type,':',2)::uuid;
        NEW.title:=CASE WHEN req.status='pending_leader' THEN 'Substituto aceitou' ELSE 'Substituto recusou' END;
        NEW.body:=context||CASE WHEN req.status='pending_leader' THEN ' Aguardando aprovação do líder; a troca ainda não está concluída.' ELSE ' A escala original foi mantida. Escolha outro substituto no Libens.' END;
      WHEN 'troca_aprovar' THEN NEW.title:='Substituição aguardando aprovação'; NEW.body:=context||' O substituto aceitou. Analise o pedido em Escalas.';
      WHEN 'troca_decisao' THEN
        SELECT * INTO req FROM public.substitution_requests WHERE id=split_part(NEW.type,':',2)::uuid;
        NEW.title:=CASE WHEN req.status='approved' THEN 'Substituição aprovada' ELSE 'Substituição não aprovada' END;
        NEW.body:=context||CASE WHEN req.status='approved' THEN ' A escala foi atualizada. Confira quem vai servir no Libens.' ELSE ' A escala original foi mantida. Consulte o líder.' END;
      WHEN 'recusa' THEN NEW.title:='Um membro não poderá servir'; NEW.body:=context||' Confira a recusa e organize a substituição em Escalas.';
      ELSE NULL;
    END CASE;
  END IF;
  NEW.title:=left(regexp_replace(NEW.title,E'[\\n\\r\\t]+',' ','g'),100);
  NEW.body:=left(regexp_replace(coalesce(NEW.body,''),E'[\\n\\r\\t]+',' ','g'),500);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.notification_copy() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER notification_copy BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION private.notification_copy();

CREATE OR REPLACE FUNCTION private.notify_schedule_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.status NOT IN ('scheduled','confirmed') OR NEW.replaces_schedule_id IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN IF OLD.status<>'draft' THEN RETURN NEW; END IF; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=NEW.event_id AND active AND status NOT IN ('cancelled','completed')) THEN RETURN NEW; END IF;
  INSERT INTO public.notifications(user_id,type,title,body,schedule_id,event_id,channel)
  VALUES(NEW.user_id,'schedule_published','Você foi escalado','Consulte sua escala no Libens.',NEW.id,NEW.event_id,'app')
  ON CONFLICT(schedule_id,type,channel) WHERE schedule_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.notify_schedule_published() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER schedule_published AFTER INSERT OR UPDATE OF status ON public.schedules FOR EACH ROW EXECUTE FUNCTION private.notify_schedule_published();

CREATE OR REPLACE FUNCTION public.process_schedule_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
  PERFORM public.refresh_event_statuses();
  WITH base AS (
    SELECT s.id,s.user_id,e.id eid,e.date,e.start_time,
      (e.date+e.start_time) AT TIME ZONE 'America/Fortaleza' AS starts
    FROM public.schedules s JOIN public.events e ON e.id=s.event_id
    JOIN public.profiles p ON p.id=s.user_id
    WHERE p.active AND p.reminders_enabled AND e.active AND e.status NOT IN ('cancelled','completed')
      AND s.status IN ('scheduled','confirmed') AND s.response<>'declined'
      AND e.date BETWEEN (now() AT TIME ZONE 'America/Fortaleza')::date AND (now() AT TIME ZONE 'America/Fortaleza')::date+2
  )
  INSERT INTO public.notifications(user_id,type,title,body,schedule_id,event_id,channel)
    SELECT b.user_id, r.kind||':'||to_char(b.date,'YYYYMMDD')||to_char(b.start_time,'HH24MISS'),
      'Lembrete da sua escala','Consulte sua escala no Libens.',b.id,b.eid,'app'
    FROM base b CROSS JOIN (VALUES ('reminder_24h',interval '24 hours'),('reminder_2h',interval '2 hours')) r(kind,advance)
    WHERE now()>=b.starts-r.advance AND now()<b.starts-r.advance+interval '15 minutes'
      -- Do not repeat legacy reminders already created for this schedule before the upgrade.
      AND NOT EXISTS(SELECT 1 FROM public.notifications old WHERE old.schedule_id=b.id AND old.channel='app' AND old.type=r.kind AND old.created_at>=b.starts-r.advance AND old.created_at<b.starts)
    ON CONFLICT(schedule_id,type,channel) WHERE schedule_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.process_schedule_reminders() FROM PUBLIC,anon,authenticated;

-- Event edits notify published teams; automatic completion does not create noise.
CREATE OR REPLACE FUNCTION private.notify_event_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE title text;
BEGIN
  IF ROW(NEW.name,NEW.date,NEW.start_time,NEW.end_time,NEW.location,NEW.active) IS NOT DISTINCT FROM ROW(OLD.name,OLD.date,OLD.start_time,OLD.end_time,OLD.location,OLD.active)
    AND (NEW.status=OLD.status OR NEW.status='completed') THEN RETURN NEW; END IF;
  title:=CASE WHEN NEW.status='cancelled' OR NOT NEW.active THEN 'Evento cancelado' WHEN OLD.status='cancelled' OR NOT OLD.active THEN 'Evento reativado' ELSE 'Evento atualizado' END;
  INSERT INTO public.notifications(user_id,type,title,body,schedule_id,event_id,channel)
    SELECT s.user_id,'event_changed:'||pg_catalog.txid_current()::text,title,
      format('%s às %s · %s. %s Confira a programação no Libens.',to_char(NEW.date,'DD/MM/YYYY'),to_char(NEW.start_time,'HH24:MI'),left(NEW.name,90),CASE WHEN NEW.status='cancelled' OR NOT NEW.active THEN 'Este evento foi cancelado; você não precisa servir nele.' ELSE 'A programação mudou.' END),s.id,NEW.id,'app'
    FROM public.schedules s WHERE s.event_id=NEW.id AND s.status IN ('scheduled','confirmed')
    ON CONFLICT(schedule_id,type,channel) WHERE schedule_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.notify_event_changed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER event_changed AFTER UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION private.notify_event_changed();

DO $$ DECLARE job record; BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_extension WHERE extname='pg_cron') THEN
   FOR job IN EXECUTE 'SELECT jobid FROM cron.job WHERE jobname=''libens-lembretes-escala''' LOOP
     PERFORM cron.alter_job(job.jobid,schedule:='* * * * *');
   END LOOP;
 END IF;
END $$;
