import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Church, FileText, KeyRound, ListChecks, Settings, Users } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/app/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Libens" },
      { name: "description", content: "Área administrativa do Libens." },
      { property: "og:title", content: "Administração — Libens" },
      { property: "og:description", content: "Área administrativa do Libens." },
    ],
  }),
  component: AdminPage,
});

const secoes = [
  { nome: "Usuários", icone: Users },
  { nome: "Ministérios", icone: Church },
  { nome: "Eventos", icone: CalendarDays },
  { nome: "Escalas", icone: ListChecks },
  { nome: "Permissões", icone: KeyRound },
  { nome: "Configurações", icone: Settings },
  { nome: "Logs", icone: FileText },
];

function AdminPage() {
  return (
    <AppShell titulo="Administração" descricao="Funções chegam nas próximas etapas">
      <div className="grid gap-3 sm:grid-cols-2">
        {secoes.map((s) => (
          <Card key={s.nome}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icone className="h-5 w-5 text-primary" />
              <span className="font-medium text-foreground">{s.nome}</span>
              <span className="ml-auto text-xs text-muted-foreground">Em breve</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
