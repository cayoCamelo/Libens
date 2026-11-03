import { useState } from "react";
import { PainelPastoral } from "@/components/painel-pastoral";
import { Acessos } from "@/components/acessos";
import { AppShell } from "@/components/layout/app-shell";
import { AreaEmbutida } from "@/lib/area-embutida";
import { Button } from "@/components/ui/button";
import { EscalasPage } from "@/routes/app.escalas";
import { DisponibilidadePage } from "@/routes/app.disponibilidade";
import { MinisteriosPage } from "@/routes/app.ministerios";
import { useDados } from "@/lib/use-dados";
export function GestaoDashboard({ tipo }: { tipo: "pastor" | "admin" }) {
  const d = useDados();
  const [area, setArea] = useState<string | null>(null);
  if (tipo === "pastor") return <PainelPastoral />;
  const stats = [
    ["Contas", d.pessoas.length],
    ["Ministérios ativos", d.ministerios.filter((m) => m.active).length],
    ["Contas inativas", d.pessoas.filter((p) => !p.active).length],
  ];
  return (
    <AppShell titulo="Painel principal" descricao="Cadastros, acessos e organização do Libens">
      {d.erro ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {d.erro.message}
        </p>
      ) : null}
      <div className="resumo-gestao mb-6 grid grid-cols-3 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <strong className="block text-2xl">{d.carregando ? "—" : value}</strong>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <section id="acessos" className="space-y-3">
        <h2 className="text-lg font-semibold">Acessos</h2>
        <Acessos />
      </section>
      <section className="mt-7 space-y-4">
        <h2 className="text-lg font-semibold">Organização</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["ministerios", "Ministérios e cadastros"],
            ["escalas", "Escalas e eventos"],
            ["disponibilidade", "Disponibilidades"],
          ].map(([v, l]) => (
            <Button
              key={v}
              variant={area === v ? "default" : "outline"}
              className="h-auto min-h-16 whitespace-normal"
              aria-expanded={area === v}
              aria-controls="organizacao-conteudo"
              onClick={() => setArea(area === v ? null : v!)}
            >
              {l}
            </Button>
          ))}
        </div>
        <div id="organizacao-conteudo">
          <AreaEmbutida>
            {area === "ministerios" ? (
              <MinisteriosPage />
            ) : area === "escalas" ? (
              <EscalasPage />
            ) : area === "disponibilidade" ? (
              <DisponibilidadePage />
            ) : null}
          </AreaEmbutida>
        </div>
      </section>
    </AppShell>
  );
}
