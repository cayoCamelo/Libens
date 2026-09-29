import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { ministerios, servosDoMinisterio } from "@/data/mock";

export const Route = createFileRoute("/app/servos")({
  head: () => ({
    meta: [
      { title: "Servos — Libens" },
      { name: "description", content: "Servos organizados por ministério." },
      { property: "og:title", content: "Servos — Libens" },
      { property: "og:description", content: "Servos organizados por ministério." },
    ],
  }),
  component: ServosPage,
});

function ServosPage() {
  return (
    <AppShell titulo="Servos" descricao="Por ministério">
      <div className="space-y-3">
        {ministerios.map((m) => {
          const lista = servosDoMinisterio(m.id);
          return (
            <Card key={m.id}>
              <CardContent className="p-4">
                <h2 className="text-base font-semibold text-foreground">{m.nome}</h2>
                {lista.length ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {lista.map((s) => (
                      <li key={s.id} className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                        {s.nome}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Nenhum servo ainda.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
