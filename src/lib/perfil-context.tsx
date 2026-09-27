import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { usuarioPorPerfil } from "@/data/mock";
import type { Perfil, Servo } from "@/types/libens";

/**
 * Sessão de demonstração. Ainda não há autenticação real: o perfil ativo é
 * apenas local e será substituído pela sessão do usuário mais adiante.
 */
interface SessaoContextValue {
  perfil: Perfil;
  usuario: Servo;
  definirPerfil: (perfil: Perfil) => void;
}

const SessaoContext = createContext<SessaoContextValue | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil>("servo");

  const value = useMemo<SessaoContextValue>(
    () => ({
      perfil,
      usuario: usuarioPorPerfil[perfil],
      definirPerfil: setPerfil,
    }),
    [perfil],
  );

  return <SessaoContext.Provider value={value}>{children}</SessaoContext.Provider>;
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error("useSessao deve ser usado dentro de SessaoProvider");
  return ctx;
}
