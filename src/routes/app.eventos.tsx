import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarData } from "@/data/mock";
import { supabase } from "@/integrations/supabase/client";
import { hora, type EventoDb } from "@/lib/dados";
import { useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos — Libens" },
      { name: "description", content: "Cultos e eventos programados." },
      { property: "og:title", content: "Eventos — Libens" },
      { property: "og:description", content: "Cultos e eventos programados." },
    ],
  }),
  component: EventosPage,
});

interface Form {
  id?: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  description: string;
  needs: Record<string, number>;
}

function EventosPage() {
  const d = useDados();
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const abrir = (e?: EventoDb) => {
    setErro(null);
    const needs: Record<string, number> = {};
    if (e) for (const n of d.necessidades.filter((x) => x.event_id === e.id)) needs[n.ministry_id] = n.required_count;
    setForm(
      e
        ? { id: e.id, name: e.name, date: e.date, start_time: hora(e.start_time), end_time: hora(e.end_time), location: e.location ?? "", description: e.description ?? "", needs }
        : { name: "", date: "", start_time: "", end_time: "", location: "", description: "", needs },
    );
  };

  const salvar = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.date || !form.start_time) return setErro("Informe nome, data e horário de início.");
    setSalvando(true);
    setErro(null);
    const dados = {
      name: form.name.trim(), date: form.date, start_time: form.start_time,
      end_time: form.end_time || null, location: form.location || null, description: form.description || null,
    };
    const r = form.id
      ? await supabase.from("events").update(dados).eq("id", form.id).select("id").single()
      : await supabase.from("events").insert(dados).select("id").single();
    if (r.error || !r.data) {
      setSalvando(false);
      return setErro(r.error?.message ?? "Erro ao salvar");
    }
    const eventId = r.data.id;
    const linhas = Object.entries(form.needs).filter(([, n]) => n > 0).map(([ministry_id, required_count]) => ({ event_id: eventId, ministry_id, required_count }));
    const zerados = Object.entries(form.needs).filter(([, n]) => n <= 0).map(([id]) => id);
    if (linhas.length) {
      const { error } = await supabase.from("event_ministry_needs").upsert(linhas, { onConflict: "event_id,ministry_id" });
      if (error) setErro(error.message);
    }
    if (zerados.length) await supabase.from("event_ministry_needs").delete().eq("event_id", eventId).in("ministry_id", zerados);
    setSalvando(false);
    await d.recarregar();
    setForm(null);
  };

  const campo = (k: keyof Omit<Form, "needs" | "id">, rotulo: string, type = "text") =>
    form ? (
      <div className="space-y-1.5">
        <Label htmlFor={k}>{rotulo}</Label>
        <Input id={k} type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      </div>
    ) : null;

  return (
    <AppShell titulo="Eventos" descricao="Programação">
      {d.global ? (
        <Button className="mb-4 w-full sm:w-auto" onClick={() => abrir()}>
          <Plus className="h-4 w-4" /> Novo evento
        </Button>
      ) : null}
      <div className="space-y-3">
        {d.eventos.map((e) => {
          const needs = d.necessidades.filter((n) => n.event_id === e.id);
          return (
            <Card key={e.id} className={d.global ? "cursor-pointer" : ""} onClick={() => d.global && abrir(e)}>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {formatarData(e.date)} · {hora(e.start_time)}{e.end_time ? `–${hora(e.end_time)}` : ""}
                </p>
                <p className="font-semibold text-foreground">{e.name}</p>
                {e.location ? <p className="text-sm text-muted-foreground">{e.location}</p> : null}
                {needs.length ? (
                  <p className="text-xs text-muted-foreground">
                    {needs.map((n) => `${d.ministerios.find((m) => m.id === n.ministry_id)?.name}: ${n.required_count}`).join(" · ")}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {!d.carregando && d.eventos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento cadastrado.</p> : null}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-3">
              {campo("name", "Nome")}
              {campo("date", "Data", "date")}
              <div className="grid grid-cols-2 gap-3">
                {campo("start_time", "Início", "time")}
                {campo("end_time", "Término", "time")}
              </div>
              {campo("location", "Local")}
              {campo("description", "Descrição")}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Pessoas necessárias por ministério</p>
                {d.ministerios.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">{m.name}</span>
                    <Input
                      type="number" min={0} className="w-20" aria-label={`Quantidade ${m.name}`}
                      value={form.needs[m.id] ?? 0}
                      onChange={(e) => setForm({ ...form, needs: { ...form.needs, [m.id]: Math.max(0, Number(e.target.value) || 0) } })}
                    />
                  </div>
                ))}
              </div>
              {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
              <Button className="w-full" onClick={() => void salvar()} disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar evento"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
