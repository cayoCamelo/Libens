import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { useNotificacoes } from "@/components/sino-notificacoes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatarData } from "@/data/mock";
import { hora, listarDisponibilidade } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { hojeIso, useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/inicio")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Início — Libens" },
      { name: "description", content: "Sua próxima escala e a sua disponibilidade no Libens." },
      { property: "og:title", content: "Início — Libens" },
      { property: "og:description", content: "Sua próxima escala e a sua disponibilidade no Libens." },
    ],
  }),
  component: InicioPage,
});

function InicioPage() {
  const { usuario, perfil } = useSessao();
  const d = useDados();
  const avisos = useNotificacoes();
  const hoje = hojeIso();
  const primeiroNome = usuario.nome.split(" ")[0];
  const evento = (id: string) => d.eventos.find((e) => e.id === id);
  const minhas = d.escalas
    .filter((s) => s.user_id === usuario.id && s.status !== "draft")
    .map((s) => ({ s, e: evento(s.event_id) }))
    .filter((x) => x.e && x.e.date >= hoje)
    .sort((a, b) => `${a.e?.date ?? ""}${a.e?.start_time ?? ""}`.localeCompare(`${b.e?.date ?? ""}${b.e?.start_time ?? ""}`));
  const proxima = minhas[0];
  const disp = useQuery({
    queryKey: ["libens", "disp", usuario.id],
    queryFn: () => listarDisponibilidade([usuario.id]),
    enabled: !!usuario.id,
  });
  const mes = hoje.slice(0, 7);
  const dispMes = (disp.data ?? []).filter((x) => x.date.startsWith(mes));

  if (perfil === "admin") return <Navigate to="/app/painel" replace />;

  return (
    <AppShell titulo={`Olá, ${primeiroNome}`} descricao="Acompanhe o que vem por aí">
      <div className="space-y-7">
        {d.lidero.size > 0 ? <div className="flex flex-wrap gap-4"><Link to="/app/escalas" className="text-sm font-medium text-primary">Gerenciar escalas</Link><Link to="/app/eventos" className="text-sm font-medium text-primary">Eventos</Link><Link to="/app/ministerios" className="text-sm font-medium text-primary">Meus ministérios</Link></div>:null}
        {(avisos.data ?? []).some((n)=>!n.read_at) ? <section className="space-y-2"><h2 className="text-sm font-semibold text-muted-foreground">Lembretes pendentes</h2>{(avisos.data ?? []).filter((n)=>!n.read_at).slice(0,3).map((n)=><p key={n.id} className="text-sm text-foreground">{n.title}</p>)}</section>:null}
        <section className="space-y-2"><h2 className="text-sm font-semibold text-muted-foreground">Meus ministérios</h2><div className="flex flex-wrap gap-2">{d.ministerios.filter((m)=>d.lidero.has(m.id)||d.participo.has(m.id)).map((m)=><Badge key={m.id} variant="secondary">{m.name}</Badge>)}</div></section>
        <section className="space-y-2"><h2 className="text-sm font-semibold text-muted-foreground">Próximo evento</h2>{d.eventos.find((e)=>e.date>=hoje) ? (()=>{const e=d.eventos.find((e)=>e.date>=hoje);return e ? <p className="text-sm text-foreground">{e.name} · {formatarData(e.date)} · {hora(e.start_time)}</p>:null;})() : <p className="text-sm text-muted-foreground">Nenhum evento futuro.</p>}</section>
        {d.lidero.size > 0 ? <section className="space-y-2"><h2 className="text-sm font-semibold text-muted-foreground">Escalas que gerencio</h2>{d.eventos.filter((e)=>e.date>=hoje && d.escalas.some((s)=>s.event_id===e.id&&d.lidero.has(s.ministry_id))).slice(0,3).map((e)=><p key={e.id} className="text-sm text-foreground">{e.name} · {formatarData(e.date)}</p>)}</section>:null}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Próxima escala</h2>
          {proxima?.e ? (
            <Card className="border-transparent bg-primary text-primary-foreground">
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide opacity-80">{formatarData(proxima.e.date)}</p>
                  <h3 className="mt-1 text-xl font-semibold">{proxima.e.name}</h3>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-primary-foreground/15 px-3 py-1">
                    {d.ministerios.find((m) => m.id === proxima.s.ministry_id)?.name}
                  </span>
                  <span className="rounded-full bg-primary-foreground/15 px-3 py-1">{hora(proxima.e.start_time)}</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-4 text-sm text-muted-foreground">Você não tem escalas futuras.</CardContent></Card>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">Minhas próximas escalas</h2>
            <Link to="/app/escalas" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver todas <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {minhas.slice(1, 5).map(({ s, e }) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{e?.name}</p>
                  <p className="text-sm text-muted-foreground">{formatarData(e?.date ?? hoje)} · {hora(e?.start_time)}</p>
                </div>
                <Badge variant="secondary">{d.ministerios.find((m) => m.id === s.ministry_id)?.name}</Badge>
              </CardContent>
            </Card>
          ))}
          {minhas.length <= 1 ? <p className="text-sm text-muted-foreground">Nada além da próxima escala.</p> : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">Minha disponibilidade</h2>
            <Link to="/app/disponibilidade" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Editar <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <Card>
            <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <CalendarCheck className="h-5 w-5 shrink-0" aria-hidden />
              {dispMes.length
                ? `${dispMes.filter((x) => x.available).length} dias disponíveis e ${dispMes.filter((x) => !x.available).length} indisponíveis neste mês.`
                : "Você ainda não informou sua disponibilidade deste mês."}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
