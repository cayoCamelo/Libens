import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Avatar textual sem upload ou dependência de armazenamento. */
export function iniciaisNome(nome: string) {
  return (
    nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte.charAt(0))
      .join("")
      .toLocaleUpperCase("pt-BR") || "?"
  );
}

export function useMeuPerfilExtra(userId: string) {
  return useQuery({
    queryKey: ["libens", "perfil-extra", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [p, w] = await Promise.all([
        supabase.from("profiles").select("reminders_enabled").eq("id", userId).maybeSingle(),
        supabase.rpc("profile_whatsapp", { _uid: userId }),
      ]);
      if (p.error || w.error)
        throw new Error(
          p.error?.message ?? w.error?.message ?? "Não foi possível carregar seu perfil.",
        );
      return {
        reminders_enabled: p.data?.reminders_enabled ?? true,
        whatsapp: (w.data as string | null) ?? "",
      };
    },
  });
}

export function formatarWhatsapp(digitos: string) {
  const d = digitos.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}
