import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { listarDisponibilidade } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/disponibilidade")({
  head: () => ({
    meta: [
      { title: "Disponibilidade — Libens" },
      { name: "description", content: "Informe os dias em que você pode servir." },
      { property: "og:title", content: "Disponibilidade — Libens" },
      { property: "og:description", content: "Informe os dias em que você pode servir." },
    ],
  }),
  component: DisponibilidadePage,
});

const semana = ["D", "S", "T", "Q", "Q", "S", "S"];
const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function DisponibilidadePage() {
  const { usuario } = useSessao();
  const d = useDados();
  const qc = useQueryClient();
  const hoje = new Date();
  const [mes, setMes] = useState({ a: hoje.getFullYear(), m: hoje.getMonth() });
  const [alvo, setAlvo] = useState<string>("");
  const pessoaId = alvo || usuario.id;
  const minha = pessoaId === usuario.id;

  // Pessoas cuja disponibilidade posso consultar
  const consultaveis = d.global
    ? d.pessoas
    : d.pessoas.filter((p) => p.role !== "admin" && d.membros.some((m) => m.user_id === p.id && d.lidero.has(m.ministry_id)));

  const q = useQuery({
    queryKey: ["libens", "disp", pessoaId],
    queryFn: () => listarDisponibilidade([pessoaId]),
    enabled: !!pessoaId,
  });
  const mapa = new Map((q.data ?? []).map((x) => [x.date, x.available]));

  const alternar = async (data: string) => {
    if (!minha) return;
    const atual = mapa.get(data);
    // Não informado -> Disponível -> Indisponível -> Não informado
    const { error } =
      atual === undefined
        ? await supabase.from("availability").upsert({ user_id: usuario.id, date: data, available: true }, { onConflict: "user_id,date" })
        : atual
          ? await supabase.from("availability").update({ available: false }).eq("user_id", usuario.id).eq("date", data)
          : await supabase.from("availability").delete().eq("user_id", usuario.id).eq("date", data);
    if (error) alert(error.message);
    await qc.invalidateQueries({ queryKey: ["libens", "disp", pessoaId] });
  };

  const primeiro = new Date(mes.a, mes.m, 1).getDay();
  const dias = new Date(mes.a, mes.m + 1, 0).getDate();
  const titulo = new Date(mes.a, mes.m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const mover = (n: number) => setMes(({ a, m }) => { const x = new Date(a, m + n, 1); return { a: x.getFullYear(), m: x.getMonth() }; });

  return (
    <AppShell titulo="Disponibilidade" descricao={minha ? "Toque no dia para alterar" : "Somente leitura"}>
      {consultaveis.length > 0 ? (
        <Select value={pessoaId} onValueChange={setAlvo}>
          <SelectTrigger className="mb-4" aria-label="Pessoa"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={usuario.id}>Minha disponibilidade</SelectItem>
            {consultaveis.filter((p) => p.id !== usuario.id).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => mover(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <p className="font-semibold capitalize text-foreground">{titulo}</p>
            <Button variant="ghost" size="icon" onClick={() => mover(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {semana.map((s, i) => <span key={i} className="text-xs font-medium text-muted-foreground">{s}</span>)}
            {Array.from({ length: primeiro }).map((_, i) => <span key={`v${i}`} />)}
            {Array.from({ length: dias }).map((_, i) => {
              const data = iso(mes.a, mes.m, i + 1);
              const v = mapa.get(data);
              return (
                <button
                  key={data}
                  type="button"
                  disabled={!minha}
                  onClick={() => void alternar(data)}
                  aria-label={`${i + 1}: ${v === undefined ? "não informado" : v ? "disponível" : "indisponível"}`}
                  className={cn(
                    "aspect-square rounded-lg border text-sm font-medium transition-colors",
                    v === true && "border-success bg-success text-success-foreground",
                    v === false && "border-destructive bg-destructive text-destructive-foreground",
                    v === undefined && "border-border text-foreground hover:bg-secondary",
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-success" /> Disponível</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-destructive" /> Indisponível</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-border" /> Não informado</span>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
