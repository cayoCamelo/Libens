import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { rotulosPerfil } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Libens" },
      { name: "description", content: "Seus dados e sua função no Libens." },
      { property: "og:title", content: "Perfil — Libens" },
      { property: "og:description", content: "Seus dados e sua função no Libens." },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const { usuario, carregando, ativo } = useSessao();
  const d = useDados();
  const meus = d.ministerios.filter((m) => d.participo.has(m.id) || d.lidero.has(m.id));
  const linhas = [
    { rotulo: "Nome", valor: usuario.nome },
    { rotulo: "E-mail", valor: usuario.email },
    ...(usuario.telefone ? [{ rotulo: "Telefone", valor: usuario.telefone }] : []),
  ];

  return (
    <AppShell titulo="Perfil" descricao="Seus dados no Libens">
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
              {usuario.nome.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">
                {carregando ? "Carregando..." : usuario.nome}
              </p>
              <div className="mt-1 flex gap-2">
                <Badge>{rotulosPerfil[usuario.perfil]}</Badge>
                {!ativo ? <Badge variant="secondary">Inativo</Badge> : null}
              </div>
            </div>
          </div>
          <dl className="divide-y divide-border">
            {linhas.map((l) => (
              <div key={l.rotulo} className="flex justify-between gap-4 py-3">
                <dt className="text-sm text-muted-foreground">{l.rotulo}</dt>
                <dd className="truncate text-sm font-medium text-foreground">{l.valor}</dd>
              </div>
            ))}
          </dl>
          <EditarMeusDados />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Ministérios</p>
            <div className="flex flex-wrap gap-1.5">
              {meus.length === 0 ? <span className="text-sm text-muted-foreground">Nenhum ainda</span> : null}
              {meus.map((m) => (
                <Badge key={m.id} variant="secondary">
                  {m.name}
                  {d.lidero.has(m.id) ? " · líder" : ""}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function EditarMeusDados() {
  const { usuario, recarregarPerfil } = useSessao();
  const [nome, setNome] = useState(usuario.nome);
  const [tel, setTel] = useState(usuario.telefone ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setNome(usuario.nome); setTel(usuario.telefone ?? ""); }, [usuario.nome, usuario.telefone]);
  const salvar = async () => {
    const { error } = await supabase.from("profiles").update({ full_name: nome.trim(), phone: tel.trim() || null }).eq("id", usuario.id);
    setMsg(error ? error.message : "Dados salvos.");
    await recarregarPerfil();
  };
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-sm font-medium text-foreground">Editar meus dados</p>
      <Input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome" placeholder="Nome" />
      <Input value={tel} onChange={(e) => setTel(e.target.value)} aria-label="Telefone" placeholder="Telefone" />
      <Button size="sm" onClick={() => void salvar()}>Salvar</Button>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
