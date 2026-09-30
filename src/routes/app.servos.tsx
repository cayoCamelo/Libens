import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { rotulosPerfil } from "@/data/mock";
import { useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/servos")({
  head: () => ({
    meta: [
      { title: "Servos — Libens" },
      { name: "description", content: "Servos e os ministérios em que participam." },
      { property: "og:title", content: "Servos — Libens" },
      { property: "og:description", content: "Servos e os ministérios em que participam." },
    ],
  }),
  component: ServosPage,
});

function ServosPage() {
  const d = useDados();
  const nomeMin = (id: string) => d.ministerios.find((m) => m.id === id)?.name ?? "";
  return (
    <AppShell titulo="Servos" descricao={`${d.pessoas.length} pessoas`}>
      <div className="space-y-3">
        {d.pessoas.map((p) => {
          const mins = d.membros.filter((m) => m.user_id === p.id).map((m) => m.ministry_id);
          const lid = d.lideres.filter((m) => m.user_id === p.id).map((m) => m.ministry_id);
          return (
            <Card key={p.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-medium text-foreground">{p.full_name || p.email}</p>
                  <div className="flex gap-1.5">
                    {!p.active ? <Badge variant="secondary">Inativo</Badge> : null}
                    <Badge variant="outline">{rotulosPerfil[p.role]}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mins.map((id) => (
                    <Badge key={id} variant="secondary">
                      {nomeMin(id)}
                      {lid.includes(id) ? " · líder" : ""}
                    </Badge>
                  ))}
                  {mins.length === 0 ? <span className="text-xs text-muted-foreground">Sem ministério</span> : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
