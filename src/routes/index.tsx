import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { LibensLogo } from "@/components/libens-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
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

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <LibensLogo />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
            Bem-vindo de volta
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Escalas e ministérios da sua igreja, organizados em um só lugar.
          </p>
        </div>

        <Card className="mt-7">
          <CardContent className="p-5">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                // Autenticação real será implementada em uma próxima etapa.
                navigate({ to: "/app/inicio" });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
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
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full">
                Entrar
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
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Versão de demonstração: o acesso ainda não exige senha.
        </p>
      </div>
    </div>
  );
}
