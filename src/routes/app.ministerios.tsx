import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Crown, Plus } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { traduzirErroDb } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/ministerios")({
  head: () => ({
    meta: [
      { title: "Ministérios — Libens" },
      { name: "description", content: "Ministérios, membros e líderes." },
      { property: "og:title", content: "Ministérios — Libens" },
      { property: "og:description", content: "Ministérios, membros e líderes." },
    ],
  }),
  component: MinisteriosPage,
});

function MinisteriosPage() {
  const d = useDados();
  const { perfil } = useSessao();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const visiveis = d.global
    ? d.ministerios
    : d.lidero.size > 0
      ? d.ministerios.filter((m) => d.lidero.has(m.id))
      : d.ministerios.filter((m) => d.participo.has(m.id));
  const criar = async () => {
    setErro(null);
    if (!nome.trim()) return setErro("Informe o nome.");
    const { error } = await supabase.from("ministries").insert({ name: nome.trim(), description: descricao.trim() || null });
    if (error) return setErro(traduzirErroDb(error));
    setNome(""); setDescricao(""); setCriando(false);
    await d.recarregar();
  };

  return (
    <AppShell titulo="Ministérios" descricao={d.global ? "Todos os ministérios" : "Seus ministérios"}>
      {erro ? <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{erro}</p> : null}
      {perfil === "admin" ? (
        criando ? (
          <Card className="mb-4">
            <CardContent className="space-y-3 p-4">
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do ministério" aria-label="Nome" />
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (opcional)" aria-label="Descrição" />
              <div className="flex gap-2">
                <Button onClick={() => void criar()}>Criar</Button>
                <Button variant="ghost" onClick={() => setCriando(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button className="mb-4" onClick={() => setCriando(true)}><Plus className="h-4 w-4" /> Novo ministério</Button>
        )
      ) : null}
      <div className="space-y-3">
        {visiveis.map((m) => {
          const membros = d.membros.filter((x) => x.ministry_id === m.id);
          const lideres = d.lideres.filter((x) => x.ministry_id === m.id);
          return (
            <Link key={m.id} to="/app/ministerios/$id" params={{ id: m.id }} className="block">
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{m.name}</p>
                    <div className="flex items-center gap-1.5">
                      {!m.active ? <Badge variant="secondary">Inativo</Badge> : null}
                      <span className="text-xs text-muted-foreground">{membros.length} membros</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {m.description ? <p className="text-sm text-muted-foreground">{m.description}</p> : null}
                  <div className="flex flex-wrap gap-1.5">
                    {lideres.length === 0 ? <span className="text-xs text-muted-foreground">Sem líder</span> : null}
                    {lideres.map((l) => (
                      <Badge key={l.id} className="gap-1"><Crown className="h-3 w-3" /> {d.nomePessoa(l.user_id)}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {!d.carregando && visiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não participa de nenhum ministério.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
