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
  useRef,
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
  erroPerfil: string | null;
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
  const [ativo, setAtivo] = useState(false);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);
  const carga = useRef(0);
  const identidade = useRef<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregarPerfil = useCallback(async (s: Session | null) => {
    const versao = ++carga.current;
    setCarregando(true);
    setErroPerfil(null);
    setAtivo(false);
    setUsuario(usuarioVazio);
    if (!s) {
      setCarregando(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .rpc("list_people")
        .eq("id", s.user.id)
        .maybeSingle();
      if (versao !== carga.current) return;
      if (error) throw new Error("Não foi possível carregar seu perfil. Tente novamente.");
      if (!data) throw new Error("Seu perfil não foi encontrado. Entre em contato com a administração.");
      setUsuario({
        id: data.id, nome: data.full_name || "Usuário", email: data.email,
        telefone: data.phone ?? undefined, perfil: data.role as Perfil, ministerioIds: [],
      });
      setAtivo(data.active);
    } catch (error) {
      if (versao === carga.current) setErroPerfil(error instanceof Error ? error.message : "Falha ao carregar perfil.");
    } finally {
      if (versao === carga.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let montado = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (identidade.current !== (s?.user.id ?? null)) {
        queryClient.clear();
        identidade.current = s?.user.id ?? null;
      }
      setAtivo(false);
      setCarregando(true);
      setUsuario(usuarioVazio);
      setSession(s);
      setTimeout(() => {
        if (!montado) return;
        void carregarPerfil(s);
        router.invalidate();
      }, 0);
    });
    return () => { montado = false; ++carga.current; sub.subscription.unsubscribe(); };
  }, [carregarPerfil, router, queryClient]);

  const sair = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErroPerfil("Não foi possível encerrar a sessão. Tente sair novamente.");
      return;
    }
    router.navigate({ to: "/login", replace: true });
  }, [queryClient, router]);

  const value = useMemo<SessaoContextValue>(
    () => ({
      carregando,
      autenticado: !!session,
      perfil: usuario.perfil,
      usuario,
      ativo,
      erroPerfil,
      sair,
      recarregarPerfil: () => carregarPerfil(session),
    }),
    [carregando, session, usuario, ativo, erroPerfil, sair, carregarPerfil],
  );

  return <SessaoContext.Provider value={value}>{children}</SessaoContext.Provider>;
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error("useSessao deve ser usado dentro de SessaoProvider");
  return ctx;
}
