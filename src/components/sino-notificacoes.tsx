import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/perfil-context";
import { cn } from "@/lib/utils";

export function useNotificacoes() {
  const { usuario } = useSessao();
  return useQuery({
    queryKey: ["libens", "notificacoes", usuario.id],
    enabled: !!usuario.id,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, read_at, created_at")
        .eq("user_id", usuario.id)
        .eq("channel", "app")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function SinoNotificacoes() {
  const q = useNotificacoes();
  const qc = useQueryClient();
  const lista = q.data ?? [];
  const naoLidas = lista.filter((n) => !n.read_at).length;

  const marcar = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    await qc.invalidateQueries({ queryKey: ["libens", "notificacoes"] });
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Notificações${naoLidas ? `, ${naoLidas} não lidas` : ""}`}
        className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-4.5 w-4.5" />
        {naoLidas ? (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {naoLidas}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Notificações</p>
        <div className="max-h-96 overflow-y-auto">
          {lista.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhum aviso por enquanto.</p> : null}
          {lista.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.read_at && void marcar(n.id)}
              className={cn("block w-full border-b border-border px-4 py-3 text-left last:border-0", !n.read_at && "bg-accent/40")}
            >
              <p className="text-sm font-medium text-foreground">{n.title}</p>
              {n.body ? <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
