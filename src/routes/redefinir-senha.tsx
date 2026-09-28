import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthLayout, MensagemErro, traduzirErro } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Nova senha — Libens" },
      { name: "description", content: "Defina uma nova senha para sua conta do Libens." },
      { property: "og:title", content: "Nova senha — Libens" },
      { property: "og:description", content: "Defina uma nova senha para sua conta do Libens." },
    ],
  }),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <AuthLayout titulo="Criar nova senha" descricao="Escolha uma senha nova para acessar o Libens.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          if (senha !== confirmacao) return setErro("As senhas não coincidem.");
          setEnviando(true);
          const { error } = await supabase.auth.updateUser({ password: senha });
          setEnviando(false);
          if (error) {
            return setErro(
              error.message.toLowerCase().includes("session")
                ? "O link expirou ou é inválido. Solicite um novo."
                : traduzirErro(error.message),
            );
          }
          navigate({ to: "/app/inicio", replace: true });
        }}
      >
        {erro ? <MensagemErro>{erro}</MensagemErro> : null}
        <div className="space-y-2">
          <Label htmlFor="senha">Nova senha</Label>
          <Input id="senha" type="password" required minLength={6} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmacao">Confirmar senha</Label>
          <Input id="confirmacao" type="password" required minLength={6} autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </AuthLayout>
  );
}
