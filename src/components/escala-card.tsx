import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { eventoPorId, formatarData, ministerioPorId, servoPorId } from "@/data/mock";
import type { Escala } from "@/types/libens";

export function EscalaCard({ escala }: { escala: Escala }) {
  const evento = eventoPorId(escala.eventoId);
  const ministerio = ministerioPorId(escala.ministerioId);
  const equipe = escala.servoIds.map((id) => servoPorId(id)?.nome).filter(Boolean);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {evento ? formatarData(evento.data) : "Data a definir"}
              {evento ? ` · ${evento.hora}` : ""}
            </p>
            <h3 className="truncate text-base font-semibold text-foreground">{evento?.nome}</h3>
            <p className="truncate text-sm text-muted-foreground">{ministerio?.nome}</p>
          </div>
          <Badge variant={escala.confirmada ? "default" : "secondary"} className="shrink-0">
            {escala.confirmada ? "Confirmada" : "Pendente"}
          </Badge>
        </div>

        {equipe.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
            {equipe.map((nome) => (
              <span
                key={nome}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                {nome}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
