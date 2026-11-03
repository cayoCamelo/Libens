import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { Acessos } from "@/components/acessos";
export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [{ title: "Acessos — Libens" }] }),
  component: () => (
    <AppShell titulo="Acessos" descricao="Pessoas, funções e lideranças">
      <Acessos />
    </AppShell>
  ),
});
