import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSessao } from "@/lib/perfil-context";
import {
  aplicarTamanhoFonte,
  chaveFonte,
  tamanhosFonte,
  validarTamanhoFonte,
  type TamanhoFonte,
} from "@/lib/acessibilidade";
export function Acessibilidade() {
  const { usuario } = useSessao();
  const [fonte, setFonte] = useState<TamanhoFonte>("padrao");
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    try {
      setFonte(validarTamanhoFonte(localStorage.getItem(chaveFonte(usuario.id))));
    } catch {
      setFonte("padrao");
    }
  }, [usuario.id]);
  function mudar(v: TamanhoFonte) {
    setFonte(v);
    aplicarTamanhoFonte(v);
    try {
      localStorage.setItem(chaveFonte(usuario.id), v);
      setAviso("Preferência salva neste aparelho.");
    } catch {
      setAviso("Aplicado nesta sessão. O navegador não permitiu salvar a preferência.");
    }
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h2 className="font-semibold">Acessibilidade</h2>
        <p className="text-sm text-muted-foreground">Tamanho da fonte em todo o aplicativo</p>
        <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Tamanho da fonte">
          {(Object.keys(tamanhosFonte) as TamanhoFonte[]).map((v) => (
            <Button
              key={v}
              aria-pressed={fonte === v}
              variant={fonte === v ? "default" : "outline"}
              className="h-auto min-h-11 whitespace-normal"
              onClick={() => mudar(v)}
            >
              {v === "padrao" ? "Padrão" : v === "grande" ? "Grande" : "Muito grande"} ·{" "}
              {tamanhosFonte[v]}%
            </Button>
          ))}
        </div>
        <p className="rounded-lg bg-secondary p-3 text-sm">
          Exemplo de leitura: acompanhe suas escalas com conforto.
        </p>
        <p role="status" className="text-sm text-muted-foreground">
          {aviso}
        </p>
      </CardContent>
    </Card>
  );
}
