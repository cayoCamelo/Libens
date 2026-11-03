import { useQuery } from "@tanstack/react-query";
import { Acessos } from "@/components/acessos";
import { AreaEmbutida } from "@/lib/area-embutida";
import { EscalasPage } from "@/routes/app.escalas";
import { DisponibilidadePage } from "@/routes/app.disponibilidade";
import { MinisteriosPage } from "@/routes/app.ministerios";
import { EditorEvento } from "@/components/editor-evento";
import { EditorEscala } from "@/components/editor-escala";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { listarTrocas, rotuloTroca } from "@/lib/dados";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dataBr, hora } from "@/lib/dados";
import { hojeIso, useDados } from "@/lib/use-dados";

export function PainelPastoral() {
  const d = useDados();
  const [area, setArea] = useState<string | null>(null);
  const [criarEvento, setCriarEvento] = useState(false);
  const [criarEscala, setCriarEscala] = useState(false);
  const trocas = useQuery({ queryKey: ["libens", "trocas-pastoral"], queryFn: listarTrocas });
  const areas: Record<string, string> = {
    escalas: "Todas as escalas",
    disponibilidade: "Disponibilidades",
    ministerios: "Ministérios",
    acessos: "Acessos",
  };
  const [data, setData] = useState(hojeIso());
  const [periodo, setPeriodo] = useState("mes");
  const [min, setMin] = useState("todos");
  const inicio = new Date(`${data}T12:00:00-03:00`);
  const fim = new Date(inicio);
  if (periodo === "semana") {
    const dia = inicio.getUTCDay();
    inicio.setUTCDate(inicio.getUTCDate() - ((dia + 6) % 7));
    fim.setTime(inicio.getTime());
    fim.setUTCDate(fim.getUTCDate() + 6);
  }
  if (periodo === "mes") {
    inicio.setUTCDate(1);
    fim.setUTCMonth(fim.getUTCMonth() + 1, 0);
  }
  const de = inicio.toISOString().slice(0, 10),
    ate = fim.toISOString().slice(0, 10);
  const eventos = d.eventos.filter((e) => e.date === data && e.status !== "cancelled");
  const historico = d.escalas.filter(
    (s) =>
      s.status === "completed" &&
      s.response !== "declined" &&
      (min === "todos" || s.ministry_id === min) &&
      d.eventos.some(
        (e) => e.id === s.event_id && e.status !== "cancelled" && e.date >= de && e.date <= ate,
      ),
  );
  const contagem = [...new Set(historico.map((s) => s.user_id))]
    .map((id) => ({ id, total: historico.filter((s) => s.user_id === id).length }))
    .sort((a, b) => b.total - a.total);
  return (
    <AppShell titulo="Painel pastoral" descricao="Serviço, histórico e disponibilidade">
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Ações pastorais">
        <Button
          variant="outline"
          className="h-auto min-h-20 whitespace-normal"
          onClick={() => setCriarEvento(true)}
        >
          Criar evento
        </Button>
        <Button
          variant="outline"
          className="h-auto min-h-20 whitespace-normal"
          onClick={() => setCriarEscala(true)}
        >
          Criar escala
        </Button>
        {Object.entries(areas).map(([v, l]) => (
          <Button
            key={v}
            variant="outline"
            className="h-auto min-h-20 whitespace-normal"
            onClick={() => setArea(v)}
          >
            {l}
          </Button>
        ))}
      </section>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pastor-data">Data de referência</Label>
          <Input
            id="pastor-data"
            type="date"
            value={data}
            onChange={(e) => {
              if (e.target.value) setData(e.target.value);
            }}
          />
        </div>
        <div>
          <Label htmlFor="pastor-min">Ministério</Label>
          <select
            id="pastor-min"
            className="min-h-10 w-full rounded-md border border-border bg-background p-2"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          >
            <option value="todos">Todos os ministérios</option>
            {d.ministerios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {d.erro ? (
        <p role="alert" className="text-destructive">
          {d.erro.message}
        </p>
      ) : null}
      {d.carregando ? <p role="status">Carregando painel...</p> : null}
      <section className="space-y-3">
        <h2 className="font-semibold">Quem está escalado · {dataBr(data)}</h2>
        {eventos.map((e) => (
          <div key={e.id} className="rounded-xl border border-border p-4">
            <p className="font-medium">
              {e.name} · {hora(e.start_time)}
            </p>
            {d.ministerios
              .filter((m) => min === "todos" || m.id === min)
              .map((m) => {
                const s = d.escalas.filter(
                  (s) => s.event_id === e.id && s.ministry_id === m.id && s.status !== "draft",
                );
                return s.length ? (
                  <p key={m.id} className="mt-2 text-sm">
                    <strong>{m.name}:</strong> {s.map((s) => d.nomePessoa(s.user_id)).join(" · ")}
                  </p>
                ) : null;
              })}
          </div>
        ))}
        {!d.carregando && !eventos.length ? (
          <p className="text-sm text-muted-foreground">Nenhum evento nesta data.</p>
        ) : null}
      </section>
      <section className="mt-6 space-y-3">
        <h2 className="font-semibold">Histórico de participações</h2>
        <div className="flex gap-2">
          {[
            ["dia", "Dia"],
            ["semana", "Semana"],
            ["mes", "Mês"],
          ].map(([v, l]) => (
            <Button
              key={v}
              variant={periodo === v ? "default" : "outline"}
              onClick={() => setPeriodo(v!)}
            >
              {l}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {dataBr(de)} a {dataBr(ate)} · Escalas concluídas, excluindo canceladas e recusadas. A
          contagem não comprova presença efetiva.
        </p>
        <div className="divide-y divide-border">
          {contagem.map((p) => (
            <p key={p.id} className="flex justify-between gap-3 py-3 text-sm">
              <span>{d.nomePessoa(p.id)}</span>
              <strong>{p.total} vez(es)</strong>
            </p>
          ))}
        </div>
        {!d.carregando && !contagem.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma participação concluída neste período.
          </p>
        ) : null}
      </section>
      <section className="mt-7 space-y-3">
        <h2 className="text-lg font-semibold">Atividades recentes</h2>
        {trocas.isPending ? (
          <p role="status" className="text-sm">
            Consultando substituições...
          </p>
        ) : null}
        {trocas.error ? (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível consultar as substituições.
          </p>
        ) : null}
        <ul className="divide-y divide-border">
          {[...d.escalas]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 3)
            .map((s) => (
              <li key={s.id} className="py-3 text-sm">
                {s.status === "draft" ? "Rascunho de escala" : "Registro de escala"} ·{" "}
                {d.nomePessoa(s.user_id)}
                <span className="block text-xs text-muted-foreground">
                  {dataBr(s.created_at)} · {d.ministerios.find((m) => m.id === s.ministry_id)?.name}
                </span>
              </li>
            ))}
          {trocas.data?.slice(0, 3).map((t) => (
            <li key={t.id} className="py-3 text-sm">
              Substituição · {rotuloTroca[t.status]}
              <span className="block text-xs text-muted-foreground">
                {d.nomePessoa(t.requester_id)} → {d.nomePessoa(t.substitute_id)} ·{" "}
                {dataBr(t.created_at)}
              </span>
            </li>
          ))}
        </ul>
        {!d.carregando && !d.escalas.length && !trocas.isPending && !trocas.data?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
        ) : null}
      </section>
      <Dialog open={!!area} onOpenChange={(v) => !v && setArea(null)}>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{area ? areas[area] : "Monitoramento"}</DialogTitle>
            <DialogDescription>Consulte e gerencie sem sair do Painel pastoral.</DialogDescription>
          </DialogHeader>
          <AreaEmbutida>
            {area === "escalas" ? (
              <EscalasPage />
            ) : area === "disponibilidade" ? (
              <DisponibilidadePage />
            ) : area === "ministerios" ? (
              <MinisteriosPage />
            ) : area === "acessos" ? (
              <Acessos />
            ) : null}
          </AreaEmbutida>
        </DialogContent>
      </Dialog>
      <EditorEvento aberto={criarEvento} onFechar={() => setCriarEvento(false)} />
      <EditorEscala aberto={criarEscala} onFechar={() => setCriarEscala(false)} />
    </AppShell>
  );
}
