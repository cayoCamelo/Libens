import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { dataBr, rotulosPerfil } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/painel")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — Libens" },
      { name: "description", content: "Usuários e escalas do Libens em um só lugar." },
      { property: "og:title", content: "Painel administrativo — Libens" },
      { property: "og:description", content: "Usuários e escalas do Libens em um só lugar." },
    ],
  }),
  component: PainelPage,
});

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-semibold text-foreground">{valor}</p>
        <p className="text-xs text-muted-foreground">{rotulo}</p>
      </CardContent>
    </Card>
  );
}

function PainelPage() {
  const { perfil } = useSessao();
  const d = useDados();
  if (perfil !== "admin") {
    return (
      <AppShell titulo="Painel">
        <p className="text-sm text-muted-foreground">Somente o administrador acessa esta área.</p>
      </AppShell>
    );
  }
  const limite = new Date(Date.now() - 30 * 864e5).toISOString();
  const semMinisterio = d.pessoas.filter((p) => p.role !== "admin" && !d.membros.some((m) => m.user_id === p.id));
  const acima = d.pessoas.filter((p) => d.membros.filter((m) => m.user_id === p.id).length > 2);
  const recentes = [...d.pessoas].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);

  const grupos = new Map<string, { eventId: string; ministryId: string; criador: string | null; criadaEm: string; n: number }>();
  for (const s of d.escalas) {
    const k = `${s.event_id}|${s.ministry_id}`;
    const g = grupos.get(k);
    if (!g) grupos.set(k, { eventId: s.event_id, ministryId: s.ministry_id, criador: s.created_by, criadaEm: s.created_at, n: 1 });
    else {
      g.n++;
      if (s.created_at < g.criadaEm) { g.criadaEm = s.created_at; g.criador = s.created_by; }
    }
  }
  const escalas = [...grupos.values()].sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));

  return (
    <AppShell titulo="Painel administrativo" descricao="Visão geral do Libens">
      <div className="space-y-7">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Usuários</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Numero rotulo="Total" valor={d.pessoas.length} />
            <Numero rotulo="Novos (30 dias)" valor={d.pessoas.filter((p) => p.created_at >= limite).length} />
            <Numero rotulo="Ativos" valor={d.pessoas.filter((p) => p.active).length} />
            <Numero rotulo="Inativos" valor={d.pessoas.filter((p) => !p.active).length} />
            <Numero rotulo="Sem ministério" valor={semMinisterio.length} />
          </div>
          {acima.length ? (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              Atenção: {acima.map((p) => p.full_name || p.email).join(", ")} participa(m) de mais de 2 ministérios. Corrija em Servos.
            </p>
          ) : null}
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {recentes.map((p) => (
                <Link key={p.id} to="/app/servos/$id" params={{ id: p.id }} className="flex items-center justify-between gap-3 p-4 hover:bg-accent/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.full_name || p.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.email} · {dataBr(p.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="outline">{rotulosPerfil[p.role]}</Badge>
                    <Badge variant={p.active ? "outline" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Escalas ({escalas.length})</h2>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {escalas.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma escala criada.</p> : null}
              {escalas.slice(0, 10).map((g) => {
                const e = d.eventos.find((x) => x.id === g.eventId);
                const m = d.ministerios.find((x) => x.id === g.ministryId);
                return (
                  <Link
                    key={`${g.eventId}-${g.ministryId}`}
                    to="/app/escalas"
                    search={{ evento: g.eventId, ministerio: g.ministryId }}
                    className="block space-y-0.5 p-4 hover:bg-accent/40"
                  >
                    <p className="text-sm font-medium text-foreground">{e?.name ?? "Evento"} · {e ? dataBr(e.date) : ""}</p>
                    <p className="text-xs text-muted-foreground">
                      {m?.name} · Criada por {g.criador ? d.nomePessoa(g.criador) : "—"} em {dataBr(g.criadaEm)} · Membros: {g.n}
                    </p>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
