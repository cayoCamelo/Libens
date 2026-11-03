import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { dataBr, hora } from "@/lib/dados";
import { eventoAindaAberto } from "@/lib/eventos";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/inicio")({
  head: () => ({ meta: [{ title: "Início — Libens" }] }),
  component: InicioPage,
});
function InicioPage() {
  const { usuario, perfil, carregando } = useSessao();
  const d = useDados();
  const grupos = d.eventos
    .filter(eventoAindaAbertoFilter)
    .flatMap((e) => {
      const escalas = d.escalas.filter(
        (s) => s.event_id === e.id && s.user_id === usuario.id && s.status !== "draft",
      );
      return d.ministerios.flatMap((m) => {
        const equipe = escalas.filter((s) => s.ministry_id === m.id);
        return equipe.length ? [{ e, m, equipe }] : [];
      });
    })
    .sort((a, b) => (a.e.date + a.e.start_time).localeCompare(b.e.date + b.e.start_time));
  if (!carregando && d.global) return <Navigate to="/app/painel" replace />;
  return (
    <AppShell
      titulo={`Olá, ${usuario.nome.split(" ")[0]}`}
      descricao={
        perfil === "lider" || d.lidero.size > 0 ? "Dias em que você vai servir" : "Suas escalas"
      }
    >
      {d.erro ? (
        <p role="alert" className="text-destructive">
          Não foi possível carregar as escalas. Tente novamente.
        </p>
      ) : null}
      {d.carregando ? (
        <p role="status">Carregando escalas...</p>
      ) : !grupos.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma escala futura criada para você.</p>
      ) : null}
      <div className="grid gap-3">
        {grupos.map(({ e, m, equipe }) => (
          <Link
            key={`${e.id}:${m.id}`}
            to="/app/escalas"
            search={{ evento: e.id, ministerio: m.id }}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)_1rem] items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-secondary"
          >
            <span className="rounded-lg bg-primary/10 p-2 text-center text-primary">
              <strong className="block text-2xl">{e.date.slice(8, 10)}</strong>
              <span className="text-xs capitalize">
                {new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(
                  new Date(`${e.date}T12:00:00`),
                )}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{m.name}</span>
              <span className="block text-xs text-muted-foreground">
                {dataBr(e.date)} · {hora(e.start_time)}
              </span>
              <span className="mt-1 block break-words text-sm">
                {perfil === "lider" || d.lidero.size > 0
                  ? "Você está escalado"
                  : equipe.map((s) => d.nomePessoa(s.user_id)).join(" · ")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
function eventoAindaAbertoFilter(e: Parameters<typeof eventoAindaAberto>[0]) {
  return eventoAindaAberto(e);
}
