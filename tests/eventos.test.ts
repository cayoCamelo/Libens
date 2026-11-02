import test from "node:test";
import assert from "node:assert/strict";
import { dataFortaleza, eventoAindaAberto } from "../src/lib/eventos.ts";

const evento = { date: "2026-11-05", start_time: "19:30:00", end_time: "21:00:00", status: "scheduled" };
test("exclui evento encerrado mesmo antes da atualização do cron", () => {
  assert.equal(eventoAindaAberto(evento, new Date("2026-11-06T00:00:00Z")), false);
  assert.equal(eventoAindaAberto(evento, new Date("2026-11-05T23:59:59Z")), true);
});
test("exclui cancelados, concluídos e inativos", () => {
  const agora = new Date("2026-11-05T15:00:00Z");
  for (const status of ["completed", "cancelled"]) assert.equal(eventoAindaAberto({ ...evento, status }, agora), false);
  assert.equal(eventoAindaAberto({ ...evento, active: false }, agora), false);
});
test("usa duas horas quando não há término e aceita término após meia-noite", () => {
  assert.equal(eventoAindaAberto({ ...evento, end_time: null }, new Date("2026-11-06T00:29:00Z")), true);
  assert.equal(eventoAindaAberto({ ...evento, end_time: "01:00:00" }, new Date("2026-11-06T03:30:00Z")), true);
});
test("data local independe do fuso do dispositivo", () => {
  assert.equal(dataFortaleza(new Date("2026-11-06T01:00:00Z")), "2026-11-05");
});
