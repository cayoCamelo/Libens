import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditorEvento } from "@/components/editor-evento";
import { formatarData } from "@/data/mock";
import { supabase } from "@/integrations/supabase/client";
import { hora, listarModelos, rotuloEventoStatus, traduzirErroDb, type EventoDb } from "@/lib/dados";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const diasSemana = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/eventos")({
  validateSearch: (s) => z.object({ novo: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Eventos — Libens" },
      { name: "description", content: "Cultos e eventos programados." },
      { property: "og:title", content: "Eventos — Libens" },
      { property: "og:description", content: "Cultos e eventos programados." },
    ],
  }),
  component: EventosPage,
});

function EventosPage() {
  const d = useDados();
  const { usuario } = useSessao();
  const podeCriar = d.global || d.lidero.size > 0;
  const podeEditar = (e: EventoDb) => d.global || (d.lidero.size > 0 && e.created_by === usuario.id);
  const [excluindo, setExcluindo] = useState<EventoDb | null>(null);
  const excluir = async () => {
    if (!excluindo || !podeEditar(excluindo)) return;
    setSalvando(true);
    const { error } = await supabase.from("events").delete().eq("id", excluindo.id).select("id").single();
    setSalvando(false);
    if (error) return setAviso(error.code === "23503" ? "Este evento possui escalas ou registros vinculados. Remova os vínculos antes de excluir." : traduzirErroDb(error));
    setExcluindo(null); await d.recarregar();
  };
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const cancelar = async (e: EventoDb, c: boolean) => {
    const { error } = await supabase.rpc("set_event_cancelled", { _eid: e.id, _cancelled: c });
    setAviso(error ? traduzirErroDb(error) : c ? "Evento cancelado." : "Evento reativado.");
    await d.recarregar();
  };
  const [editor, setEditor] = useState<EventoDb | null | undefined>(undefined);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const modelos = useQuery({ queryKey: ["libens", "modelos"], queryFn: listarModelos });

  const gerarProximos = async () => {
    setAviso(null);
    const { data, error } = await supabase.rpc("generate_template_events", { _months: 3 });
    setAviso(error ? error.message : data ? `${data} evento(s) criado(s) para os próximos 3 meses.` : "Os próximos eventos já estavam criados.");
    await d.recarregar();
  };

  const abrir = (e?: EventoDb) => setEditor(e ?? null);
  const busca = Route.useSearch();
  const navegar = useNavigate({ from: "/app/eventos" });
  useEffect(() => {
    if (busca.novo && podeCriar && !d.carregando) {
      abrir();
      void navegar({ search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca.novo, podeCriar, d.carregando]);


  return (
    <AppShell titulo="Eventos" descricao="Programação">
      <Card className="mb-4">
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-semibold text-foreground">Eventos padrão</p>
          {(modelos.data ?? []).map((t) => (
            <p key={t.id} className="text-sm text-muted-foreground">
              {t.name} · toda {diasSemana[t.weekday]} · {hora(t.start_time)}{t.end_time ? `–${hora(t.end_time)}` : ""}
            </p>
          ))}
          {podeCriar ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {d.global ? <Button size="sm" variant="secondary" onClick={() => void gerarProximos()}>
                <CalendarPlus className="h-4 w-4" /> Gerar próximos eventos
              </Button> : null}
              <Button size="sm" onClick={() => abrir()}>
                <Plus className="h-4 w-4" /> Novo evento
              </Button>
            </div>
          ) : null}
          {aviso ? <p className="text-xs text-muted-foreground">{aviso}</p> : null}
        </CardContent>
      </Card>
      <Select value={filtroStatus} onValueChange={setFiltroStatus}>
        <SelectTrigger className="mb-3 w-full sm:w-60" aria-label="Status"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="todos">Todos os status</SelectItem>{Object.entries(rotuloEventoStatus).map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
      <div className="space-y-3">
        {d.eventos.filter((e)=>filtroStatus==="todos"||e.status===filtroStatus).map((e) => {
          const needs = d.necessidades.filter((n) => n.event_id === e.id);
          return (
            <Card key={e.id}>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {formatarData(e.date)} · {hora(e.start_time)}{e.end_time ? `–${hora(e.end_time)}` : ""}
                </p>
                <p className="font-semibold text-foreground">{e.name} <Badge variant={e.status==="cancelled"?"destructive":"outline"} className="ml-1 align-middle">{rotuloEventoStatus[e.status]}</Badge></p>
                {podeEditar(e) ? <div className="flex flex-wrap gap-2">{e.status!=="completed"?<Button size="sm" variant="ghost" onClick={()=>void cancelar(e,e.status!=="cancelled")}>{e.status==="cancelled"?"Reativar":"Cancelar evento"}</Button>:null}<Button size="sm" variant="ghost" onClick={()=>abrir(e)}><Pencil className="h-4 w-4" /> Editar</Button><Button size="sm" variant="ghost" onClick={()=>{setAviso(null);setExcluindo(e);}}><Trash2 className="h-4 w-4" /> Excluir</Button></div>:null}
                {e.location ? <p className="text-sm text-muted-foreground">{e.location}</p> : null}
                {needs.length ? (
                  <p className="text-xs text-muted-foreground">
                    {needs.map((n) => `${d.ministerios.find((m) => m.id === n.ministry_id)?.name}: ${n.required_count}`).join(" · ")}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {!d.carregando && d.eventos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento cadastrado.</p> : null}
      </div>

      <Dialog open={!!excluindo} onOpenChange={(o)=>!o&&!salvando&&setExcluindo(null)}>
        <DialogContent><DialogHeader><DialogTitle>Excluir evento?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Excluir {excluindo?.name}? Se houver escalas vinculadas, a exclusão será bloqueada para preservar o histórico.</p>
          {aviso ? <p className="text-sm text-destructive">{aviso}</p>:null}
          <div className="flex gap-2"><Button variant="secondary" disabled={salvando} onClick={()=>setExcluindo(null)}>Cancelar</Button><Button variant="destructive" disabled={salvando} onClick={()=>void excluir()}>Confirmar exclusão</Button></div>
        </DialogContent>
      </Dialog>
      <EditorEvento aberto={editor !== undefined} evento={editor ?? undefined} onFechar={() => setEditor(undefined)} />
    </AppShell>
  );
}
