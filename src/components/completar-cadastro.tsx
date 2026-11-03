import { useState } from "react";
import { useDados } from "@/lib/use-dados";
import { useSessao } from "@/lib/perfil-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EscolherMinisterios } from "@/components/escolher-ministerios";
export function CompletarCadastro() {
  const d = useDados();
  const { perfil } = useSessao();
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const aberto =
    !d.carregando &&
    !d.erro &&
    !d.global &&
    d.participo.size === 0 &&
    d.lidero.size === 0 &&
    (perfil === "servo" || perfil === "lider");
  async function salvar() {
    setBusy(true);
    setErro("");
    try {
      const r = await supabase.rpc("complete_my_ministries", { _ids: ids });
      if (r.error) throw r.error;
      await d.recarregar();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : ((e as { message?: string })?.message ?? "Não foi possível salvar."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={aberto}>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-h-[90dvh] overflow-y-auto [&>button]:hidden"
      >
        <DialogHeader>
          <DialogTitle>Complete seu cadastro</DialogTitle>
          <DialogDescription>
            Escolha seu ministério para continuar. Seu cargo e histórico serão preservados.
          </DialogDescription>
        </DialogHeader>
        <EscolherMinisterios value={ids} onChange={setIds} />
        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <Button disabled={busy || ids.length < 1} onClick={() => void salvar()}>
          {busy ? "Salvando..." : "Salvar e continuar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
