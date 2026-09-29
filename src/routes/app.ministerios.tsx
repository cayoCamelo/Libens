import { createFileRoute } from "@tanstack/react-router";
import { Church } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { ministerios, servosDoMinisterio } from "@/data/mock";

export const Route = createFileRoute("/app/ministerios")({
  head: () => ({
    meta: [
      { title: "Ministérios — Libens" },
      { name: "description", content: "Ministérios da igreja no Libens." },
      { property: "og:title", content: "Ministérios — Libens" },
      { property: "og:description", content: "Ministérios da igreja no Libens." },
    ],
  }),
  component: MinisteriosPage,
});

function MinisteriosPage() {
  return (
    <AppShell titulo="Ministérios" descricao={`${ministerios.length} ministérios`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {ministerios.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
                <Church className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{m.nome}</p>
                <p className="text-sm text-muted-foreground">{servosDoMinisterio(m.id).length} servos</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
