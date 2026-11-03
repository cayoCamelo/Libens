-- Logical removal preserves historical identities and foreign keys.
ALTER TABLE public.profiles ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN deleted_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD CONSTRAINT deleted_profile_inactive CHECK (deleted_at IS NULL OR (NOT active AND role='servo'));
CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 NEW.updated_at:=now();
 IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
  IF ROW(NEW.role,NEW.active,NEW.email,NEW.id,NEW.deleted_at,NEW.deleted_by) IS DISTINCT FROM ROW(OLD.role,OLD.active,OLD.email,OLD.id,OLD.deleted_at,OLD.deleted_by) THEN
   RAISE EXCEPTION 'Sem permissão para alterar função, status ou exclusão.' USING ERRCODE='42501';
  END IF;
 END IF;
 IF OLD.deleted_at IS NOT NULL AND (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by OR NEW.active OR NEW.role<>'servo') THEN
   RAISE EXCEPTION 'Cadastro excluído não pode ser reativado por esta operação.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.profiles_guard() FROM PUBLIC,anon,authenticated;
DROP FUNCTION public.list_people();
CREATE FUNCTION public.list_people()
RETURNS TABLE(id uuid,full_name text,email text,phone text,role public.app_role,active boolean,created_at timestamptz,deleted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,p.full_name,
 CASE WHEN p.id=auth.uid() OR public.is_admin_or_pastor(auth.uid()) OR public.leads_user(auth.uid(),p.id) THEN p.email ELSE '' END,
 CASE WHEN p.id=auth.uid() OR public.is_admin_or_pastor(auth.uid()) OR public.leads_user(auth.uid(),p.id) THEN p.phone ELSE NULL END,
 p.role,p.active,p.created_at,p.deleted_at
 FROM public.profiles p
 WHERE p.id=auth.uid() OR (private.is_active_user() AND (public.is_admin_or_pastor(auth.uid()) OR public.shares_ministry(auth.uid(),p.id)))
$$;
REVOKE ALL ON FUNCTION public.list_people() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_people() TO authenticated;
CREATE FUNCTION public.delete_servo(_uid uuid,_confirmation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; target public.profiles%ROWTYPE;
BEGIN
 actor:=auth.uid();
 PERFORM 1 FROM public.profiles WHERE id IN (actor,_uid) ORDER BY id FOR UPDATE;
 PERFORM private.require_active_user();
 IF NOT public.has_role(actor,'admin') THEN RAISE EXCEPTION 'Somente o administrador pode excluir servos.' USING ERRCODE='42501'; END IF;
 IF _uid IS NULL OR _uid=actor OR _confirmation IS DISTINCT FROM 'EXCLUIR' THEN RAISE EXCEPTION 'Confirme a exclusão digitando EXCLUIR.' USING ERRCODE='P0001'; END IF;
 SELECT * INTO target FROM public.profiles WHERE id=_uid;
 IF target.id IS NULL OR target.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Cadastro não encontrado ou já excluído.' USING ERRCODE='P0001'; END IF;
 IF target.role<>'servo' THEN RAISE EXCEPTION 'Esta opção exclui apenas servos. Contas de liderança e administração são protegidas.' USING ERRCODE='42501'; END IF;
 UPDATE public.profiles SET active=false,reminders_enabled=false,deleted_at=now(),deleted_by=actor WHERE id=_uid;
 UPDATE public.substitution_requests SET status='cancelled',updated_at=now()
  WHERE (requester_id=_uid OR substitute_id=_uid) AND status IN ('pending_substitute','pending_leader');
 UPDATE public.schedules s SET status='cancelled' FROM public.events e
  WHERE s.event_id=e.id AND s.user_id=_uid AND s.status IN ('draft','scheduled','confirmed')
   AND (e.date+e.start_time) AT TIME ZONE 'America/Fortaleza'>now();
 DELETE FROM public.ministry_leaders WHERE user_id=_uid;
 DELETE FROM public.user_ministries WHERE user_id=_uid;
 RETURN;
END $$;
REVOKE ALL ON FUNCTION public.delete_servo(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_servo(uuid,text) TO authenticated;
