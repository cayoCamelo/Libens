import { useNavigate } from "@tanstack/react-router";

import { rotulosPerfil } from "@/data/mock";
import { useSessao } from "@/lib/perfil-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Perfil } from "@/types/libens";

const perfis: Perfil[] = ["servo", "lider", "pastor", "admin"];

/**
 * Apenas para demonstração enquanto não existe autenticação real:
 * permite visualizar a navegação e as telas de cada perfil.
 */
export function SeletorPerfil({ compacto = false }: { compacto?: boolean }) {
  const { perfil, definirPerfil } = useSessao();
  const navigate = useNavigate();

  return (
    <div className="space-y-1.5">
      {!compacto ? (
        <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Perfil de demonstração
        </p>
      ) : null}
      <Select
        value={perfil}
        onValueChange={(v) => {
          definirPerfil(v as Perfil);
          navigate({ to: "/app/inicio" });
        }}
      >
        <SelectTrigger
          aria-label="Perfil de demonstração"
          className={compacto ? "h-9 w-[7.5rem] text-xs" : "w-full"}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {perfis.map((p) => (
            <SelectItem key={p} value={p}>
              {rotulosPerfil[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
