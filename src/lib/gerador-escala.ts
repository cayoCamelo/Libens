/**
 * Geração automática de escala (sugestão). Função pura: não grava nada.
 * Regras: ativos, membros do ministério, disponíveis na data, sem conflito de horário,
 * não escalados no mesmo evento; ordena por menos escalas no mês, menos no histórico
 * e última escala mais antiga.
 */
import type { EscalaDb, EventoDb, PessoaDb } from "@/lib/dados";

export interface Candidato {
  pessoa: PessoaDb;
  noMes: number;
  anteriores: number;
  ultimaData: string | null;
  diasDesdeUltima: number | null;
}

export interface ResultadoGeracao {
  sugeridos: Candidato[];
  elegiveis: Candidato[];
  necessarios: number;
  faltam: number;
}

const contaHistorico = (s: EscalaDb) => ["scheduled", "confirmed", "completed"].includes(s.status);

function intervalo(evento: Pick<EventoDb, "date" | "start_time" | "end_time">) {
  const inicio = Date.parse(`${evento.date}T${evento.start_time}-03:00`);
  let fim = evento.end_time
    ? Date.parse(`${evento.date}T${evento.end_time}-03:00`)
    : inicio + 2 * 60 * 60 * 1000;
  // Um término anterior ao início pertence ao dia seguinte.
  if (evento.end_time && fim <= inicio) fim += 24 * 60 * 60 * 1000;
  return { inicio, fim };
}

export function horariosConflitam(a: Pick<EventoDb, "date" | "start_time" | "end_time">, b: Pick<EventoDb, "date" | "start_time" | "end_time">) {
  const ai = intervalo(a);
  const bi = intervalo(b);
  return ai.inicio < bi.fim && bi.inicio < ai.fim;
}

function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function gerarEscala(params: {
  evento: EventoDb;
  ministryId: string;
  necessarios: number;
  membros: PessoaDb[];
  disponiveisNaData: Set<string>;
  escalas: EscalaDb[];
  eventos: EventoDb[];
}): ResultadoGeracao {
  const { evento, ministryId, necessarios, membros, disponiveisNaData, escalas, eventos } = params;
  const porId = new Map(eventos.map((e) => [e.id, e]));
  const mes = evento.date.slice(0, 7);
  const ativas = escalas.filter((s) => !["cancelled", "replaced"].includes(s.status));

  const elegiveis: Candidato[] = [];
  for (const pessoa of membros) {
    if (!pessoa.active) continue;
    if (!disponiveisNaData.has(pessoa.id)) continue;
    const dela = ativas.filter((s) => s.user_id === pessoa.id);
    // Já escalada neste evento (qualquer ministério) ou em evento com horário conflitante
    const conflito = dela.some((s) => {
      if (s.event_id === evento.id) return s.ministry_id !== ministryId || s.status !== "draft";
      const outro = porId.get(s.event_id);
      return outro && outro.active && !["cancelled", "completed"].includes(outro.status)
        ? horariosConflitam(evento, outro) : false;
    });
    if (conflito) continue;

    const historico = dela
      .filter(contaHistorico)
      .map((s) => porId.get(s.event_id))
      .filter((e): e is EventoDb => !!e && e.date < evento.date);
    const noMes = historico.filter((e) => e.date.slice(0, 7) === mes).length;
    const anteriores = historico.filter((e) => e.date.slice(0, 7) < mes).length;
    const ultimaData = historico.map((e) => e.date).sort().at(-1) ?? null;
    elegiveis.push({
      pessoa,
      noMes,
      anteriores,
      ultimaData,
      diasDesdeUltima: ultimaData ? diasEntre(ultimaData, evento.date) : null,
    });
  }

  elegiveis.sort(
    (a, b) =>
      a.noMes - b.noMes ||
      a.anteriores - b.anteriores ||
      (a.ultimaData ?? "").localeCompare(b.ultimaData ?? "") ||
      a.pessoa.full_name.localeCompare(b.pessoa.full_name),
  );

  const sugeridos = elegiveis.slice(0, necessarios);
  return { sugeridos, elegiveis, necessarios, faltam: Math.max(0, necessarios - sugeridos.length) };
}
