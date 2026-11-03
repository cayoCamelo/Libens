import { createFileRoute } from "@tanstack/react-router";

import { GestaoDashboard } from "@/components/gestao-dashboard";
import { AppShell } from "@/components/layout/app-shell";
import { useSessao } from "@/lib/perfil-context";

export const Route = createFileRoute("/app/painel")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Painel administrativo — Libens" },
      { name: "description", content: "Usuários e escalas do Libens em um só lugar." },
      { property: "og:title", content: "Painel administrativo — Libens" },
      { property: "og:description", content: "Usuários e escalas do Libens em um só lugar." },
    ],
  }),
  component: PainelPage,
});

function PainelPage() {
 const { perfil } = useSessao();
 if (perfil !== 'admin') return <AppShell titulo="Painel administrativo"><p className="text-sm text-muted-foreground">Somente o administrador acessa esta área.</p></AppShell>;
 return <GestaoDashboard tipo="admin" />;
}
