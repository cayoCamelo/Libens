import test from "node:test";
import assert from "node:assert/strict";
import { gerarEscala, horariosConflitam } from "../src/lib/gerador-escala.ts";

const evento = (id: string, date: string, start_time: string, end_time: string | null) => ({
  id, date, start_time, end_time, name: id, active: true, status: "scheduled",
  description: null, location: null, created_by: null,
});
const madrugada = evento("madrugada", "2099-11-06", "00:30:00", "02:00:00");
const noite = evento("noite", "2099-11-05", "23:00:00", "01:00:00");
const pessoa = { id: "pessoa", full_name: "Pessoa", email: "pessoa@example.invalid", phone: null,
  role: "servo" as const, active: true, created_at: "2099-01-01" };
const escala = { id: "escala", event_id: noite.id, ministry_id: "ministerio", user_id: pessoa.id,
  status: "scheduled", created_by: null, updated_by: null, created_at: "2099-01-01",
  updated_at: "2099-01-01", response: "pending" };

test("detecta conflito entre datas diferentes ao atravessar meia-noite", () => {
  assert.equal(horariosConflitam(noite, madrugada), true);
  assert.equal(horariosConflitam(madrugada, noite), true);
});
test("término padrão de duas horas também atravessa meia-noite", () => {
  assert.equal(horariosConflitam({ ...noite, end_time: null }, madrugada), true);
});
test("horários encostados não conflitam", () => {
  assert.equal(horariosConflitam(noite, { ...madrugada, start_time: "01:00:00" }), false);
});
test("preserva detecção normal e separação de dias sem sobreposição", () => {
  assert.equal(horariosConflitam(evento("a","2099-11-05","19:00","21:00"),evento("b","2099-11-05","20:00","22:00")),true);
  assert.equal(horariosConflitam(noite,{ ...madrugada, date: "2099-11-07" }),false);
});
test("gerador não sugere pessoa ocupada na noite anterior", () => {
  const r=gerarEscala({ evento: madrugada, ministryId: "ministerio", necessarios: 1,
    membros: [pessoa], disponiveisNaData: new Set([pessoa.id]), escalas: [escala], eventos: [noite,madrugada] });
  assert.equal(r.sugeridos.length,0); assert.equal(r.faltam,1);
});
test("evento cancelado, concluído ou inativo não ocupa pessoa", () => {
  for (const alteracao of [{status:"cancelled"},{status:"completed"},{active:false}]) {
    const r=gerarEscala({ evento: madrugada, ministryId: "ministerio", necessarios: 1,
      membros:[pessoa],disponiveisNaData:new Set([pessoa.id]),escalas:[escala],eventos:[{...noite,...alteracao},madrugada] });
    assert.equal(r.sugeridos.length,1);
  }
});
test("mantém exclusão de membros inativos ou sem disponibilidade", () => {
  for (const params of [{membros:[{...pessoa,active:false}],disponiveisNaData:new Set([pessoa.id])},
    {membros:[pessoa],disponiveisNaData:new Set<string>()}]) {
    const r=gerarEscala({evento:madrugada,ministryId:"ministerio",necessarios:1,escalas:[],eventos:[madrugada],...params});
    assert.equal(r.sugeridos.length,0);
  }
});
