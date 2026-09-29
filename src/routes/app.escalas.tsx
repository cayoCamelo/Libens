import { createFileRoute } from "@tanstack/react-router";

import { EscalaCard } from "@/components/escala-card";
import { AppShell } from "@/components/layout/app-shell";
import { escalas, eventoPorId } from "@/data/mock";

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
  const ordenadas = [...escalas].sort((a, b) =>
    (eventoPorId(a.eventoId)?.data ?? "").localeCompare(eventoPorId(b.eventoId)?.data ?? ""),
  );
  return (
    <AppShell titulo="Escalas" descricao="Outubro de 2026">
      <div className="space-y-3">
        {ordenadas.map((e) => (
          <EscalaCard key={e.id} escala={e} />
        ))}
      </div>
    </AppShell>
  );
}
