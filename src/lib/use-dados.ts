import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  listarEscalas,
  listarEventos,
  listarLideres,
  listarMembros,
  listarMinisterios,
  listarNecessidades,
  listarPessoas,
} from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";

/** Carrega os dados básicos do Libens e expõe permissões derivadas. */
export function useDados() {
  const { usuario, perfil, autenticado } = useSessao();
  const enabled = autenticado && !!usuario.id;
  const k = (n: string) => ["libens", n, usuario.id];
  const ministerios = useQuery({ queryKey: k("ministerios"), queryFn: listarMinisterios, enabled });
  const pessoas = useQuery({ queryKey: k("pessoas"), queryFn: listarPessoas, enabled });
  const membros = useQuery({ queryKey: k("membros"), queryFn: listarMembros, enabled });
  const lideres = useQuery({ queryKey: k("lideres"), queryFn: listarLideres, enabled });
  const eventos = useQuery({ queryKey: k("eventos"), queryFn: listarEventos, enabled });
  const escalas = useQuery({ queryKey: k("escalas"), queryFn: listarEscalas, enabled });
  const necessidades = useQuery({ queryKey: k("necessidades"), queryFn: listarNecessidades, enabled });
  const qc = useQueryClient();

  return useMemo(() => {
    const global = perfil === "admin" || perfil === "pastor";
    const lidero = new Set(
      (lideres.data ?? []).filter((l) => l.user_id === usuario.id).map((l) => l.ministry_id),
    );
    const participo = new Set(
      (membros.data ?? []).filter((m) => m.user_id === usuario.id).map((m) => m.ministry_id),
    );
    return {
      carregando: [ministerios, pessoas, membros, lideres, eventos, escalas, necessidades].some(
        (q) => q.isLoading,
      ),
      erro: [ministerios, pessoas, membros, lideres, eventos, escalas, necessidades].find((q) => q.error)
        ?.error as Error | undefined,
      ministerios: ministerios.data ?? [],
      pessoas: pessoas.data ?? [],
      membros: membros.data ?? [],
      lideres: lideres.data ?? [],
      eventos: eventos.data ?? [],
      escalas: escalas.data ?? [],
      necessidades: necessidades.data ?? [],
      global,
      lidero,
      participo,
      podeGerenciar: (ministryId: string) => global || lidero.has(ministryId),
      recarregar: () => qc.invalidateQueries({ queryKey: ["libens"] }),
    };
  }, [perfil, usuario.id, ministerios, pessoas, membros, lideres, eventos, escalas, necessidades, qc]);
}

export function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
