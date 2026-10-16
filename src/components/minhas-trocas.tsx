import { useQuery } from "@tanstack/react-query";
import { Check, Repeat, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  dataBr, eventoAberto, hora, listarTrocas, rotuloEventoStatus, rotuloResposta, rotuloTroca, traduzirErroDb,
  type EscalaDb,
} from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";

/** Confirmação de presença, pedidos de troca e aprovações — regras validadas no banco. */
export function MinhasTrocas() {
  const { usuario } = useSessao();
  const d = useDados();
  const trocas = useQuery({ queryKey: ["libens", "trocas", usuario.id], queryFn: listarTrocas, enabled: !!usuario.id });
  const [pedido, setPedido] = useState<EscalaDb | null>(null);
  const [motivo, setMotivo] = useState("");
  const candidatos = useQuery({
    queryKey: ["libens", "candidatos", pedido?.id],
    enabled: !!pedido,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("substitute_candidates", { _sid: pedido!.id });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const [ocupado, setOcupado] = useState(false);

  const rodar = async (fn: () => PromiseLike<{ error: { message: string; code?: string } | null }>, ok: string) => {
    setOcupado(true);
    const { error } = await fn();
    setOcupado(false);
    if (error) return toast.error(traduzirErroDb(error));
    toast.success(ok);
    await d.recarregar();
  };

  const evento = (id: string) => d.eventos.find((e) => e.id === id);
  const minis = (id: string) => d.ministerios.find((m) => m.id === id)?.name ?? "";
  const lista = trocas.data ?? [];
  const abertas = new Set(lista.filter((t) => t.status.startsWith("pending")).map((t) => t.schedule_id));
  const minhas = d.escalas
    .filter((s) => s.user_id === usuario.id && ["scheduled", "confirmed"].includes(s.status) && eventoAberto(evento(s.event_id)))
    .sort((a, b) => (evento(a.event_id)?.date ?? "").localeCompare(evento(b.event_id)?.date ?? ""));
  const paraMim = lista.filter((t) => t.substitute_id === usuario.id && t.status === "pending_substitute");
  const aprovar = lista.filter((t) => t.status === "pending_leader" && d.podeGerenciar(t.ministry_id));
  const historico = lista.slice(0, 10);
  const titulo = (t: { event_id: string; ministry_id: string }) => {
    const e = evento(t.event_id);
    return `${e?.name ?? "Evento"} · ${e ? dataBr(e.date) : ""} · ${minis(t.ministry_id)}`;
  };

  if (!minhas.length && !lista.length) return null;

  return (
    <Card className="mb-4">
      <CardContent className="space-y-4 p-4">
        {minhas.length ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Minhas próximas escalas</p>
            {minhas.map((s) => {
              const e = evento(s.event_id);
              return (
                <div key={s.id} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{e?.name} · {minis(s.ministry_id)}</p>
                      <p className="text-xs text-muted-foreground">{e ? `${dataBr(e.date)} às ${hora(e.start_time)}` : ""}</p>
                    </div>
                    <Badge variant={s.response === "confirmed" ? "default" : s.response === "declined" ? "destructive" : "outline"}>
                      {rotuloResposta[s.response]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={ocupado || s.response === "confirmed"} onClick={() => void rodar(() => supabase.rpc("respond_schedule", { _sid: s.id, _response: "confirmed" }), "Presença confirmada.")}>
                      <Check className="h-3.5 w-3.5" /> Confirmar
                    </Button>
                    <Button size="sm" variant="outline" disabled={ocupado || s.response === "declined"} onClick={() => void rodar(() => supabase.rpc("respond_schedule", { _sid: s.id, _response: "declined" }), "Seu líder foi avisado.")}>
                      <X className="h-3.5 w-3.5" /> Não poderei ir
                    </Button>
                    <Button size="sm" variant="ghost" disabled={ocupado || abertas.has(s.id)} onClick={() => { setMotivo(""); setPedido(s); }}>
                      <Repeat className="h-3.5 w-3.5" /> {abertas.has(s.id) ? "Troca em andamento" : "Pedir troca"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {paraMim.length ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Pedidos para você substituir</p>
            {paraMim.map((t) => (
              <div key={t.id} className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm text-foreground">{d.nomePessoa(t.requester_id)} pediu sua ajuda: {titulo(t)}</p>
                {t.reason ? <p className="text-xs text-muted-foreground">Motivo: {t.reason}</p> : null}
                <div className="flex gap-2">
                  <Button size="sm" disabled={ocupado} onClick={() => void rodar(() => supabase.rpc("respond_substitution", { _rid: t.id, _accept: true }), "Aceito. Aguardando o líder.")}>Aceitar</Button>
                  <Button size="sm" variant="outline" disabled={ocupado} onClick={() => void rodar(() => supabase.rpc("respond_substitution", { _rid: t.id, _accept: false }), "Pedido recusado.")}>Recusar</Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {aprovar.length ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Trocas para aprovar</p>
            {aprovar.map((t) => (
              <div key={t.id} className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm text-foreground">{d.nomePessoa(t.requester_id)} → {d.nomePessoa(t.substitute_id)}</p>
                <p className="text-xs text-muted-foreground">{titulo(t)}</p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={ocupado} onClick={() => void rodar(() => supabase.rpc("decide_substitution", { _rid: t.id, _approve: true }), "Troca aprovada e escala atualizada.")}>Aprovar</Button>
                  <Button size="sm" variant="outline" disabled={ocupado} onClick={() => void rodar(() => supabase.rpc("decide_substitution", { _rid: t.id, _approve: false }), "Troca rejeitada.")}>Rejeitar</Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {historico.length ? (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-foreground">Histórico de trocas</summary>
            <ul className="mt-2 space-y-1.5">
              {historico.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{dataBr(t.created_at)} · {d.nomePessoa(t.requester_id)} → {d.nomePessoa(t.substitute_id)} · {titulo(t)}</span>
                  <span className="flex items-center gap-1.5">
                    <Badge variant="outline">{rotuloTroca[t.status]}</Badge>
                    {t.requester_id === usuario.id && t.status.startsWith("pending") ? (
                      <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => void rodar(() => supabase.rpc("cancel_substitution", { _rid: t.id }), "Pedido cancelado.")}>Cancelar</Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>

      <Dialog open={!!pedido} onOpenChange={(o) => !o && setPedido(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pedir substituição</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sugestões do mesmo ministério, disponíveis e sem conflito de horário.
            {pedido && evento(pedido.event_id) ? ` Evento: ${rotuloEventoStatus[evento(pedido.event_id)!.status]}.` : ""}
          </p>
          <Input placeholder="Motivo (opcional)" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {candidatos.isLoading ? <p className="text-sm text-muted-foreground">Buscando...</p> : null}
            {candidatos.data?.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum substituto disponível.</p> : null}
            {candidatos.data?.map((c) => (
              <Button key={c.user_id} variant="outline" className="w-full justify-start" disabled={ocupado}
                onClick={() => void rodar(() => supabase.rpc("request_substitution", { _sid: pedido!.id, _substitute: c.user_id, _reason: motivo }), "Pedido enviado ao substituto.").then(() => setPedido(null))}>
                {c.full_name || "Sem nome"}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
