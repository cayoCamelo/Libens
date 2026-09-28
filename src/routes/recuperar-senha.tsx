import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useState } from "react";

import { AuthLayout, MensagemErro, traduzirErro } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

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
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <AuthLayout
      titulo="Recuperar senha"
      descricao="Informe o seu e-mail e enviaremos um link para criar uma nova senha."
      rodape={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o login
        </Link>
      }
    >
      {enviado ? (
        <div className="space-y-3 text-center">
          <MailCheck className="mx-auto h-9 w-9 text-primary" aria-hidden />
          <p className="text-sm font-medium text-foreground">Verifique o seu e-mail</p>
          <p className="text-sm text-muted-foreground">
            Se houver uma conta para {email}, o link de redefinição chegará em instantes.
          </p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            setEnviando(true);
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/redefinir-senha`,
            });
            setEnviando(false);
            if (error) return setErro(traduzirErro(error.message));
            setEnviado(true);
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
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
