import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Gera um link temporário para a foto guardada no armazenamento privado. */
export function useAvatarUrl(caminho: string | null | undefined) {
  const q = useQuery({
    queryKey: ["libens", "avatar", caminho],
    enabled: !!caminho,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("avatars").createSignedUrl(caminho!, 3600);
      return data?.signedUrl ?? null;
    },
  });
  return caminho ? (q.data ?? null) : null;
}

export function useMeuPerfilExtra(userId: string) {
  return useQuery({
    queryKey: ["libens", "perfil-extra", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [p, w] = await Promise.all([
        supabase.from("profiles").select("avatar_url, bio, reminders_enabled").eq("id", userId).maybeSingle(),
        supabase.rpc("profile_whatsapp", { _uid: userId }),
      ]);
      return {
        avatar_url: p.data?.avatar_url ?? null,
        bio: p.data?.bio ?? "",
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
