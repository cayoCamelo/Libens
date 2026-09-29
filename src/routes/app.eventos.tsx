import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { eventos, formatarData } from "@/data/mock";

export const Route = createFileRoute("/app/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos — Libens" },
      { name: "description", content: "Cultos e eventos programados." },
      { property: "og:title", content: "Eventos — Libens" },
      { property: "og:description", content: "Cultos e eventos programados." },
    ],
  }),
  component: EventosPage,
});

function EventosPage() {
  return (
    <AppShell titulo="Eventos" descricao="Programação do mês">
      <div className="space-y-3">
        {eventos.map((e) => (
          <Card key={e.id}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {formatarData(e.data)} · {e.hora}
              </p>
              <p className="font-semibold text-foreground">{e.nome}</p>
              {e.local ? <p className="text-sm text-muted-foreground">{e.local}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
