import { DetalheMinisterio } from "@/components/detalhe-ministerio";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { traduzirErroDb } from "@/lib/dados";
import { useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/ministerios")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Ministérios — Libens" },
      { name: "description", content: "Ministérios, membros e líderes." },
      { property: "og:title", content: "Ministérios — Libens" },
      { property: "og:description", content: "Ministérios, membros e líderes." },
    ],
  }),
  component: MinisteriosPage,
});

export function MinisteriosPage() {
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const d = useDados();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const visiveis = d.global
    ? d.ministerios
    : d.ministerios.filter((m) => d.lidero.has(m.id) || d.participo.has(m.id));
  const criar = async () => {
    setErro(null);
    if (!nome.trim()) return setErro("Informe o nome.");
    const { error } = await supabase
      .from("ministries")
      .insert({ name: nome.trim(), description: descricao.trim() || null });
    if (error) return setErro(traduzirErroDb(error));
    setNome("");
    setDescricao("");
    setCriando(false);
    await d.recarregar();
  };

  if (!d.global)
    return (
      <AppShell titulo="Ministérios">
        <p>Acesso exclusivo de Pastor(a) e Admin.</p>
      </AppShell>
    );

  if (detalhe) return <DetalheMinisterio id={detalhe} onVoltar={() => setDetalhe(null)} />;
  return (
    <AppShell
      titulo="Ministérios"
      descricao={d.global ? "Todos os ministérios" : "Seus ministérios"}
    >
      {erro ? (
        <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>
      ) : null}
      {d.global ? (
        <Button className="mb-4" onClick={() => setCriando(true)}>
          <Plus className="h-4 w-4" />
          Novo ministério
        </Button>
      ) : null}
      <Dialog open={criando} onOpenChange={setCriando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo ministério</DialogTitle>
          </DialogHeader>
          <Input
            aria-label="Nome do ministério"
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Textarea
            aria-label="Descrição do ministério"
            placeholder="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          {erro ? (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          ) : null}
          <Button onClick={() => void criar()}>Criar ministério</Button>
        </DialogContent>
      </Dialog>
      <div className="divide-y divide-border border-y border-border">
        {visiveis.map((m) => {
          const membros = d.membros.filter((x) => x.ministry_id === m.id);
          const lideres = d.lideres.filter((x) => x.ministry_id === m.id);
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => setDetalhe(m.id)}
              className="block w-full text-left"
            >
              <div className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 hover:bg-accent/30">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {membros.length} membros ·{" "}
                    {lideres.map((l) => d.nomePessoa(l.user_id)).join(", ") || "Sem líder"}
                  </p>
                </div>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {!m.active ? "Inativo" : null}
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </button>
          );
        })}
        {!d.carregando && visiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você ainda não participa de nenhum ministério.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
