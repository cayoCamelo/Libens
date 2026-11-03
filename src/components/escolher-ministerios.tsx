import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
export function EscolherMinisterios({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const q = useQuery({
    queryKey: ["signup-ministries"],
    queryFn: async () => {
      const r = await supabase.rpc("signup_ministries");
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">De qual ministério você faz parte?</legend>
      <p className="text-xs text-muted-foreground">
        Selecione um ou dois. Sua conta será criada como Servo.
      </p>
      {q.isPending ? (
        <p role="status" className="text-sm">
          Carregando ministérios...
        </p>
      ) : null}
      {q.error ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar.{" "}
          <button type="button" className="underline" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      ) : null}
      {q.data?.map((m) => (
        <label
          key={m.id}
          className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3"
        >
          <Checkbox
            checked={value.includes(m.id)}
            disabled={!value.includes(m.id) && value.length >= 2}
            onCheckedChange={(v) =>
              onChange(v ? [...value, m.id] : value.filter((id) => id !== m.id))
            }
          />
          <span className="text-sm">{m.name}</span>
        </label>
      ))}
      {q.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum ministério ativo. Procure a administração.
        </p>
      ) : null}
    </fieldset>
  );
}
