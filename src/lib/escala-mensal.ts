import { horariosConflitam } from "./gerador-escala.ts";

export interface MembroMensal { id: string; name: string; month_count: number; previous_count: number; last_date: string | null }
export interface EventoMensal {
  id: string; name: string; date: string; start_time: string; end_time: string | null; required_count: number;
  existing: { id: string; user_id: string; name: string; status: string; available: boolean | null }[];
  candidates: { user_id: string; available: boolean | null; conflict: boolean }[];
}
export interface ContextoMensal { month: string; people: MembroMensal[]; events: EventoMensal[] }
export interface VagaMensal { userId: string; name: string; kind: "existing" | "auto" | "manual"; confirmed: boolean; scheduleId?: string; status?: string; available?: boolean | null }
export interface LinhaMensal { event: EventoMensal; required: number; slots: VagaMensal[] }

export function conflitoMensal(plano: LinhaMensal[], evento: EventoMensal, userId: string, ignorar?: VagaMensal) {
  if (evento.candidates.find((c) => c.user_id === userId)?.conflict !== false) return true;
  return plano.some((linha) => horariosConflitam(linha.event, evento) &&
    linha.slots.some((vaga) => vaga !== ignorar && vaga.userId === userId));
}

/** Sugestão pura: o banco fornece elegibilidade e revalida na gravação. */
export function gerarMes(contexto: ContextoMensal, padrao: number): LinhaMensal[] {
  if (!Number.isInteger(padrao) || padrao < 1 || padrao > 100) throw new Error("Quantidade inválida.");
  const cargas = new Map(contexto.people.map((p) => [p.id, p.month_count]));
  const plano: LinhaMensal[] = [];
  const eventos = [...contexto.events].sort((a,b) => `${a.date}${a.start_time}${a.id}`.localeCompare(`${b.date}${b.start_time}${b.id}`));
  for (const evento of eventos) {
    const linha: LinhaMensal = { event: evento, required: Math.max(evento.required_count || padrao, evento.existing.length),
      slots: evento.existing.map((s) => ({ userId:s.user_id,name:s.name,kind:"existing",confirmed:false,
        scheduleId:s.id,status:s.status,available:s.available })) };
    plano.push(linha);
    while (linha.slots.length < linha.required) {
      const candidatos = contexto.people.filter((p) => evento.candidates.some((c) => c.user_id===p.id && c.available===true) &&
        !conflitoMensal(plano,evento,p.id)).sort((a,b) =>
          (cargas.get(a.id)??0)-(cargas.get(b.id)??0) || a.previous_count-b.previous_count ||
          (a.last_date??"").localeCompare(b.last_date??"") || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      const pessoa = candidatos[0];
      linha.slots.push({ userId:pessoa?.id??"",name:pessoa?.name??"",kind:pessoa?"auto":"manual",confirmed:false });
      if (pessoa) cargas.set(pessoa.id,(cargas.get(pessoa.id)??0)+1);
    }
  }
  return plano;
}

export function precisaConfirmar(linha: LinhaMensal, vaga: VagaMensal) {
  if (!vaga.userId || (vaga.kind==="existing" && vaga.status!=="draft")) return false;
  return (vaga.kind==="existing" ? vaga.available : linha.event.candidates.find((c)=>c.user_id===vaga.userId)?.available)!==true;
}

export function resumoMensal(plano: LinhaMensal[]) {
  return plano.reduce((r,linha) => {
    for (const vaga of linha.slots) {
      if (!vaga.userId) r.pendentes++;
      else if (vaga.kind==="existing") r.preservadas++;
      else if (vaga.kind==="auto") r.sugeridas++;
      else r.manuais++;
      if (precisaConfirmar(linha,vaga) && !vaga.confirmed) r.semConfirmacao++;
    }
    return r;
  },{pendentes:0,preservadas:0,sugeridas:0,manuais:0,semConfirmacao:0});
}

export function payloadMensal(plano: LinhaMensal[]) {
  return plano.map((linha) => ({event_id:linha.event.id,required_count:linha.required,
    existing_ids:linha.slots.filter((s)=>s.kind==="existing").map((s)=>s.scheduleId!),
    selections:linha.slots.filter((s)=>s.kind!=="existing" && s.userId).map((s)=>({user_id:s.userId,manual_confirmed:s.confirmed})),
    confirmed_existing:linha.slots.filter((s)=>s.kind==="existing" && s.confirmed).map((s)=>s.userId),
  }));
}
