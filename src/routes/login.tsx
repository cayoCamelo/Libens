import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AuthLayout, MensagemErro, traduzirErro } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Libens" },
      {
        name: "description",
        content: "Acesse o Libens para acompanhar suas escalas, disponibilidade e ministérios.",
      },
      { property: "og:title", content: "Entrar — Libens" },
      {
        property: "og:description",
        content: "Acesse o Libens para acompanhar suas escalas, disponibilidade e ministérios.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app/inicio", replace: true });
    });
  }, [navigate]);

  return (
    <AuthLayout
      titulo="Bem-vindo de volta"
      descricao="Escalas e ministérios da sua igreja, organizados em um só lugar."
      rodape={
        <p className="text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          setEnviando(true);
          const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
          setEnviando(false);
          if (error) return setErro(traduzirErro(error.message));
          navigate({ to: "/app/inicio", replace: true });
        }}
      >
        {erro ? <MensagemErro>{erro}</MensagemErro> : null}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </Button>
        <div className="text-center">
          <Link
            to="/recuperar-senha"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
