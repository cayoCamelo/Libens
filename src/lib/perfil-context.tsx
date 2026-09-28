import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Perfil, Servo } from "@/types/libens";

/**
 * Sessão real: usuário autenticado + linha em `profiles`.
 * `usuario` mantém o formato de `Servo` para os componentes existentes.
 */
interface SessaoContextValue {
  carregando: boolean;
  autenticado: boolean;
  perfil: Perfil;
  usuario: Servo;
  ativo: boolean;
  sair: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
}

const usuarioVazio: Servo = { id: "", nome: "", email: "", perfil: "servo", ministerioIds: [] };

const SessaoContext = createContext<SessaoContextValue | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Servo>(usuarioVazio);
  const [ativo, setAtivo] = useState(true);
  const [carregando, setCarregando] = useState(true);

  const carregarPerfil = useCallback(async (s: Session | null) => {
    if (!s) {
      setUsuario(usuarioVazio);
      setCarregando(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, role, active")
      .eq("id", s.user.id)
      .maybeSingle();
    setUsuario({
      id: s.user.id,
      nome: data?.full_name || s.user.email?.split("@")[0] || "Usuário",
      email: data?.email || s.user.email || "",
      telefone: data?.phone ?? undefined,
      perfil: (data?.role as Perfil) ?? "servo",
      ministerioIds: [],
    });
    setAtivo(data?.active ?? true);
    setCarregando(false);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setTimeout(() => {
          void carregarPerfil(s);
          router.invalidate();
        }, 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void carregarPerfil(data.session);
    });
    return () => sub.subscription.unsubscribe();
  }, [carregarPerfil, router]);

  const sair = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/login", replace: true });
  }, [queryClient, router]);

  const value = useMemo<SessaoContextValue>(
    () => ({
      carregando,
      autenticado: !!session,
      perfil: usuario.perfil,
      usuario,
      ativo,
      sair,
      recarregarPerfil: () => carregarPerfil(session),
    }),
    [carregando, session, usuario, ativo, sair, carregarPerfil],
  );

  return <SessaoContext.Provider value={value}>{children}</SessaoContext.Provider>;
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error("useSessao deve ser usado dentro de SessaoProvider");
  return ctx;
}
