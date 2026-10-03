import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Crown, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { dataBr, hora, rotuloStatus, rotulosPerfil, traduzirErroDb } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { hojeIso, useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/ministerios_/$id")({
  head: () => ({
    meta: [
      { title: "Ministério — Libens" },
      { name: "description", content: "Visão geral, membros, líderes e próximas escalas do ministério." },
      { property: "og:title", content: "Ministério — Libens" },
      { property: "og:description", content: "Visão geral, membros, líderes e próximas escalas do ministério." },
    ],
  }),
  component: DetalheMinisterio,
});

type Remocao = { vinculoId: string; userId: string; liderId?: string; futuras: number };

function DetalheMinisterio() {
  const { id } = Route.useParams();
  const { perfil } = useSessao();
  const d = useDados();
  const m = d.ministerios.find((x) => x.id === id);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [addAberto, setAddAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [remocao, setRemocao] = useState<Remocao | null>(null);
  const [tirarLideranca, setTirarLideranca] = useState(false);

  useEffect(() => {
    if (m) { setNome(m.name); setDescricao(m.description ?? ""); }
  }, [m?.id, m?.name, m?.description]); // eslint-disable-line react-hooks/exhaustive-deps

  const voltar = (
    <Link to="/app/ministerios" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground">
      <ArrowLeft className="h-4 w-4" /> Ministérios
    </Link>
  );
  if (!m) {
    return (
      <AppShell titulo="Ministério">
        {voltar}
        <p className="text-sm text-muted-foreground">{d.carregando ? "Carregando..." : "Ministério não encontrado."}</p>
      </AppShell>
    );
  }

  const podeMembros = d.podeGerenciar(m.id);
  const podeLideres = d.global;
  const podeEditar = d.global;
  const hoje = hojeIso();
  const membros = d.membros.filter((x) => x.ministry_id === m.id);
  const lideres = d.lideres.filter((x) => x.ministry_id === m.id);
  const pessoa = (uid: string) => d.pessoas.find((p) => p.id === uid);
  const nomeP = (uid: string) => { const p = pessoa(uid); return p ? p.full_name || p.email : "Usuário"; };
  const eventoDe = (eid: string) => d.eventos.find((e) => e.id === eid);
  const escalasFuturas = d.escalas
    .filter((s) => s.ministry_id === m.id && (eventoDe(s.event_id)?.date ?? "") >= hoje)
    .sort((a, b) => (eventoDe(a.event_id)?.date ?? "").localeCompare(eventoDe(b.event_id)?.date ?? ""));
  const eventosFuturos = d.eventos.filter(
    (e) => e.date >= hoje && d.necessidades.some((n) => n.event_id === e.id && n.ministry_id === m.id),
  );

  const executar = async (q: PromiseLike<{ error: { message: string; code?: string } | null }>) => {
    setErro(null);
    const { error } = await q;
    if (error) setErro(traduzirErroDb(error));
    await d.recarregar();
    return !error;
  };

  const candidatos = d.pessoas.filter(
    (p) => p.active && !membros.some((x) => x.user_id === p.id) &&
      (p.full_name.toLowerCase().includes(busca.toLowerCase()) || p.email.toLowerCase().includes(busca.toLowerCase())),
  );

  const adicionar = async () => {
    if (selecionados.length === 0) return;
    const ok = await executar(
      supabase.from("user_ministries").upsert(
        selecionados.map((u) => ({ user_id: u, ministry_id: m.id })),
        { onConflict: "user_id,ministry_id", ignoreDuplicates: true },
      ),
    );
    if (ok) { setSelecionados([]); setBusca(""); setAddAberto(false); }
  };

  const pedirRemocao = (vinculoId: string, userId: string) => {
    setTirarLideranca(false);
    setRemocao({
      vinculoId, userId,
      liderId: lideres.find((l) => l.user_id === userId)?.id,
      futuras: escalasFuturas.filter((s) => s.user_id === userId).length,
    });
  };

  const confirmarRemocao = async () => {
    if (!remocao) return;
    if (remocao.liderId) {
      if (!tirarLideranca) return;
      if (!(await executar(supabase.from("ministry_leaders").delete().eq("id", remocao.liderId)))) return;
    }
    await executar(supabase.from("user_ministries").delete().eq("id", remocao.vinculoId));
    setRemocao(null);
  };

  const naoLideres = membros.filter((x) => !lideres.some((l) => l.user_id === x.user_id));

  return (
    <AppShell titulo={m.name} descricao={`${membros.length} membros`}>
      {voltar}
      {erro ? <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{erro}</p> : null}
      <Tabs defaultValue="geral">
        <TabsList className="mb-4 grid w-full grid-cols-4">
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="membros">Membros</TabsTrigger>
          <TabsTrigger value="lideres">Líderes</TabsTrigger>
          <TabsTrigger value="escalas">Escalas</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-3">
          <Card>
            <CardContent className="space-y-3 p-4">
              {podeEditar ? (
                <>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome" />
                  <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição" aria-label="Descrição" />
                  <Button onClick={() => void executar(supabase.from("ministries").update({ name: nome.trim(), description: descricao.trim() || null }).eq("id", m.id))}>
                    Salvar
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{m.description || "Sem descrição."}</p>
              )}
              <div className="flex items-center gap-3 border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Status</span>
                {perfil === "admin" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={m.active} onCheckedChange={(v) => void executar(supabase.from("ministries").update({ active: v }).eq("id", m.id))} aria-label="Ativo" />
                    {m.active ? "Ativo" : "Inativo"}
                  </label>
                ) : (
                  <Badge variant={m.active ? "outline" : "secondary"}>{m.active ? "Ativo" : "Inativo"}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {membros.length} membros · {lideres.length} líderes: {lideres.map((l) => nomeP(l.user_id)).join(", ") || "nenhum"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="font-semibold text-foreground">Próximos eventos</p>
              {eventosFuturos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento com este ministério.</p> : null}
              {eventosFuturos.map((e) => (
                <p key={e.id} className="text-sm text-foreground">{dataBr(e.date)} · {hora(e.start_time)} — {e.name}</p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="membros" className="space-y-3">
          {podeMembros ? <Button onClick={() => setAddAberto(true)}>Adicionar membro</Button> : null}
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {membros.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhum membro.</p> : null}
              {membros.map((x) => {
                const p = pessoa(x.user_id);
                const lider = lideres.some((l) => l.user_id === x.user_id);
                return (
                  <div key={x.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{nomeP(x.user_id)}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {p ? <Badge variant="outline">{rotulosPerfil[p.role]}</Badge> : null}
                        {p && !p.active ? <Badge variant="secondary">Inativo</Badge> : null}
                        {lider ? <Badge className="gap-1"><Crown className="h-3 w-3" /> Líder</Badge> : null}
                      </div>
                    </div>
                    {podeMembros ? (
                      <Button variant="ghost" size="icon" aria-label="Remover membro" onClick={() => pedirRemocao(x.id, x.user_id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lideres" className="space-y-3">
          <Card>
            <CardContent className="space-y-3 p-4">
              {lideres.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum líder.</p> : null}
              {lideres.map((l) => (
                <div key={l.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground"><Crown className="h-4 w-4 text-primary" /> {nomeP(l.user_id)}</span>
                  {podeLideres ? (
                    <Button variant="ghost" size="sm" onClick={() => void executar(supabase.from("ministry_leaders").delete().eq("id", l.id))}>Remover liderança</Button>
                  ) : null}
                </div>
              ))}
              {podeLideres ? (
                <Select value="" onValueChange={(v) => void executar(supabase.from("ministry_leaders").insert({ user_id: v, ministry_id: m.id }))}>
                  <SelectTrigger aria-label="Adicionar líder"><SelectValue placeholder="Adicionar líder (entre os membros)" /></SelectTrigger>
                  <SelectContent>
                    {naoLideres.map((x) => <SelectItem key={x.user_id} value={x.user_id}>{nomeP(x.user_id)}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : null}
              <p className="text-xs text-muted-foreground">Liderança é separada do pertencimento: remover a liderança mantém a pessoa como membro.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escalas">
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {escalasFuturas.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma escala futura.</p> : null}
              {escalasFuturas.map((s) => {
                const e = eventoDe(s.event_id);
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{e?.name}</p>
                      <p className="text-xs text-muted-foreground">{e ? `${dataBr(e.date)} · ${hora(e.start_time)}` : ""} · {nomeP(s.user_id)}</p>
                    </div>
                    <Badge variant="outline">{rotuloStatus[s.status] ?? s.status}</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addAberto} onOpenChange={setAddAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar membros</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" className="pl-9" aria-label="Pesquisar" />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {candidatos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum usuário disponível.</p> : null}
            {candidatos.map((p) => (
              <label key={p.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent/40">
                <Checkbox
                  checked={selecionados.includes(p.id)}
                  onCheckedChange={(v) => setSelecionados((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{p.full_name || p.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button disabled={selecionados.length === 0} onClick={() => void adicionar()}>
              Adicionar {selecionados.length > 0 ? `(${selecionados.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!remocao} onOpenChange={(o) => !o && setRemocao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {remocao ? nomeP(remocao.userId) : ""} de {m.name}?</AlertDialogTitle>
            <AlertDialogDescription>O histórico de escalas passadas será mantido.</AlertDialogDescription>
          </AlertDialogHeader>
          {remocao?.futuras ? (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              Essa pessoa tem {remocao.futuras} escala(s) futura(s) neste ministério. Elas continuarão registradas; revise-as em Escalas.
            </p>
          ) : null}
          {remocao?.liderId ? (
            <label className="flex items-start gap-2 rounded-lg bg-accent/50 p-3 text-sm text-foreground">
              <Checkbox checked={tirarLideranca} onCheckedChange={(v) => setTirarLideranca(!!v)} />
              Essa pessoa também é líder deste ministério. Confirmo que a liderança também será removida.
            </label>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={!!remocao?.liderId && !tirarLideranca} onClick={() => void confirmarRemocao()}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
