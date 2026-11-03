import type { EscalaDb, EventoDb } from "./dados";

/** UI gates only; database policies remain authoritative. */
export function podeEditarEvento(evento: Pick<EventoDb, "created_by">, global: boolean, lidero: Set<string>, usuarioId: string) {
  return global || (lidero.size > 0 && evento.created_by === usuarioId);
}

export function podeExcluirEscala(itens: Pick<EscalaDb, "created_by" | "ministry_id">[], global: boolean, lidero: Set<string>, usuarioId: string) {
  return itens.length > 0 && (global || itens.every((s) => s.created_by === usuarioId && lidero.has(s.ministry_id)));
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function intervaloEscalas(hoje: string, mes: string, periodo: string, de: string, ate: string): [string, string] {
  const data = new Date(`${hoje}T12:00:00`);
  if (periodo === "hoje") return [hoje, hoje];
  if (periodo === "custom") return [de, ate];
  if (periodo === "semana") {
    const inicio = new Date(data); inicio.setDate(data.getDate() - ((data.getDay() + 6) % 7));
    const fim = new Date(inicio); fim.setDate(inicio.getDate() + 6);
    return [iso(inicio), iso(fim)];
  }
  const inicio = periodo === "proximo" ? new Date(data.getFullYear(), data.getMonth() + 1, 1) : new Date(`${mes}-01T12:00:00`);
  return [iso(inicio), iso(new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0))];
}

export function filtrarEscalas(itens: EscalaDb[], ministerios: Set<string>, filtro: { ministerio: string; pessoa: string; status: string; visao: string }, usuarioId: string) {
  return itens.filter((s) => ministerios.has(s.ministry_id) && (filtro.ministerio === "todos" || filtro.ministerio === s.ministry_id) && (filtro.pessoa === "todos" || filtro.pessoa === s.user_id) && (filtro.status === "todos" || filtro.status === s.status) && (filtro.visao !== "minhas" || s.user_id === usuarioId));
}

export function contarTrocasPendentes(trocas: { status: string }[]) {
  return trocas.filter((t) => t.status === "pending_substitute" || t.status === "pending_leader").length;
}