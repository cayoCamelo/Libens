import { createFileRoute, Link } from "@tanstack/react-router";
import { EscolherMinisterios } from "@/components/escolher-ministerios";
import { MailCheck } from "lucide-react";
import { useState } from "react";

import { AuthLayout, MensagemErro, traduzirErro } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Criar conta — Libens" },
      { name: "description", content: "Crie sua conta no Libens para servir nos ministérios." },
      { property: "og:title", content: "Criar conta — Libens" },
      {
        property: "og:description",
        content: "Crie sua conta no Libens para servir nos ministérios.",
      },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const [ids, setIds] = useState<string[]>([]);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  return (
    <AuthLayout
      titulo="Criar conta"
      descricao="Preencha seus dados para começar a usar o Libens."
      rodape={
        <p className="text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      {enviado ? (
        <div className="space-y-3 text-center">
          <MailCheck className="mx-auto h-9 w-9 text-primary" aria-hidden />
          <p className="text-sm font-medium text-foreground">Confirme seu e-mail</p>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de confirmação para {email}. Depois de confirmar, é só entrar.
          </p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            if (ids.length < 1 || ids.length > 2)
              return setErro("Selecione um ou dois ministérios.");
            if (nome.trim().split(/\s+/).length !== 2)
              return setErro("Informe seu primeiro e segundo nome.");
            setEnviando(true);
            const { error } = await supabase.auth.signUp({
              email,
              password: senha,
              options: {
                emailRedirectTo: `${window.location.origin}/app/inicio`,
                data: { full_name: nome.trim(), ministry_ids: ids },
              },
            });
            setEnviando(false);
            if (error) return setErro(traduzirErro(error.message));
            setEnviado(true);
          }}
        >
          {erro ? <MensagemErro>{erro}</MensagemErro> : null}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              required
              maxLength={120}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Informe apenas seu primeiro e segundo nome.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type={mostrarSenha ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <button
            type="button"
            aria-pressed={mostrarSenha}
            className="text-sm text-primary"
            onClick={() => setMostrarSenha(!mostrarSenha)}
          >
            {mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
          </button>
          <EscolherMinisterios value={ids} onChange={setIds} />
          <Button type="submit" className="w-full" disabled={enviando || !ids.length}>
            {enviando ? "Criando..." : "Criar conta"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
