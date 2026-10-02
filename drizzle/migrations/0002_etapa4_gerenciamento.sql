CREATE POLICY "Pastor atualiza perfis não-admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'pastor') AND role <> 'admin')
  WITH CHECK (public.has_role(auth.uid(),'pastor') AND role <> 'admin');

CREATE POLICY "Líder adiciona membros" ON public.user_ministries FOR INSERT TO authenticated
  WITH CHECK (public.is_ministry_leader(auth.uid(), ministry_id));
CREATE POLICY "Líder remove membros" ON public.user_ministries FOR DELETE TO authenticated
  USING (public.is_ministry_leader(auth.uid(), ministry_id));

DROP POLICY IF EXISTS "Admin/pastor gerenciam ministérios" ON public.ministries;
CREATE POLICY "Admin cria ministérios" ON public.ministries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin apaga ministérios" ON public.ministries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin/pastor editam ministérios" ON public.ministries FOR UPDATE TO authenticated
  USING (public.is_admin_or_pastor(auth.uid())) WITH CHECK (public.is_admin_or_pastor(auth.uid()));

CREATE OR REPLACE FUNCTION public.ministries_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.active IS DISTINCT FROM OLD.active AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Somente o administrador ativa ou desativa ministérios';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ministries_guard BEFORE UPDATE ON public.ministries FOR EACH ROW EXECUTE FUNCTION public.ministries_guard();

CREATE OR REPLACE FUNCTION public.leader_ensure_member() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.user_ministries(user_id, ministry_id) VALUES (NEW.user_id, NEW.ministry_id)
  ON CONFLICT (user_id, ministry_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER leader_ensure_member AFTER INSERT ON public.ministry_leaders FOR EACH ROW EXECUTE FUNCTION public.leader_ensure_member();

INSERT INTO public.user_ministries(user_id, ministry_id)
SELECT user_id, ministry_id FROM public.ministry_leaders ON CONFLICT (user_id, ministry_id) DO NOTHING;