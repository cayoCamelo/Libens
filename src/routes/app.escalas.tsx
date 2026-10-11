import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { EditorEscala } from "@/components/editor-escala";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dataBr, hora, rotuloStatus } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { hojeIso, useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/escalas")({
  validateSearch: (s) => z.object({ evento: z.string().optional(), ministerio: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Escalas — Libens" },
      { name: "description", content: "Escalas dos ministérios para cada evento." },
      { property: "og:title", content: "Escalas — Libens" },
      { property: "og:description", content: "Escalas dos ministérios para cada evento." },
    ],
  }),
  component: EscalasPage,
});

function EscalasPage() {
  const { usuario } = useSessao();
  const d = useDados();
  const busca = Route.useSearch();
  const [editor, setEditor] = useState<{ eventId: string; ministryId: string } | null | undefined>(
    busca.evento && busca.ministerio ? { eventId: busca.evento, ministryId: busca.ministerio } : undefined,
  );
  const podeCriar = d.global || d.lidero.size > 0;
  const hoje = hojeIso();
  const [periodo, setPeriodo] = useState("mes");
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [texto, setTexto] = useState("");
  const [ev, setEv] = useState("todos");
  const [min, setMin] = useState("todos");
  const [pessoa, setPessoa] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [visao, setVisao] = useState("todas");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const data = new Date(`${hoje}T12:00:00`);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
  const inicioSemana = new Date(data); inicioSemana.setDate(data.getDate()-((data.getDay()+6)%7));
  const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate()+6);
  const proximoMes = new Date(data.getFullYear(), data.getMonth()+1,1);
  const fimProximo = new Date(data.getFullYear(), data.getMonth()+2,0);
  const intervalo = periodo === "hoje" ? [hoje,hoje] : periodo === "semana" ? [iso(inicioSemana),iso(fimSemana)] : periodo === "proximo" ? [iso(proximoMes),iso(fimProximo)] : periodo === "custom" ? [de,ate] : [iso(new Date(data.getFullYear(),data.getMonth(),1)),iso(new Date(data.getFullYear(),data.getMonth()+1,0))];
  const mins = d.ministerios.filter((m) => d.global || (d.lidero.size ? d.lidero.has(m.id) : d.participo.has(m.id)));
  const itensFiltrados = d.escalas.filter((s) => mins.some((m)=>m.id===s.ministry_id) && (min==="todos" || min===s.ministry_id) && (pessoa==="todos" || pessoa===s.user_id) && (status==="todos" || status===s.status) && (visao!=="minhas" || s.user_id===usuario.id));
  const proximos = d.eventos.filter((e) => {
    if (e.date < (intervalo[0] ?? hoje) || e.date > (intervalo[1] ?? hoje) || (ev!=="todos" && ev!==e.id)) return false;
    const rows = itensFiltrados.filter((s)=>s.event_id===e.id);
    if ((min!=="todos" || pessoa!=="todos" || status!=="todos" || visao==="minhas" || !podeCriar) && !rows.length) return false;
    const q=texto.toLocaleLowerCase();
    return !q || e.name.toLocaleLowerCase().includes(q) || rows.some((s)=>(d.nomePessoa(s.user_id)+" "+d.ministerios.find((m)=>m.id===s.ministry_id)?.name).toLocaleLowerCase().includes(q));
  });
  const filtro = (label: string, valor: string, mudar: (v:string)=>void, opcoes: [string,string][]) => (
    <Select value={valor} onValueChange={mudar}><SelectTrigger className="w-full min-w-0" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{opcoes.map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
  );

  return (
    <AppShell titulo="Escalas" descricao={podeCriar ? "Próximos eventos e suas escalas" : "Suas escalas e equipes"}>
      {podeCriar ? (
        <Button className="mb-4 w-full sm:w-auto" onClick={() => setEditor(null)}>
          <Plus className="h-4 w-4" /> Criar escala
        </Button>
      ) : null}
      <div className="mb-4 space-y-2">
        <Input aria-label="Pesquisar escalas" placeholder="Pesquisar evento, ministério ou pessoa..." value={texto} onChange={(e)=>setTexto(e.target.value)} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {filtro("Período",periodo,setPeriodo,[["hoje","Hoje"],["semana","Esta semana"],["mes","Este mês"],["proximo","Próximo mês"],["custom","Personalizado"]])}
          {filtro("Evento",ev,setEv,[["todos","Todos os eventos"],...d.eventos.map((e):[string,string]=>[e.id,`${e.name} • ${dataBr(e.date)}`])])}
          {filtro("Ministério",min,setMin,[["todos","Todos os ministérios"],...mins.map((m):[string,string]=>[m.id,m.name])])}
          {filtro("Pessoa",pessoa,setPessoa,[["todos","Todas as pessoas"],...d.pessoas.map((p):[string,string]=>[p.id,p.full_name||p.email])])}
          {filtro("Status",status,setStatus,[["todos","Todos os status"],...Object.entries(rotuloStatus)])}
          {filtro("Visão",visao,setVisao,[["todas","Todas as permitidas"],["minhas","Minhas escalas"]])}
        </div>
        {periodo==="custom" ? <div className="grid grid-cols-2 gap-2"><Input type="date" aria-label="De" value={de} onChange={(e)=>setDe(e.target.value)} /><Input type="date" aria-label="Até" value={ate} onChange={(e)=>setAte(e.target.value)} /></div>:null}
      </div>
      <div className="space-y-3">
        {proximos.map((e) => {
          const grupos = d.ministerios
            .map((m) => ({ m, itens: itensFiltrados.filter((s) => s.event_id === e.id && s.ministry_id === m.id) }))
            .filter((g) => g.itens.length > 0);
          if (!podeCriar && grupos.length === 0) return null;
          const primeiroMin = d.ministerios.find((m) => d.podeGerenciar(m.id) && !grupos.some((g) => g.m.id === m.id));
          return (
            <Card key={e.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground">{dataBr(e.date)}</p>
                    <p className="font-semibold text-foreground">{e.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {hora(e.start_time)}{e.end_time ? `–${hora(e.end_time)}` : ""}
                    </p>
                  </div>
                  {podeCriar ? (
                    <Button size="sm" variant="outline" onClick={() => setEditor({ eventId: e.id, ministryId: primeiroMin?.id ?? "" })}>
                      <Plus className="h-3.5 w-3.5" /> Criar escala
                    </Button>
                  ) : null}
                </div>
                {grupos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma escala ainda.</p> : null}
                <p className="text-sm text-muted-foreground">{grupos.length} ministérios · {new Set(grupos.flatMap((g)=>g.itens.map((s)=>s.user_id))).size} pessoas</p>
                <div className="flex flex-wrap gap-1">{[...new Set(grupos.flatMap((g)=>g.itens.map((s)=>s.status)))].map((st)=><Badge key={st} variant="outline">{rotuloStatus[st]}</Badge>)}</div>
                {grupos.length ? <Button variant="secondary" size="sm" aria-expanded={abertos.has(e.id)} onClick={()=>setAbertos((a)=>{const n=new Set(a);if(n.has(e.id))n.delete(e.id);else n.add(e.id);return n;})}>{abertos.has(e.id)?"Recolher":"Ver escalas"}</Button>:null}
                {abertos.has(e.id) && grupos.map(({ m, itens }) => {
                  const rascunho = itens.some((s) => s.status === "draft");
                  const meu = itens.find((s) => s.user_id === usuario.id);
                  const criador = itens[0]?.created_by;
                  return (
                    <div key={m.id} className="space-y-2 rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{m.name}</p>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {rascunho ? <Badge variant="outline">Rascunho</Badge> : <Badge variant="secondary">Publicada</Badge>}
                          {meu ? <Badge>Você: {rotuloStatus[meu.status]}</Badge> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {itens.map((s) => <Badge key={s.id} variant="secondary">{d.nomePessoa(s.user_id)}</Badge>)}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">{criador ? `Criada por ${d.nomePessoa(criador)}` : ""}</p>
                        {d.podeGerenciar(m.id) ? (
                          <Button size="sm" variant="ghost" onClick={() => setEditor({ eventId: e.id, ministryId: m.id })}>
                            <Pencil className="h-3.5 w-3.5" /> Abrir
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
        {!d.carregando && proximos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento encontrado neste período e filtros.</p>
        ) : null}
      </div>
      {podeCriar ? (
        <EditorEscala aberto={editor !== undefined} inicial={editor ?? undefined} onFechar={() => setEditor(undefined)} />
      ) : null}
    </AppShell>
  );
}
