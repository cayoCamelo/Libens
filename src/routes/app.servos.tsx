import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dataBr, rotulosPerfil } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";
import type { Perfil } from "@/types/libens";

export const Route = createFileRoute("/app/servos")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [filtros,setFiltros]=useState(false);
  const [selecionado,setSelecionado]=useState<string|null>(null);
  const pessoa=d.pessoas.find(p=>p.id===selecionado);

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
        <Button variant="ghost" aria-expanded={filtros} aria-controls="filtros-servos" onClick={()=>setFiltros(!filtros)}>Filtros{[funcao!=="todas",ministerio!=="todos",status!=="todos"].filter(Boolean).length ? " · ativos" : ""}</Button>
        {filtros ? <div id="filtros-servos" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
        </div>:null}
      </div>

      {d.carregando ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
      <div className="divide-y divide-border border-y border-border">
        {lista.map(p=><Button key={p.id} variant="ghost" className="grid h-auto min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-none px-0 py-3 text-left whitespace-normal" onClick={()=>setSelecionado(p.id)}><span className="min-w-0"><span className="block break-words text-sm font-medium">{p.full_name||p.email}</span><span className="block text-xs font-normal text-muted-foreground">{rotulosPerfil[p.role]} · {d.membros.filter(m=>m.user_id===p.id).map(m=>nomeMin(m.ministry_id)).join(' · ')||'Sem ministério'}</span></span><span className="flex items-center gap-1 text-xs text-muted-foreground">{p.active?'Ativo':'Inativo'}<ChevronRight className="h-4 w-4"/></span></Button>)}
        {!d.carregando&&!lista.length?<p className="py-4 text-sm text-muted-foreground">Nenhuma pessoa encontrada.</p>:null}
      </div>
      <Dialog open={!!pessoa} onOpenChange={o=>!o&&setSelecionado(null)}><DialogContent className="w-[calc(100%-1rem)]"><DialogHeader><DialogTitle>{pessoa?.full_name}</DialogTitle><DialogDescription>{pessoa?rotulosPerfil[pessoa.role]:''}</DialogDescription></DialogHeader><p className="break-all text-sm">{pessoa?.email}</p>{pessoa?.phone?<p className="text-sm">{pessoa.phone}</p>:null}<p className="text-sm text-muted-foreground">Cadastro em {pessoa?dataBr(pessoa.created_at):''}</p><Button asChild><Link to="/app/servos/$id" params={{id:pessoa?.id??''}}>Abrir cadastro completo</Link></Button></DialogContent></Dialog>
    </AppShell>
  );
}
