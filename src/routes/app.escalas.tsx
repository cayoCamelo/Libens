import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { EditorEscala } from "@/components/editor-escala";
import { EditorEvento } from "@/components/editor-evento";
import { MinhasTrocas } from "@/components/minhas-trocas";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  dataBr,
  hora,
  rotuloEventoStatus,
  rotuloResposta,
  rotuloStatus,
  traduzirErroDb,
  type EventoDb,
} from "@/lib/dados";
import {
  filtrarEscalas,
  intervaloEscalas,
  podeEditarEvento,
  podeExcluirEscala,
} from "@/lib/escalas-visao";
import { eventoAindaAberto } from "@/lib/eventos";
import { useSessao } from "@/lib/perfil-context";
import { hojeIso, useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/escalas")({
  validateSearch: (s) =>
    z.object({ evento: z.string().optional(), ministerio: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Escalas — Libens" },
      { name: "description", content: "Escalas dos ministérios para cada evento." },
      { property: "og:title", content: "Escalas — Libens" },
      { property: "og:description", content: "Escalas dos ministérios para cada evento." },
    ],
  }),
  component: EscalasPage,
});

function EscalasPage() {
  const { usuario } = useSessao();
  const d = useDados();
  const busca = Route.useSearch();
  const [editor, setEditor] = useState<{ eventId: string; ministryId: string } | null | undefined>(
    undefined,
  );
  const [editorEvento, setEditorEvento] = useState<EventoDb | null | undefined>(undefined);
  const [detalheId, setDetalheId] = useState<string | null>(busca.evento ?? null);
  const [exclusao, setExclusao] = useState<{ eventId: string; ministryId?: string } | null>(null);
  const [erro, setErro] = useState<string | null>(busca.evento ?? null);
  const [ocupado, setOcupado] = useState(false);
  const podeCriar = d.global || d.lidero.size > 0;
  const hoje = hojeIso();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [periodo, setPeriodo] = useState("mes");
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [texto, setTexto] = useState("");
  const [ev, setEv] = useState("todos");
  const [min, setMin] = useState("todos");
  const [pessoa, setPessoa] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [visao, setVisao] = useState("todas");
  const [filtros, setFiltros] = useState(false);
  const intervalo = intervaloEscalas(hoje, mes, periodo, de, ate);
  // Include membership ministries for leaders too; RLS determines which rows are returned.
  const mins = d.ministerios.filter((m) => d.global || d.lidero.has(m.id) || d.participo.has(m.id));
  const itensFiltrados = filtrarEscalas(
    d.escalas,
    new Set(mins.map((m) => m.id)),
    { ministerio: min, pessoa, status, visao },
    usuario.id,
  );
  const proximos = d.eventos
    .filter((e) => {
      if (e.date < intervalo[0] || e.date > intervalo[1] || (ev !== "todos" && ev !== e.id))
        return false;
      const rows = itensFiltrados.filter((s) => s.event_id === e.id);
      if (
        (min !== "todos" ||
          pessoa !== "todos" ||
          status !== "todos" ||
          visao === "minhas" ||
          !podeCriar) &&
        !rows.length
      )
        return false;
      const q = texto.trim().toLocaleLowerCase();
      return (
        !q ||
        e.name.toLocaleLowerCase().includes(q) ||
        rows.some((s) =>
          (d.nomePessoa(s.user_id) + " " + d.ministerios.find((m) => m.id === s.ministry_id)?.name)
            .toLocaleLowerCase()
            .includes(q),
        )
      );
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  const detalhe = d.eventos.find((e) => e.id === detalheId);
  const grupos = (id: string, filtrado: boolean) =>
    mins
      .map((m) => ({
        m,
        itens: (filtrado ? itensFiltrados : d.escalas).filter(
          (s) => s.event_id === id && s.ministry_id === m.id,
        ),
      }))
      .filter((g) => g.itens.length);
  const filtro = (
    label: string,
    valor: string,
    mudar: (v: string) => void,
    opcoes: [string, string][],
  ) => (
    <div className="min-w-0 space-y-1.5">
      <Label>{label}</Label>
      <Select value={valor} onValueChange={mudar}>
        <SelectTrigger className="min-h-11 w-full min-w-0 [&>span]:truncate" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-w-[calc(100vw-1rem)]">
          {opcoes.map(([v, l]) => (
            <SelectItem key={v} value={v} className="break-words">
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  const abrirEscala = (eventId: string, ministryId: string) => {
    setDetalheId(null);
    setEditor({ eventId, ministryId });
  };
  const excluir = async () => {
    if (!exclusao) return;
    const evento = d.eventos.find((e) => e.id === exclusao.eventId);
    if (!evento) return;
    const itens = d.escalas.filter(
      (s) => s.event_id === evento.id && s.ministry_id === exclusao.ministryId,
    );
    if (
      exclusao.ministryId
        ? !podeExcluirEscala(itens, d.global, d.lidero, usuario.id)
        : !podeEditarEvento(evento, d.global, d.lidero, usuario.id)
    )
      return;
    setOcupado(true);
    setErro(null);
    try {
      const r = exclusao.ministryId
        ? await supabase
            .from("schedules")
            .delete()
            .in(
              "id",
              itens.map((s) => s.id),
            )
            .select("id")
        : await supabase.from("events").delete().eq("id", evento.id).select("id").single();
      if (r.error) throw r.error;
      if (!r.data || (Array.isArray(r.data) && r.data.length !== itens.length))
        throw new Error(
          "A exclusão não foi permitida. Atualize a lista e verifique suas permissões.",
        );
      await d.recarregar();
      setExclusao(null);
      if (!exclusao.ministryId) setDetalheId(null);
    } catch (e) {
      const falha = e as { message: string; code?: string };
      setErro(
        falha.code === "23503"
          ? "Este evento possui escalas ou registros vinculados. A exclusão foi bloqueada para preservar o histórico."
          : traduzirErroDb(falha),
      );
    } finally {
      setOcupado(false);
    }
  };
  const adicionais = [
    texto.trim(),
    ev !== "todos",
    pessoa !== "todos",
    status !== "todos",
    visao !== "todas",
    periodo !== "mes",
  ].filter(Boolean).length;
  return (
    <AppShell titulo="Escalas" descricao="Escalas e equipes do mês">
      {podeCriar ? (
        <div className="mb-4 grid gap-2 sm:flex">
          <Button className="min-h-11" onClick={() => setEditor(null)}>
            <Plus />
            Criar escala
          </Button>
          <Button className="min-h-11" onClick={() => setEditorEvento(null)}>
            <Plus />
            Criar evento
          </Button>
        </div>
      ) : null}
      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="escala-mes">Mês</Label>
            <Input
              id="escala-mes"
              type="month"
              className="min-h-11 w-full min-w-0"
              value={mes}
              onChange={(e) => {
                if (e.target.value) {
                  setMes(e.target.value);
                  setPeriodo("mes");
                }
              }}
            />
          </div>
          {filtro("Ministério", min, setMin, [
            ["todos", "Todos os ministérios"],
            ...mins.map((m): [string, string] => [m.id, m.name]),
          ])}
        </div>
        <Button
          variant="ghost"
          className="min-h-11 px-0"
          aria-expanded={filtros}
          aria-controls="filtros-escalas"
          onClick={() => setFiltros((v) => !v)}
        >
          <SlidersHorizontal />
          Filtros{adicionais ? <Badge variant="secondary">{adicionais}</Badge> : null}
          {filtros ? <ChevronUp /> : <ChevronDown />}
        </Button>
        {filtros ? (
          <div id="filtros-escalas" className="space-y-3 border-t border-border pt-3">
            <Input
              className="min-h-11"
              aria-label="Pesquisar escalas"
              placeholder="Pesquisar evento, ministério ou pessoa..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {filtro("Período", periodo, setPeriodo, [
                ["mes", "Mês selecionado"],
                ["hoje", "Hoje"],
                ["semana", "Esta semana"],
                ["proximo", "Próximo mês"],
                ["custom", "Personalizado"],
              ])}
              {filtro("Evento", ev, setEv, [
                ["todos", "Todos os eventos"],
                ...d.eventos.map((e): [string, string] => [e.id, `${e.name} · ${dataBr(e.date)}`]),
              ])}
              {filtro("Pessoa", pessoa, setPessoa, [
                ["todos", "Todas as pessoas"],
                ...d.pessoas.map((p): [string, string] => [p.id, p.full_name || p.email]),
              ])}
              {filtro("Status", status, setStatus, [
                ["todos", "Todos os status"],
                ...Object.entries(rotuloStatus),
              ])}
              {filtro("Visão", visao, setVisao, [
                ["todas", "Todas as permitidas"],
                ["minhas", "Minhas escalas"],
              ])}
            </div>
            {periodo === "custom" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <Label htmlFor="escala-de">De</Label>
                  <Input
                    id="escala-de"
                    type="date"
                    className="min-h-11 min-w-0"
                    value={de}
                    onChange={(e) => setDe(e.target.value)}
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="escala-ate">Até</Label>
                  <Input
                    id="escala-ate"
                    type="date"
                    className="min-h-11 min-w-0"
                    value={ate}
                    onChange={(e) => setAte(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setTexto("");
                setEv("todos");
                setPessoa("todos");
                setStatus("todos");
                setVisao("todas");
                setPeriodo("mes");
              }}
            >
              Limpar filtros adicionais
            </Button>
          </div>
        ) : null}
      </div>
      <MinhasTrocas />
      <div className="mb-2 flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {dataBr(intervalo[0])} – {dataBr(intervalo[1])}
        </span>
        <span className="shrink-0">{proximos.length} eventos</span>
      </div>
      {d.erro ? (
        <p role="alert" className="text-sm text-destructive">
          {d.erro.message}
        </p>
      ) : null}
      <div className="divide-y divide-border border-y border-border">
        {proximos.map((e) => (
          <Button
            key={e.id}
            variant="ghost"
            className="grid h-auto min-h-16 w-full grid-cols-[2.75rem_minmax(0,1fr)_1rem] items-start gap-3 rounded-none px-1 py-3 text-left whitespace-normal hover:bg-secondary"
            onClick={() => setDetalheId(e.id)}
            aria-label={`Ver evento ${e.name} em ${dataBr(e.date)}`}
          >
            <span className="flex shrink-0 flex-col items-center text-primary">
              <span className="text-xl font-semibold leading-none">{e.date.slice(8, 10)}</span>
              <span className="mt-1 text-xs font-normal">
                {new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
                  .format(new Date(`${e.date}T12:00:00`))
                  .replace(".", "")}
              </span>
            </span>
            <span className="min-w-0 space-y-1">
              {proximos.filter((outro) => outro.date === e.date).length > 1 ||
              e.status !== "scheduled" ? (
                <span className="block break-words text-xs font-normal text-muted-foreground">
                  {proximos.filter((outro) => outro.date === e.date).length > 1
                    ? hora(e.start_time)
                    : ""}
                  {e.status !== "scheduled" ? ` ${rotuloEventoStatus[e.status]}` : ""}
                </span>
              ) : null}
              {grupos(e.id, true).map(({ m, itens }) => (
                <span key={m.id} className="block break-words text-sm font-normal">
                  {min === "todos" ? (
                    <span className="font-semibold text-primary">{m.name}: </span>
                  ) : null}
                  {itens.map((s) => d.nomePessoa(s.user_id)).join(" · ")}
                </span>
              ))}
              {!grupos(e.id, true).length ? (
                <span className="block text-sm font-normal text-muted-foreground">
                  Nenhuma escala ainda.
                </span>
              ) : null}
            </span>
            <ChevronRight className="mt-1 shrink-0 text-muted-foreground" />
          </Button>
        ))}
      </div>
      {d.carregando ? (
        <p role="status" className="py-4 text-sm text-muted-foreground">
          Carregando escalas...
        </p>
      ) : !proximos.length ? (
        <p className="py-4 text-sm text-muted-foreground">
          Nenhum evento encontrado neste período e filtros.
        </p>
      ) : null}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalheId(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6 [&_button]:min-h-11 [&_button]:whitespace-normal">
          <DialogHeader>
            <DialogTitle className="break-words pr-7">{detalhe?.name}</DialogTitle>
            <DialogDescription>
              {detalhe
                ? `${dataBr(detalhe.date)} · ${hora(detalhe.start_time)}${detalhe.end_time ? `–${hora(detalhe.end_time)}` : ""} · ${rotuloEventoStatus[detalhe.status]}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {detalhe ? (
            <>
              {detalhe.location ? <p className="break-words text-sm">{detalhe.location}</p> : null}
              {detalhe.description ? (
                <p className="break-words text-sm text-muted-foreground">{detalhe.description}</p>
              ) : null}
              <div className="divide-y divide-border">
                {grupos(detalhe.id, false).map(({ m, itens }) => (
                  <section key={m.id} className="space-y-3 py-3">
                    <h3 className="break-words text-sm font-semibold text-primary">{m.name}</h3>
                    <ul className="space-y-2">
                      {itens.map((s) => (
                        <li
                          key={s.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-sm"
                        >
                          <span className="min-w-0 break-words">
                            {d.nomePessoa(s.user_id)}
                            {s.user_id === usuario.id ? " (você)" : ""}
                            <span className="block text-xs text-muted-foreground">
                              {rotuloStatus[s.status]}
                            </span>
                          </span>
                          <span
                            className={
                              s.response === "declined"
                                ? "text-destructive"
                                : s.response === "confirmed"
                                  ? "text-success"
                                  : "text-muted-foreground"
                            }
                          >
                            {rotuloResposta[s.response]}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      {itens.filter((s) => s.response === "confirmed").length} confirmados ·{" "}
                      {itens.filter((s) => s.response === "declined").length} recusaram ·{" "}
                      {itens.filter((s) => s.response === "pending").length} sem resposta
                      {itens[0]?.created_by
                        ? ` · Criada por ${d.nomePessoa(itens[0].created_by)}`
                        : ""}
                    </p>
                    <div className="grid gap-2 sm:flex sm:flex-wrap">
                      {d.podeGerenciar(m.id) ? (
                        <Button variant="outline" onClick={() => abrirEscala(detalhe.id, m.id)}>
                          <Pencil />
                          Editar escala
                        </Button>
                      ) : null}
                      {podeExcluirEscala(itens, d.global, d.lidero, usuario.id) ? (
                        <Button
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            setErro(null);
                            setExclusao({ eventId: detalhe.id, ministryId: m.id });
                          }}
                        >
                          <Trash2 />
                          Excluir escala de {m.name}
                        </Button>
                      ) : null}
                    </div>
                  </section>
                ))}
              </div>
              <MinhasTrocas key={detalhe.id} eventId={detalhe.id} inicialmenteAberto />
              <div className="grid gap-2 border-t border-border pt-3 sm:flex sm:flex-wrap">
                {podeCriar && eventoAindaAberto(detalhe) ? (
                  <Button
                    onClick={() =>
                      abrirEscala(
                        detalhe.id,
                        min !== "todos" && d.podeGerenciar(min)
                          ? min
                          : (mins.find(
                              (m) =>
                                d.podeGerenciar(m.id) &&
                                !d.escalas.some(
                                  (s) => s.event_id === detalhe.id && s.ministry_id === m.id,
                                ),
                            )?.id ?? ""),
                      )
                    }
                  >
                    <Plus />
                    Criar escala
                  </Button>
                ) : null}
                {podeEditarEvento(detalhe, d.global, d.lidero, usuario.id) ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDetalheId(null);
                        setEditorEvento(detalhe);
                      }}
                    >
                      <Pencil />
                      Editar evento
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        setErro(null);
                        setExclusao({ eventId: detalhe.id });
                      }}
                    >
                      <Trash2 />
                      Excluir evento inteiro
                    </Button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={!!exclusao} onOpenChange={(o) => !o && !ocupado && setExclusao(null)}>
        <DialogContent className="w-[calc(100%-1rem)] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="pr-7">
              {exclusao?.ministryId ? "Excluir escala do ministério?" : "Excluir evento inteiro?"}
            </DialogTitle>
            <DialogDescription>
              {exclusao?.ministryId
                ? `Somente a escala de ${d.ministerios.find((m) => m.id === exclusao.ministryId)?.name} será excluída. O evento e as outras equipes serão preservados.`
                : "A exclusão do evento será bloqueada se houver escalas ou registros vinculados. Nenhuma equipe será excluída automaticamente."}{" "}
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {erro ? (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="min-h-11"
              variant="secondary"
              disabled={ocupado}
              onClick={() => setExclusao(null)}
            >
              Cancelar
            </Button>
            <Button
              className="min-h-11"
              variant="destructive"
              disabled={ocupado}
              onClick={() => void excluir()}
            >
              {ocupado ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {podeCriar ? (
        <>
          <EditorEscala
            aberto={editor !== undefined}
            inicial={editor ?? undefined}
            onFechar={() => setEditor(undefined)}
          />
          <EditorEvento
            aberto={editorEvento !== undefined}
            evento={editorEvento ?? undefined}
            onFechar={() => setEditorEvento(undefined)}
          />
        </>
      ) : null}
    </AppShell>
  );
}
