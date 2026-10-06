import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { EditorEscala } from "@/components/editor-escala";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hora, rotuloStatus } from "@/lib/dados";
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

const diaSemana = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a!, m! - 1, d!);
  return `${dt.toLocaleDateString("pt-BR", { weekday: "long" }).toUpperCase()} — ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};

function EscalasPage() {
  const { usuario } = useSessao();
  const d = useDados();
  const busca = Route.useSearch();
  const [editor, setEditor] = useState<{ eventId: string; ministryId: string } | null | undefined>(
    busca.evento && busca.ministerio ? { eventId: busca.evento, ministryId: busca.ministerio } : undefined,
  );
  const podeCriar = d.global || d.lidero.size > 0;
  const hoje = hojeIso();
  const proximos = d.eventos.filter((e) => e.date >= hoje);

  return (
    <AppShell titulo="Escalas" descricao={podeCriar ? "Próximos eventos e suas escalas" : "Suas escalas e equipes"}>
      {podeCriar ? (
        <Button className="mb-4 w-full sm:w-auto" onClick={() => setEditor(null)}>
          <Plus className="h-4 w-4" /> Criar escala
        </Button>
      ) : null}
      <div className="space-y-3">
        {proximos.map((e) => {
          const grupos = d.ministerios
            .map((m) => ({ m, itens: d.escalas.filter((s) => s.event_id === e.id && s.ministry_id === m.id) }))
            .filter((g) => g.itens.length > 0);
          if (!podeCriar && grupos.length === 0) return null;
          const primeiroMin = d.ministerios.find((m) => d.podeGerenciar(m.id) && !grupos.some((g) => g.m.id === m.id));
          return (
            <Card key={e.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground">{diaSemana(e.date)}</p>
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
                {grupos.map(({ m, itens }) => {
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
          <p className="text-sm text-muted-foreground">Nenhum evento futuro. Os eventos são cadastrados na aba Eventos.</p>
        ) : null}
      </div>
      {podeCriar ? (
        <EditorEscala aberto={editor !== undefined} inicial={editor ?? undefined} onFechar={() => setEditor(undefined)} />
      ) : null}
    </AppShell>
  );
}
