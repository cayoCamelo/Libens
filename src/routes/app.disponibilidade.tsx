import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { eventos, formatarDataCurta } from "@/data/mock";
import { cn } from "@/lib/utils";
import type { PeriodoDia } from "@/types/libens";

export const Route = createFileRoute("/app/disponibilidade")({
  head: () => ({
    meta: [
      { title: "Disponibilidade — Libens" },
      { name: "description", content: "Informe os dias e períodos em que você pode servir." },
      { property: "og:title", content: "Disponibilidade — Libens" },
      { property: "og:description", content: "Informe os dias e períodos em que você pode servir." },
    ],
  }),
  component: DisponibilidadePage,
});

const periodos: { id: PeriodoDia; rotulo: string }[] = [
  { id: "manha", rotulo: "Manhã" },
  { id: "tarde", rotulo: "Tarde" },
  { id: "noite", rotulo: "Noite" },
];

function DisponibilidadePage() {
  const datas = [...new Set(eventos.map((e) => e.data))].sort();
  const [marcados, setMarcados] = useState<Record<string, PeriodoDia[]>>({});

  const alternar = (data: string, p: PeriodoDia) =>
    setMarcados((m) => {
      const atual = m[data] ?? [];
      return { ...m, [data]: atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p] };
    });

  return (
    <AppShell titulo="Disponibilidade" descricao="Toque nos períodos em que você pode servir">
      <div className="space-y-3">
        {datas.map((data) => (
          <Card key={data}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="text-sm font-medium text-foreground">{formatarDataCurta(data)}</span>
              <div className="flex gap-1.5">
                {periodos.map((p) => {
                  const ativo = marcados[data]?.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => alternar(data, p.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        ativo
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {p.rotulo}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
        <p className="text-center text-xs text-muted-foreground">
          O salvamento da disponibilidade será ativado em uma próxima etapa.
        </p>
      </div>
    </AppShell>
  );
}
