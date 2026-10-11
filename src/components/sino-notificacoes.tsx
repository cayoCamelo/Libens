import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  const [erro, setErro] = useState<string | null>(null);
  const qc = useQueryClient();
  const lista = q.data ?? [];
  const naoLidas = lista.filter((n) => !n.read_at).length;

  const marcar = async (id: string) => {
    setErro(null);
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (error) return setErro("Não foi possível marcar o aviso como lido.");
    await qc.invalidateQueries({ queryKey: ["libens", "notificacoes"] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="ghost" size="icon"
        aria-label={`Notificações${naoLidas ? `, ${naoLidas} não lidas` : ""}`}
        className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-4.5 w-4.5" />
        {naoLidas ? (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {naoLidas}
          </span>
        ) : null}
      </Button></PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <p className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Notificações</p>
        <div className="max-h-96 overflow-y-auto">
          {q.error || erro ? <p className="p-4 text-sm text-destructive">{erro ?? "Não foi possível carregar os avisos."}</p>:null}
          {!q.error && !q.isPending && lista.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhum aviso por enquanto.</p> : null}
          {lista.map((n) => (
            <Button variant="ghost"
              key={n.id}
              type="button"
              onClick={() => !n.read_at && void marcar(n.id)}
              className={cn("block h-auto w-full whitespace-normal rounded-none border-b border-border px-4 py-3 text-left last:border-0", !n.read_at && "bg-accent/40")}
            >
              <p className="text-sm font-medium text-foreground">{n.title}</p>
              {n.body ? <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p> : null}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
