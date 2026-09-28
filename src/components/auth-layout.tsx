import type { ReactNode } from "react";

import { LibensLogo } from "@/components/libens-logo";
import { Card, CardContent } from "@/components/ui/card";

export function AuthLayout({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <LibensLogo />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">{titulo}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{descricao}</p>
        </div>
        <Card className="mt-7">
          <CardContent className="p-5">{children}</CardContent>
        </Card>
        {rodape ? <div className="mt-6 text-center">{rodape}</div> : null}
      </div>
    </div>
  );
}

export function MensagemErro({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

export function traduzirErro(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("already registered")) return "Já existe uma conta com este e-mail.";
  if (m.includes("password")) return "A senha deve ter pelo menos 6 caracteres e não pode ser fraca.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  return "Não foi possível concluir. Tente novamente.";
}
