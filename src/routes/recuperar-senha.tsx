import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useState } from "react";

import { LibensLogo } from "@/components/libens-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — Libens" },
      {
        name: "description",
        content: "Receba um link por e-mail para redefinir a sua senha do Libens.",
      },
      { property: "og:title", content: "Recuperar senha — Libens" },
      {
        property: "og:description",
        content: "Receba um link por e-mail para redefinir a sua senha do Libens.",
      },
    ],
  }),
  component: RecuperarSenhaPage,
});

function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <LibensLogo />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
            Recuperar senha
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Informe o seu e-mail e enviaremos um link para criar uma nova senha.
          </p>
        </div>

        <Card className="mt-7">
          <CardContent className="p-5">
            {enviado ? (
              <div className="space-y-3 text-center">
                <MailCheck className="mx-auto h-9 w-9 text-primary" aria-hidden />
                <p className="text-sm font-medium text-foreground">Verifique o seu e-mail</p>
                <p className="text-sm text-muted-foreground">
                  Se houver uma conta para {email || "este endereço"}, o link de redefinição chegará
                  em instantes.
                </p>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setEnviado(true);
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
                <Button type="submit" className="w-full">
                  Enviar link
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
