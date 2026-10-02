import { createFileRoute } from "@tanstack/react-router";
import { Crown, X } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
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
  const [erro, setErro] = useState<string | null>(null);
  const visiveis = d.global ? d.ministerios : d.ministerios.filter((m) => d.lidero.has(m.id) || d.participo.has(m.id));
  const nome = (id: string) => {
    const p = d.pessoas.find((x) => x.id === id);
    return p ? p.full_name || p.email : "Usuário";
  };

  const executar = async (p: PromiseLike<{ error: { message: string; code?: string } | null }>) => {
    setErro(null);
    const { error } = await p;
    if (error) setErro(error.code === "23505" ? "Essa pessoa já está nesse ministério." : error.message);
    await d.recarregar();
  };

  return (
    <AppShell titulo="Ministérios" descricao={d.global ? "Membros e líderes" : "Seus ministérios"}>
      {erro ? <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{erro}</p> : null}
      <div className="space-y-3">
        {visiveis.map((m) => {
          const membros = d.membros.filter((x) => x.ministry_id === m.id);
          const lideres = d.lideres.filter((x) => x.ministry_id === m.id);
          const naoMembros = d.pessoas.filter((p) => p.active && !membros.some((x) => x.user_id === p.id));
          const naoLideres = d.pessoas.filter((p) => p.active && !lideres.some((x) => x.user_id === p.id));
          return (
            <Card key={m.id}>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{m.name}</p>
                  <span className="text-xs text-muted-foreground">{membros.length} membros</span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Líderes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lideres.length === 0 ? <span className="text-sm text-muted-foreground">Nenhum</span> : null}
                    {lideres.map((l) => (
                      <Badge key={l.id} className="gap-1">
                        <Crown className="h-3 w-3" /> {nome(l.user_id)}
                        {d.global ? (
                          <button type="button" aria-label="Remover líder" onClick={() => void executar(supabase.from("ministry_leaders").delete().eq("id", l.id))}>
                            <X className="h-3 w-3" />
                          </button>
                        ) : null}
                      </Badge>
                    ))}
                  </div>
                  {d.global ? (
                    <Select value="" onValueChange={(v) => void executar(supabase.from("ministry_leaders").insert({ user_id: v, ministry_id: m.id }))}>
                      <SelectTrigger className="h-9" aria-label="Definir líder"><SelectValue placeholder="Definir líder" /></SelectTrigger>
                      <SelectContent>
                        {naoLideres.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Membros</p>
                  <div className="flex flex-wrap gap-1.5">
                    {membros.length === 0 ? <span className="text-sm text-muted-foreground">Nenhum</span> : null}
                    {membros.map((x) => (
                      <Badge key={x.id} variant="secondary" className="gap-1">
                        {nome(x.user_id)}
                        {d.global ? (
                          <button type="button" aria-label="Remover membro" onClick={() => void executar(supabase.from("user_ministries").delete().eq("id", x.id))}>
                            <X className="h-3 w-3" />
                          </button>
                        ) : null}
                      </Badge>
                    ))}
                  </div>
                  {d.global ? (
                    <Select value="" onValueChange={(v) => void executar(supabase.from("user_ministries").insert({ user_id: v, ministry_id: m.id }))}>
                      <SelectTrigger className="h-9" aria-label="Adicionar membro"><SelectValue placeholder="Adicionar membro" /></SelectTrigger>
                      <SelectContent>
                        {naoMembros.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!d.carregando && visiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não participa de nenhum ministério.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
