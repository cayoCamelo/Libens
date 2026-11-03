BEGIN;
-- Central access editor updates role and leadership atomically; existing memberships/history stay intact.
CREATE FUNCTION public.set_member_access(_uid uuid,_role public.app_role,_leaders uuid[],_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); target public.profiles%ROWTYPE; n integer;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id IN (actor,_uid) ORDER BY id FOR UPDATE;
 PERFORM private.require_active_user();
 IF NOT public.is_admin_or_pastor(actor) THEN RAISE EXCEPTION 'Somente Pastor(a) e Admin gerenciam acessos.' USING ERRCODE='42501'; END IF;
 SELECT * INTO target FROM public.profiles WHERE id=_uid;
 IF target.id IS NULL OR target.deleted_at IS NOT NULL OR target.role='admin' OR _uid=actor OR _role IS NULL OR _active IS NULL OR _role='admin' THEN RAISE EXCEPTION 'Conta protegida ou dados inválidos.' USING ERRCODE='42501'; END IF;
 IF NOT public.has_role(actor,'admin') AND (target.role NOT IN ('servo','lider') OR _role NOT IN ('servo','lider') OR _active IS DISTINCT FROM target.active) THEN
  RAISE EXCEPTION 'Somente Admin define Pastor(a) e altera status.' USING ERRCODE='42501'; END IF;
 IF _leaders IS NULL OR EXISTS(SELECT 1 FROM unnest(_leaders) x WHERE x IS NULL) THEN RAISE EXCEPTION 'Selecione os ministérios de liderança.' USING ERRCODE='P0001'; END IF;
 SELECT count(DISTINCT x) INTO n FROM unnest(_leaders) x;
 IF cardinality(_leaders)<>n OR n>2 OR (_role='lider' AND n<1) OR (_role<>'lider' AND n>0) THEN RAISE EXCEPTION 'Líder deve ter um ou dois ministérios de liderança.' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_leaders) x WHERE NOT EXISTS(SELECT 1 FROM public.ministries m WHERE m.id=x AND m.active)) THEN RAISE EXCEPTION 'Selecione ministérios ativos.' USING ERRCODE='P0001'; END IF;
 IF (SELECT count(*) FROM (SELECT ministry_id FROM public.user_ministries WHERE user_id=_uid UNION SELECT unnest(_leaders)) m)>2 AND EXISTS(SELECT 1 FROM unnest(_leaders) x WHERE NOT EXISTS(SELECT 1 FROM public.user_ministries m WHERE m.user_id=_uid AND m.ministry_id=x)) THEN
  RAISE EXCEPTION 'O membro pode participar de até dois ministérios. Revise seus vínculos.' USING ERRCODE='P0001'; END IF;
 DELETE FROM public.ministry_leaders WHERE user_id=_uid AND NOT ministry_id=ANY(_leaders);
 INSERT INTO public.user_ministries(user_id,ministry_id) SELECT _uid,x FROM unnest(_leaders) x ON CONFLICT(user_id,ministry_id) DO NOTHING;
 INSERT INTO public.ministry_leaders(user_id,ministry_id) SELECT _uid,x FROM unnest(_leaders) x ON CONFLICT(user_id,ministry_id) DO NOTHING;
 UPDATE public.profiles SET role=_role,active=_active WHERE id=_uid;
END $$;
REVOKE ALL ON FUNCTION public.set_member_access(uuid,public.app_role,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_member_access(uuid,public.app_role,uuid[],boolean) TO authenticated;
-- Browser clients use the RPC above rather than separate writes that can leave role/bindings inconsistent.
REVOKE INSERT,UPDATE,DELETE ON public.ministry_leaders FROM authenticated;
COMMIT;
