import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { dataBr, rotulosPerfil, traduzirErroDb } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";
import type { Perfil } from "@/types/libens";

export const Route = createFileRoute("/app/servos_/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes do servo — Libens" },
      { name: "description", content: "Dados, função e ministérios de um servo." },
      { property: "og:title", content: "Detalhes do servo — Libens" },
      { property: "og:description", content: "Dados, função e ministérios de um servo." },
    ],
  }),
  component: DetalheServo,
});

const funcoesEditaveis: Perfil[] = ["servo", "lider", "pastor"];

function DetalheServo() {
  const { id } = Route.useParams();
  const { perfil, usuario } = useSessao();
  const d = useDados();
  const p = d.pessoas.find((x) => x.id === id);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    if (p) {
      setNome(p.full_name);
      setTelefone(p.phone ?? "");
    }
  }, [p?.id, p?.full_name, p?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  const voltar = (
    <Link to="/app/servos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground">
      <ArrowLeft className="h-4 w-4" /> Servos
    </Link>
  );

  if (!p) {
    return (
      <AppShell titulo="Servo">
        {voltar}
        <p className="text-sm text-muted-foreground">
          {d.carregando ? "Carregando..." : "Pessoa não encontrada ou sem permissão para visualizar."}
        </p>
      </AppShell>
    );
  }

  const ehAdminAlvo = p.role === "admin";
  const souAdmin = perfil === "admin";
  const souPastor = perfil === "pastor";
  const podeEditarDados = (souAdmin || (souPastor && !ehAdminAlvo)) || p.id === usuario.id;
  const podeGerenciarVinculos = souAdmin || (souPastor && !ehAdminAlvo);

  const executar = async (q: PromiseLike<{ error: { message: string; code?: string } | null }>, ok?: string) => {
    setMsg(null);
    const { error } = await q;
    if (error) setMsg({ tipo: "erro", texto: traduzirErroDb(error)! });
    else if (ok) setMsg({ tipo: "ok", texto: ok });
    await d.recarregar();
  };

  const ministeriosVisiveis = d.global
    ? d.ministerios
    : d.ministerios.filter((m) => d.membros.some((x) => x.user_id === p.id && x.ministry_id === m.id));

  return (
    <AppShell titulo={p.full_name || p.email} descricao={rotulosPerfil[p.role]}>
      {voltar}
      {msg ? (
        <p className={`mb-3 rounded-lg p-3 text-sm ${msg.tipo === "erro" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
          {msg.texto}
        </p>
      ) : null}

      <Card className="mb-4">
        <CardContent className="space-y-4 p-5">
          <p className="font-semibold text-foreground">Dados pessoais</p>
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} disabled={!podeEditarDados} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={p.email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tel">Telefone</Label>
            <Input id="tel" value={telefone} disabled={!podeEditarDados} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          {podeEditarDados ? (
            <Button
              onClick={() =>
                void executar(
                  supabase.from("profiles").update({ full_name: nome.trim(), phone: telefone.trim() || null }).eq("id", p.id),
                  "Dados salvos.",
                )
              }
            >
              Salvar dados
            </Button>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Função</span>
            {ehAdminAlvo ? (
              <Badge className="gap-1"><Lock className="h-3 w-3" /> Administrador (protegido)</Badge>
            ) : souAdmin ? (
              <Select value={p.role} onValueChange={(v) => void executar(supabase.from("profiles").update({ role: v as Perfil }).eq("id", p.id), "Função alterada.")}>
                <SelectTrigger className="w-36" aria-label="Função"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {funcoesEditaveis.map((f) => <SelectItem key={f} value={f}>{rotulosPerfil[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline">{rotulosPerfil[p.role]}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Status</span>
            {souAdmin && !ehAdminAlvo ? (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={p.active} onCheckedChange={(v) => void executar(supabase.from("profiles").update({ active: v }).eq("id", p.id))} aria-label="Ativo" />
                {p.active ? "Ativo" : "Inativo"}
              </label>
            ) : (
              <Badge variant={p.active ? "outline" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Cadastro em {dataBr(p.created_at)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="font-semibold text-foreground">Ministérios</p>
          <p className="text-xs text-muted-foreground">Ser membro não torna a pessoa líder. Liderança é marcada separadamente.</p>
          <div className="divide-y divide-border">
            {ministeriosVisiveis.map((m) => {
              const vinc = d.membros.find((x) => x.user_id === p.id && x.ministry_id === m.id);
              const lid = d.lideres.find((x) => x.user_id === p.id && x.ministry_id === m.id);
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm font-medium text-foreground">{m.name}</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={!!vinc}
                        disabled={!podeGerenciarVinculos || (!!lid && !!vinc)}
                        onCheckedChange={(v) =>
                          void executar(
                            v
                              ? supabase.from("user_ministries").insert({ user_id: p.id, ministry_id: m.id })
                              : supabase.from("user_ministries").delete().eq("id", vinc!.id),
                          )
                        }
                      />
                      Membro
                    </label>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={!!lid}
                        disabled={!podeGerenciarVinculos}
                        onCheckedChange={(v) =>
                          void executar(
                            v
                              ? supabase.from("ministry_leaders").insert({ user_id: p.id, ministry_id: m.id })
                              : supabase.from("ministry_leaders").delete().eq("id", lid!.id),
                          )
                        }
                      />
                      Líder
                    </label>
                  </div>
                </div>
              );
            })}
            {ministeriosVisiveis.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Nenhum ministério.</p> : null}
          </div>
          {podeGerenciarVinculos ? (
            <p className="text-xs text-muted-foreground">Para remover um líder do ministério, desmarque a liderança primeiro.</p>
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  );
}
