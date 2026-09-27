import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { EscalaCard } from "@/components/escala-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  disponibilidades,
  escalas,
  eventoPorId,
  formatarData,
  formatarDataCurta,
  ministerioPorId,
} from "@/data/mock";
import { useSessao } from "@/lib/perfil-context";

export const Route = createFileRoute("/app/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Libens" },
      {
        name: "description",
        content: "Sua próxima escala, as escalas do mês e a sua disponibilidade no Libens.",
      },
      { property: "og:title", content: "Início — Libens" },
      {
        property: "og:description",
        content: "Sua próxima escala, as escalas do mês e a sua disponibilidade no Libens.",
      },
    ],
  }),
  component: InicioPage,
});

function InicioPage() {
  const { usuario } = useSessao();
  const primeiroNome = usuario.nome.split(" ")[0];

  const proxima = escalas[0];
  const eventoProximo = eventoPorId(proxima.eventoId);
  const ministerioProximo = ministerioPorId(proxima.ministerioId);
  const escalasDoMes = escalas.slice(0, 4);
  const minhaDisponibilidade = disponibilidades.filter((d) => d.servoId === usuario.id);

  return (
    <AppShell titulo={`Olá, ${primeiroNome}`} descricao="Veja o que vem por aí">
      <div className="space-y-7">
        <section aria-labelledby="proxima-escala" className="space-y-3">
          <h2 id="proxima-escala" className="text-sm font-semibold text-muted-foreground">
            Próxima escala
          </h2>
          <Card className="border-transparent bg-primary text-primary-foreground">
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {eventoProximo ? formatarData(eventoProximo.data) : "Data a definir"}
                </p>
                <h3 className="mt-1 text-xl font-semibold">{eventoProximo?.nome}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-primary-foreground/15 px-3 py-1">
                  {ministerioProximo?.nome}
                </span>
                {eventoProximo ? (
                  <span className="rounded-full bg-primary-foreground/15 px-3 py-1">
                    {eventoProximo.hora}
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="escalas-mes" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="escalas-mes" className="text-sm font-semibold text-muted-foreground">
              Escalas do mês
            </h2>
            <Link
              to="/app/escalas"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ver todas
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {escalasDoMes.map((escala) => (
              <EscalaCard key={escala.id} escala={escala} />
            ))}
          </div>
        </section>

        <section aria-labelledby="minha-disponibilidade" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="minha-disponibilidade" className="text-sm font-semibold text-muted-foreground">
              Minha disponibilidade
            </h2>
            <Link
              to="/app/disponibilidade"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Editar
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <Card>
            <CardContent className="p-4">
              {minhaDisponibilidade.length > 0 ? (
                <ul className="divide-y divide-border">
                  {minhaDisponibilidade.map((d) => (
                    <li key={d.data} className="flex items-center justify-between py-2.5 first:pt-0">
                      <span className="text-sm font-medium text-foreground">
                        {formatarDataCurta(d.data)}
                      </span>
                      <div className="flex gap-1.5">
                        {d.periodos.map((p) => (
                          <Badge key={p} variant="secondary">
                            {p === "manha" ? "Manhã" : p === "tarde" ? "Tarde" : "Noite"}
                          </Badge>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <CalendarCheck className="h-5 w-5 shrink-0" aria-hidden />
                  Você ainda não informou sua disponibilidade deste mês.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
