import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { hora, traduzirErroDb, type EventoDb } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";
import { podeEditarEvento } from "@/lib/escalas-visao";

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

export function EditorEvento({ aberto, evento, onFechar }: { aberto: boolean; evento?: EventoDb | undefined; onFechar: () => void }) {
  const d = useDados();
  const { usuario } = useSessao();
  const podeCriar = d.global || d.lidero.size > 0;
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
  useEffect(() => {
    if (aberto) abrir(evento);
    else setForm(null);
    // Initialize once per dialog opening, not on data refresh while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, evento?.id]);
  const salvar = async () => {
    if (!form || !podeCriar || (evento && !podeEditarEvento(evento, d.global, d.lidero, usuario.id))) return;
    if (!form.name.trim() || !form.date || !form.start_time) return setErro("Informe nome, data e horário de início.");
    if (form.end_time && form.end_time <= form.start_time) return setErro("O término deve ser após o início.");
    setSalvando(true);
    setErro(null);
    const dados = {
      name: form.name.trim(), date: form.date, start_time: form.start_time,
      end_time: form.end_time || null, location: form.location || null, description: form.description || null,
    };
    const r = form.id
      ? await supabase.from("events").update(dados).eq("id", form.id).select("id").single()
      : await supabase.from("events").insert({ ...dados, created_by: usuario.id }).select("id").single();
    if (r.error || !r.data) {
      setSalvando(false);
      return setErro(r.error?.message ?? "Erro ao salvar");
    }
    const eventId = r.data.id;
    const necessidadesPermitidas = Object.entries(form.needs).filter(([id]) => d.podeGerenciar(id));
    const linhas = necessidadesPermitidas.filter(([, n]) => n > 0).map(([ministry_id, required_count]) => ({ event_id: eventId, ministry_id, required_count }));
    const zerados = necessidadesPermitidas.filter(([, n]) => n <= 0).map(([id]) => id);
    if (linhas.length) {
      const { error } = await supabase.from("event_ministry_needs").upsert(linhas, { onConflict: "event_id,ministry_id" });
      if (error) { setSalvando(false); await d.recarregar(); return setErro(traduzirErroDb(error)); }
    }
    if (zerados.length) {
      const { error } = await supabase.from("event_ministry_needs").delete().eq("event_id", eventId).in("ministry_id", zerados);
      if(error) {setSalvando(false); await d.recarregar();return setErro(traduzirErroDb(error));}
    }
    setSalvando(false);
    await d.recarregar();
    onFechar();
  };

  const campo = (k: keyof Omit<Form, "needs" | "id">, rotulo: string, type = "text") =>
    form ? (
      <div className="space-y-1.5">
        <Label htmlFor={k}>{rotulo}</Label>
        <Input id={k} type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      </div>
    ) : null;

  return (
      <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && onFechar()}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="pr-7">{form?.id ? "Editar evento" : "Novo evento"}</DialogTitle>
            <DialogDescription>Data, horário e equipes do evento.</DialogDescription>
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
                <p className="text-sm font-medium text-foreground">Pessoas necessárias por ministério (opcional, 0 = livre)</p>
                {d.ministerios.filter((m)=>d.podeGerenciar(m.id)).map((m) => (
                  <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <span className="text-sm text-foreground">{m.name}</span>
                    <Input
                      type="number" min={0} max={100} className="w-20" aria-label={`Quantidade ${m.name}`}
                      value={form.needs[m.id] ?? 0}
                      onChange={(e) => setForm({ ...form, needs: { ...form.needs, [m.id]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } })}
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
  );
}
