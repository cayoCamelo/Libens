import { PainelPastoral } from "@/components/painel-pastoral";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { dataBr, hora, listarTrocas, rotulosPerfil } from "@/lib/dados";
import { eventoAindaAberto } from "@/lib/eventos";
import { hojeIso, useDados } from "@/lib/use-dados";

export function GestaoDashboard({ tipo }: { tipo: "pastor" | "admin" }) {
  const d = useDados();
  const admin = tipo === "admin";
  const trocas = useQuery({
    queryKey: ["libens", "trocas-painel"],
    queryFn: listarTrocas,
    enabled: !admin,
  });
  const hoje = hojeIso();
  const proximos = d.eventos
    .filter((e) => eventoAindaAberto(e))
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const ativos = d.pessoas.filter((p) => p.active);
  const novos = d.pessoas.filter(
    (p) => p.created_at >= new Date(Date.now() - 30 * 86400000).toISOString(),
  );
  const sem = d.pessoas.filter(
    (p) => p.role === "servo" && !d.membros.some((m) => m.user_id === p.id),
  );
  const recentes = [...d.pessoas]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4);
  const faltas = d.necessidades.flatMap((n) => {
    const e = proximos.find((e) => e.id === n.event_id);
    if (!e) return [];
    const total = d.escalas.filter(
      (s) =>
        s.event_id === n.event_id &&
        s.ministry_id === n.ministry_id &&
        ["scheduled", "confirmed"].includes(s.status) &&
        s.response !== "declined",
    ).length;
    return total < n.required_count ? [{ ...n, e, faltam: n.required_count - total }] : [];
  });
  const pendentes = trocas.data?.filter((t) => t.status === "pending_leader").length ?? 0;
  const stats = admin
    ? ([
        ["Contas cadastradas", d.pessoas.length, "/app/admin"],
        ["Novas em 30 dias", novos.length, "/app/admin"],
        ["Contas inativas", d.pessoas.length - ativos.length, "/app/admin"],
      ] as const)
    : ([
        ["Ministérios ativos", d.ministerios.filter((m) => m.active).length, "/app/ministerios"],
        [
          "Servos ativos",
          ativos.filter((p) => p.role === "servo" || p.role === "lider").length,
          "/app/servos",
        ],
        [
          "Eventos neste mês",
          d.eventos.filter((e) => e.date.startsWith(hoje.slice(0, 7)) && e.status !== "cancelled")
            .length,
          "/app/eventos",
        ],
      ] as const);
  if (!admin) return <PainelPastoral />;
  return (
    <AppShell
      titulo={admin ? "Visão administrativa" : "Visão pastoral"}
      descricao={
        admin
          ? "Cadastros, acessos e organização do Libens"
          : "Pessoas, ministérios e programação da igreja"
      }
    >
      {d.erro ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {d.erro.message}
        </p>
      ) : null}
      {d.carregando ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Carregando a visão geral...
        </p>
      ) : null}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        {stats.map(([label, value, to]) => (
          <Link
            to={to}
            key={label}
            className="min-w-0 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent sm:p-4"
          >
            <strong className="block text-2xl font-semibold">{d.carregando ? "—" : value}</strong>
            <span className="block break-words text-xs text-muted-foreground sm:text-sm">
              {label}
            </span>
          </Link>
        ))}
      </div>
      <div className="grid gap-7 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {admin ? "Usuários e acessos" : "Próximos cultos e eventos"}
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to={admin ? "/app/admin" : "/app/eventos"}>Ver todos</Link>
            </Button>
          </div>
          <div className="divide-y divide-border">
            {admin
              ? recentes.map((p) => (
                  <Link
                    key={p.id}
                    to="/app/admin"
                    className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.full_name || p.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {rotulosPerfil[p.role]} · {p.active ? "Ativo" : "Inativo"}
                      </p>
                    </div>
                    <span className="text-sm text-primary">Gerenciar ›</span>
                  </Link>
                ))
              : proximos.slice(0, 3).map((e) => (
                  <Link
                    key={e.id}
                    to="/app/eventos"
                    className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dataBr(e.date)} · {hora(e.start_time)}
                      </p>
                    </div>
                    <span className="text-sm text-primary">Abrir ›</span>
                  </Link>
                ))}
          </div>
          {!d.carregando && (admin ? !recentes.length : !proximos.length) ? (
            <p className="py-3 text-sm text-muted-foreground">Nenhum registro para mostrar.</p>
          ) : null}
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold">
            {admin ? "Organização dos cadastros" : "Acompanhamento das equipes"}
          </h2>
          <div className="divide-y divide-border">
            {admin ? (
              <>
                <Link to="/app/servos" className="block py-4">
                  <p className="text-sm font-medium">{sem.length} servo(s) sem ministério</p>
                  <p className="text-xs text-muted-foreground">Revise os vínculos das equipes ›</p>
                </Link>
                <Link to="/app/ministerios" className="block py-4">
                  <p className="text-sm font-medium">Lideranças e ministérios</p>
                  <p className="text-xs text-muted-foreground">
                    Gerencie responsáveis e participantes ›
                  </p>
                </Link>
                <Link to="/app/escalas" className="block py-4">
                  <p className="text-sm font-medium">Escalas e programação</p>
                  <p className="text-xs text-muted-foreground">
                    Consulte e corrija a organização ›
                  </p>
                </Link>
              </>
            ) : (
              <>
                {faltas.slice(0, 3).map((n) => (
                  <Link
                    key={n.id}
                    to="/app/escalas"
                    search={{ evento: n.e.id, ministerio: n.ministry_id }}
                    className="block py-3"
                  >
                    <p className="text-sm font-medium">
                      {d.ministerios.find((m) => m.id === n.ministry_id)?.name} · {n.faltam} vaga(s)
                      a revisar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dataBr(n.e.date)} · {n.e.name} ›
                    </p>
                  </Link>
                ))}
                {!faltas.length && !d.carregando ? (
                  <p className="py-3 text-sm text-muted-foreground">
                    Nenhuma vaga pendente nas quantidades cadastradas.
                  </p>
                ) : null}
                <Link to="/app/escalas" className="block py-4">
                  <p className="text-sm font-medium">
                    {trocas.isPending
                      ? "Consultando substituições..."
                      : `${pendentes} substituição(ões) aguardando aprovação`}
                  </p>
                  <p className="text-xs text-muted-foreground">Acompanhe os pedidos em Escalas ›</p>
                </Link>
                {trocas.error ? (
                  <p role="alert" className="text-sm text-destructive">
                    Não foi possível consultar as substituições.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
