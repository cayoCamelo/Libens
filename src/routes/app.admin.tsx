import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { rotulosPerfil } from "@/data/mock";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";
import type { Perfil } from "@/types/libens";

export const Route = createFileRoute("/app/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Libens" },
      { name: "description", content: "Gerencie usuários e funções do Libens." },
      { property: "og:title", content: "Administração — Libens" },
      { property: "og:description", content: "Gerencie usuários e funções do Libens." },
    ],
  }),
  component: AdminPage,
});

const funcoesEditaveis: Perfil[] = ["servo", "lider", "pastor"];

function AdminPage() {
  const { perfil } = useSessao();
  const { pessoas, carregando, recarregar } = useDados();
  const [erro, setErro] = useState<string | null>(null);

  if (perfil !== "admin") {
    return (
      <AppShell titulo="Administração">
        <p className="text-sm text-muted-foreground">Somente o administrador acessa esta área.</p>
      </AppShell>
    );
  }

  const atualizar = async (id: string, campos: { role?: Perfil; active?: boolean }) => {
    setErro(null);
    const { error } = await supabase.from("profiles").update(campos).eq("id", id);
    if (error) setErro(error.message);
    await recarregar();
  };

  return (
    <AppShell titulo="Administração" descricao="Usuários e funções">
      {erro ? <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{erro}</p> : null}
      {carregando ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
      <div className="space-y-3">
        {pessoas.map((p) => {
          const protegido = p.role === "admin";
          return (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{p.full_name || p.email}</p>
                  <p className="truncate text-sm text-muted-foreground">{p.email}</p>
                </div>
                {protegido ? (
                  <Badge className="gap-1">
                    <Lock className="h-3 w-3" /> Administrador
                  </Badge>
                ) : (
                  <div className="flex items-center gap-3">
                    <Select
                      value={p.role}
                      onValueChange={(v) => void atualizar(p.id, { role: v as Perfil })}
                    >
                      <SelectTrigger className="w-32" aria-label="Função">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {funcoesEditaveis.map((f) => (
                          <SelectItem key={f} value={f}>
                            {rotulosPerfil[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={p.active}
                        onCheckedChange={(v) => void atualizar(p.id, { active: v })}
                        aria-label="Ativo"
                      />
                      {p.active ? "Ativo" : "Inativo"}
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        A conta administradora é única e protegida. Membros e líderes são definidos em Ministérios.
      </p>
    </AppShell>
  );
}
