import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dataBr, hora } from "@/lib/dados";
import { hojeIso, useDados } from "@/lib/use-dados";

export function PainelPastoral() {
  const d = useDados();
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
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button asChild variant="outline">
          <Link to="/app/disponibilidade">Consultar disponibilidade de cada membro</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/ministerios">Gerenciar ministérios e líderes</Link>
        </Button>
      </div>
    </AppShell>
  );
}
