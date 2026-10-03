import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dataBr, rotulosPerfil } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";
import type { Perfil } from "@/types/libens";

export const Route = createFileRoute("/app/servos")({
  head: () => ({
    meta: [
      { title: "Servos — Libens" },
      { name: "description", content: "Pesquise e gerencie os servos e seus ministérios." },
      { property: "og:title", content: "Servos — Libens" },
      { property: "og:description", content: "Pesquise e gerencie os servos e seus ministérios." },
    ],
  }),
  component: ServosPage,
});

function ServosPage() {
  const d = useDados();
  const { usuario } = useSessao();
  const [busca, setBusca] = useState("");
  const [funcao, setFuncao] = useState("todas");
  const [ministerio, setMinisterio] = useState("todos");
  const [status, setStatus] = useState("todos");

  const nomeMin = (id: string) => d.ministerios.find((m) => m.id === id)?.name ?? "";

  const visiveis = useMemo(() => {
    if (d.global) return d.pessoas;
    const base = d.lidero.size > 0 ? d.lidero : d.participo;
    const ids = new Set(d.membros.filter((m) => base.has(m.ministry_id)).map((m) => m.user_id));
    d.lideres.filter((l) => base.has(l.ministry_id)).forEach((l) => ids.add(l.user_id));
    ids.add(usuario.id);
    return d.pessoas.filter((p) => ids.has(p.id) && p.role !== "admin");
  }, [d, usuario.id]);

  const ministeriosFiltro = d.global
    ? d.ministerios
    : d.ministerios.filter((m) => (d.lidero.size > 0 ? d.lidero : d.participo).has(m.id));

  const lista = visiveis.filter((p) => {
    const q = busca.trim().toLowerCase();
    if (q && !p.full_name.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) return false;
    if (funcao !== "todas" && p.role !== funcao) return false;
    if (status === "ativo" && !p.active) return false;
    if (status === "inativo" && p.active) return false;
    if (ministerio !== "todos" && !d.membros.some((m) => m.user_id === p.id && m.ministry_id === ministerio))
      return false;
    return true;
  });

  return (
    <AppShell titulo="Servos" descricao={`${lista.length} de ${visiveis.length} pessoas`}>
      <div className="mb-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por nome ou e-mail"
            className="pl-9"
            aria-label="Pesquisar"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={funcao} onValueChange={setFuncao}>
            <SelectTrigger aria-label="Função"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas funções</SelectItem>
              {(Object.keys(rotulosPerfil) as Perfil[]).map((f) => (
                <SelectItem key={f} value={f}>{rotulosPerfil[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ministerio} onValueChange={setMinisterio}>
            <SelectTrigger aria-label="Ministério"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos ministérios</SelectItem>
              {ministeriosFiltro.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {d.carregando ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
      <div className="space-y-3">
        {lista.map((p) => {
          const mins = d.membros.filter((m) => m.user_id === p.id).map((m) => m.ministry_id);
          const lid = d.lideres.filter((m) => m.user_id === p.id).map((m) => m.ministry_id);
          return (
            <Link key={p.id} to="/app/servos/$id" params={{ id: p.id }} className="block">
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{p.full_name || p.email}</p>
                      <p className="truncate text-sm text-muted-foreground">{p.email}</p>
                      {p.phone ? <p className="text-sm text-muted-foreground">{p.phone}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant={p.active ? "outline" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                      <Badge variant="outline">{rotulosPerfil[p.role]}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mins.map((id) => (
                      <Badge key={id} variant="secondary">
                        {nomeMin(id)}
                        {lid.includes(id) ? " · líder" : ""}
                      </Badge>
                    ))}
                    {mins.length === 0 ? <span className="text-xs text-muted-foreground">Sem ministério</span> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">Cadastro em {dataBr(p.created_at)}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {!d.carregando && lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma pessoa encontrada.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
