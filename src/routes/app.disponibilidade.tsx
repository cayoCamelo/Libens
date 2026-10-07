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
import { hojeIso, useDados } from "@/lib/use-dados";
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
      {consultaveis.length > 0 ? <DisponibilidadeEquipe /> : null}
    </AppShell>
  );
}

function DisponibilidadeEquipe() {
  const d = useDados();
  const hoje = hojeIso();
  const proximos = d.eventos.filter((e) => e.date >= hoje).slice(0, 4);
  const mins = d.global ? d.ministerios : d.ministerios.filter((m) => d.lidero.has(m.id));
  const ids = [...new Set(d.membros.filter((m) => mins.some((x) => x.id === m.ministry_id)).map((m) => m.user_id))];
  const q = useQuery({
    queryKey: ["libens", "disp-equipe", ids.join(",")],
    queryFn: () => listarDisponibilidade(ids),
    enabled: ids.length > 0,
  });
  const st = (uid: string, data: string) => {
    const r = q.data?.find((x) => x.user_id === uid && x.date === data);
    return r === undefined ? "Não informado" : r.available ? "Disponível" : "Indisponível";
  };
  const curto = (iso: string) => {
    const [a, m, dd] = iso.split("-").map(Number);
    return `${new Date(a!, m! - 1, dd!).toLocaleDateString("pt-BR", { weekday: "short" })} ${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  };
  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">Disponibilidade da equipe (somente leitura)</h2>
      {proximos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento futuro.</p> : null}
      {mins.map((m) => {
        const membros = d.membros.filter((x) => x.ministry_id === m.id);
        if (membros.length === 0 || proximos.length === 0) return null;
        return (
          <Card key={m.id}>
            <CardContent className="space-y-3 p-4">
              <p className="font-semibold text-foreground">{m.name}</p>
              {membros.map((x) => (
                <div key={x.id} className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{d.nomePessoa(x.user_id)}</p>
                  {proximos.map((e) => {
                    const v = st(x.user_id, e.date);
                    return (
                      <p key={e.id} className="flex justify-between gap-2 pl-3 text-xs">
                        <span className="capitalize text-muted-foreground">{curto(e.date)} · {e.name}</span>
                        <span className={v === "Disponível" ? "text-success" : v === "Indisponível" ? "text-destructive" : "text-muted-foreground"}>{v}</span>
                      </p>
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
