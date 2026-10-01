import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { EditorEscala } from "@/components/editor-escala";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatarData } from "@/data/mock";
import { hora, rotuloStatus } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/escalas")({
  head: () => ({
    meta: [
      { title: "Escalas — Libens" },
      { name: "description", content: "Escalas por data, evento e ministério." },
      { property: "og:title", content: "Escalas — Libens" },
      { property: "og:description", content: "Escalas por data, evento e ministério." },
    ],
  }),
  component: EscalasPage,
});

function EscalasPage() {
  const { usuario } = useSessao();
  const d = useDados();
  const [editor, setEditor] = useState<{ eventId: string; ministryId: string } | null | undefined>(undefined);
  const podeCriar = d.global || d.lidero.size > 0;
  const nome = (id: string) => { const p = d.pessoas.find((x) => x.id === id); return p ? p.full_name || p.email : "Servo"; };

  // Agrupa por evento + ministério
  const grupos = d.eventos.flatMap((e) =>
    d.ministerios
      .map((m) => ({ e, m, itens: d.escalas.filter((s) => s.event_id === e.id && s.ministry_id === m.id) }))
      .filter((g) => g.itens.length > 0),
  );

  return (
    <AppShell titulo="Escalas" descricao={podeCriar ? "Crie, gere e publique escalas" : "Suas escalas e equipes"}>
      {podeCriar ? (
        <Button className="mb-4 w-full sm:w-auto" onClick={() => setEditor(null)}>
          <Plus className="h-4 w-4" /> Criar escala
        </Button>
      ) : null}
      <div className="space-y-3">
        {grupos.map(({ e, m, itens }) => {
          const rascunho = itens.some((s) => s.status === "draft");
          const meu = itens.find((s) => s.user_id === usuario.id);
          return (
            <Card key={`${e.id}-${m.id}`}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {formatarData(e.date)} · {hora(e.start_time)}
                    </p>
                    <p className="font-semibold text-foreground">{e.name}</p>
                    <p className="text-sm text-muted-foreground">{m.name}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {rascunho ? <Badge variant="outline">Rascunho</Badge> : <Badge variant="secondary">Publicada</Badge>}
                    {meu ? <Badge>Você: {rotuloStatus[meu.status]}</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {itens.map((s) => <Badge key={s.id} variant="secondary">{nome(s.user_id)}</Badge>)}
                </div>
                {d.podeGerenciar(m.id) ? (
                  <Button size="sm" variant="outline" onClick={() => setEditor({ eventId: e.id, ministryId: m.id })}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {!d.carregando && grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma escala por enquanto.</p>
        ) : null}
      </div>
      {podeCriar ? (
        <EditorEscala aberto={editor !== undefined} inicial={editor ?? undefined} onFechar={() => setEditor(undefined)} />
      ) : null}
    </AppShell>
  );
}
