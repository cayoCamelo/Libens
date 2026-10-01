import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarData } from "@/data/mock";
import { supabase } from "@/integrations/supabase/client";
import { hora, listarDisponibilidade } from "@/lib/dados";
import { gerarEscala, type Candidato } from "@/lib/gerador-escala";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";

export function EditorEscala({
  aberto,
  onFechar,
  inicial,
}: {
  aberto: boolean;
  onFechar: () => void;
  inicial?: { eventId: string; ministryId: string } | undefined;
}) {
  const { usuario } = useSessao();
  const d = useDados();
  const [eventId, setEventId] = useState("");
  const [ministryId, setMinistryId] = useState("");
  const [qtd, setQtd] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [indic, setIndic] = useState<Map<string, Candidato> | null>(null);
  const [aviso, setAviso] = useState<{ nec: number; disp: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const ministeriosPermitidos = d.ministerios.filter((m) => d.podeGerenciar(m.id));
  const evento = d.eventos.find((e) => e.id === eventId);
  const existentes = useMemo(
    () => d.escalas.filter((s) => s.event_id === eventId && s.ministry_id === ministryId),
    [d.escalas, eventId, ministryId],
  );
  const membros = useMemo(() => {
    const ids = new Set(d.membros.filter((m) => m.ministry_id === ministryId).map((m) => m.user_id));
    return d.pessoas.filter((p) => ids.has(p.id));
  }, [d.membros, d.pessoas, ministryId]);

  const disp = useQuery({
    queryKey: ["libens", "disp-membros", ministryId, membros.map((m) => m.id).join(",")],
    queryFn: () => listarDisponibilidade(membros.map((m) => m.id)),
    enabled: aberto && membros.length > 0,
  });

  // Reinicia ao abrir
  useEffect(() => {
    if (!aberto) return;
    setEventId(inicial?.eventId ?? "");
    setMinistryId(inicial?.ministryId ?? "");
    setIndic(null);
    setAviso(null);
    setErro(null);
  }, [aberto, inicial?.eventId, inicial?.ministryId]);

  // Carrega a escala existente e a quantidade necessária
  useEffect(() => {
    setSel(new Set(existentes.map((s) => s.user_id)));
    const n = d.necessidades.find((x) => x.event_id === eventId && x.ministry_id === ministryId);
    setQtd(n?.required_count ?? Math.max(1, existentes.length));
    setIndic(null);
    setAviso(null);
  }, [eventId, ministryId, existentes, d.necessidades]);

  const statusDisp = (uid: string) => {
    const r = disp.data?.find((x) => x.user_id === uid && x.date === evento?.date);
    return r === undefined ? "Não informado" : r.available ? "Disponível" : "Indisponível";
  };

  const gerar = () => {
    if (!evento) return;
    const disponiveis = new Set(
      (disp.data ?? []).filter((x) => x.date === evento.date && x.available).map((x) => x.user_id),
    );
    const r = gerarEscala({
      evento, ministryId, necessarios: qtd, membros, disponiveisNaData: disponiveis,
      escalas: d.escalas.filter((s) => !(s.event_id === evento.id && s.ministry_id === ministryId && s.status === "draft")),
      eventos: d.eventos,
    });
    setIndic(new Map(r.elegiveis.map((c) => [c.pessoa.id, c])));
    setSel(new Set(r.sugeridos.map((c) => c.pessoa.id)));
    setAviso(r.faltam > 0 ? { nec: qtd, disp: r.sugeridos.length } : null);
  };

  const salvar = async (publicar: boolean) => {
    if (!evento || !ministryId) return;
    setSalvando(true);
    setErro(null);
    try {
      const atuais = new Set(existentes.map((s) => s.user_id));
      for (const s of existentes.filter((s) => !sel.has(s.user_id))) {
        const r = s.status === "draft"
          ? await supabase.from("schedules").delete().eq("id", s.id)
          : await supabase.from("schedules").update({ status: "cancelled" }).eq("id", s.id);
        if (r.error) throw r.error;
      }
      const novos = [...sel].filter((u) => !atuais.has(u)).map((user_id) => ({
        event_id: evento.id, ministry_id: ministryId, user_id,
        status: publicar ? "scheduled" : "draft", created_by: usuario.id,
      }));
      if (novos.length) {
        const r = await supabase.from("schedules").insert(novos);
        if (r.error) throw r.error;
      }
      if (publicar) {
        const r = await supabase.from("schedules").update({ status: "scheduled" })
          .eq("event_id", evento.id).eq("ministry_id", ministryId).eq("status", "draft");
        if (r.error) throw r.error;
      }
      const r = await supabase.from("event_ministry_needs").upsert(
        { event_id: evento.id, ministry_id: ministryId, required_count: qtd },
        { onConflict: "event_id,ministry_id" },
      );
      if (r.error) throw r.error;
      await d.recarregar();
      onFechar();
    } catch (e) {
      setErro((e as { message?: string }).message ?? "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existentes.length ? "Editar escala" : "Criar escala"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Evento</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger aria-label="Evento"><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
              <SelectContent>
                {d.eventos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name} · {e.date.split("-").reverse().join("/")} {hora(e.start_time)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ministério</Label>
            <Select value={ministryId} onValueChange={setMinistryId}>
              <SelectTrigger aria-label="Ministério"><SelectValue placeholder="Selecione o ministério" /></SelectTrigger>
              <SelectContent>
                {ministeriosPermitidos.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {evento && ministryId ? (
            <>
              <p className="text-sm text-muted-foreground">
                {formatarData(evento.date)} · {hora(evento.start_time)}{evento.end_time ? `–${hora(evento.end_time)}` : ""}
              </p>
              <div className="flex items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qtd">Pessoas necessárias</Label>
                  <Input id="qtd" type="number" min={1} className="w-24" value={qtd}
                    onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))} />
                </div>
                <Button variant="secondary" className="flex-1" onClick={gerar} disabled={disp.isLoading}>
                  <Sparkles className="h-4 w-4" /> Gerar escala automaticamente
                </Button>
              </div>

              {aviso ? (
                <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Atenção</p>
                  <p className="text-foreground">São necessárias {aviso.nec} pessoas. Somente {aviso.disp} {aviso.disp === 1 ? "pessoa está disponível" : "pessoas estão disponíveis"}.</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setAviso(null)}>Continuar mesmo assim</Button>
                    <Button size="sm" variant="outline" onClick={() => { setAviso(null); setIndic(null); }}>Voltar e editar</Button>
                  </div>
                </div>
              ) : null}

              {indic ? <p className="text-sm font-semibold text-foreground">Escala sugerida — revise antes de publicar</p> : null}

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Servos ({sel.size}/{qtd})</p>
                {membros.length === 0 ? <p className="text-sm text-muted-foreground">Este ministério ainda não tem membros.</p> : null}
                {membros.map((p) => {
                  const c = indic?.get(p.id);
                  const st = statusDisp(p.id);
                  return (
                    <label key={p.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <Checkbox
                        checked={sel.has(p.id)}
                        onCheckedChange={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(p.id); else n.delete(p.id); return n; })}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium text-foreground">{p.full_name || p.email}{!p.active ? " (inativo)" : ""}</p>
                        <p className={st === "Disponível" ? "text-success" : st === "Indisponível" ? "text-destructive" : "text-muted-foreground"}>{st}</p>
                        {c ? (
                          <p className="text-xs text-muted-foreground">
                            {c.noMes} {c.noMes === 1 ? "escala" : "escalas"} no mês · {c.diasDesdeUltima === null ? "nunca escalado" : `última escala há ${c.diasDesdeUltima} dias`}
                          </p>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>

              {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
              <div className="grid gap-2 sm:grid-cols-3">
                <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
                <Button variant="outline" onClick={() => void salvar(false)} disabled={salvando}>Salvar rascunho</Button>
                <Button onClick={() => void salvar(true)} disabled={salvando}>Publicar</Button>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
