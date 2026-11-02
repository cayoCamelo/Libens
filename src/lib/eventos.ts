type EventoTemporal = {
  date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  active?: boolean;
};

/** Fortaleza uses UTC-03:00 without daylight saving time. */
export function eventoAindaAberto(evento: EventoTemporal, agora = new Date()) {
  if (evento.active === false || ["cancelled", "completed"].includes(evento.status)) return false;
  const inicio = Date.parse(`${evento.date}T${evento.start_time}-03:00`);
  let fim = evento.end_time
    ? Date.parse(`${evento.date}T${evento.end_time}-03:00`)
    : inicio + 2 * 60 * 60 * 1000;
  if (evento.end_time && fim <= inicio) fim += 24 * 60 * 60 * 1000;
  return Number.isFinite(fim) && fim > agora.getTime();
}

export function dataFortaleza(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}
