import test from "node:test";
import assert from "node:assert/strict";
import { contarTrocasPendentes, filtrarEscalas, intervaloEscalas, podeEditarEvento, podeExcluirEscala } from "../src/lib/escalas-visao.ts";

test("servo nunca edita eventos nem exclui escalas", () => {
  assert.equal(podeEditarEvento({ created_by: "servo" }, false, new Set(), "servo"), false);
  assert.equal(podeExcluirEscala([{ created_by: "servo", ministry_id: "louvor" }], false, new Set(), "servo"), false);
});
test("líder edita somente eventos próprios", () => {
  assert.equal(podeEditarEvento({ created_by: "outro" }, false, new Set(["louvor"]), "lider"), false);
  assert.equal(podeEditarEvento({ created_by: "lider" }, false, new Set(["louvor"]), "lider"), true);
});
test("excluir escala requer autoria em todas as linhas e liderança do ministério", () => {
  const linhas = [{ created_by: "lider", ministry_id: "louvor" }];
  assert.equal(podeExcluirEscala(linhas, false, new Set(["louvor"]), "lider"), true);
  assert.equal(podeExcluirEscala(linhas, false, new Set(["midia"]), "lider"), false);
  assert.equal(podeExcluirEscala([...linhas, { created_by: "outro", ministry_id: "louvor" }], false, new Set(["louvor"]), "lider"), false);
});
test("global gerencia evento e escala independentemente da autoria", () => {
  assert.equal(podeEditarEvento({ created_by: "outro" }, true, new Set(), "admin"), true);
  assert.equal(podeExcluirEscala([{ created_by: "outro", ministry_id: "louvor" }], true, new Set(), "pastor"), true);
  assert.equal(podeExcluirEscala([], true, new Set(), "admin"), false);
});
test("mês inclui primeira e última data, incluindo fevereiro bissexto", () => {
  assert.deepEqual(intervaloEscalas("2026-11-03", "2026-12", "mes", "", ""), ["2026-12-01", "2026-12-31"]);
  assert.deepEqual(intervaloEscalas("2026-11-03", "2028-02", "mes", "", ""), ["2028-02-01", "2028-02-29"]);
});
test("preserva hoje, semana, próximo mês e intervalo personalizado", () => {
  assert.deepEqual(intervaloEscalas("2026-11-03", "2026-11", "hoje", "", ""), ["2026-11-03", "2026-11-03"]);
  assert.deepEqual(intervaloEscalas("2026-11-03", "2026-11", "semana", "", ""), ["2026-11-02", "2026-11-08"]);
  assert.deepEqual(intervaloEscalas("2026-12-03", "2026-12", "proximo", "", ""), ["2027-01-01", "2027-01-31"]);
  assert.deepEqual(intervaloEscalas("2026-11-03", "2026-11", "custom", "2026-10-01", "2027-01-05"), ["2026-10-01", "2027-01-05"]);
});
test("filtros de ministério, pessoa, status e visão continuam combinados", () => {
  const base = { id: "a", event_id: "evento", ministry_id: "louvor", user_id: "servo", status: "scheduled", created_at: "", created_by: null, updated_by: null, updated_at: "", response: "pending" };
  const linhas = [base, { ...base, id: "b", user_id: "outro" }, { ...base, id: "c", ministry_id: "midia" }, { ...base, id: "d", status: "draft" }];
  assert.deepEqual(filtrarEscalas(linhas, new Set(["louvor"]), { ministerio: "louvor", pessoa: "servo", status: "scheduled", visao: "minhas" }, "servo").map((s) => s.id), ["a"]);
  assert.equal(filtrarEscalas(linhas, new Set(["louvor"]), { ministerio: "midia", pessoa: "todos", status: "todos", visao: "todas" }, "servo").length, 0);
});
test("contagem inclui ambas as etapas pendentes e exclui trocas encerradas", () => {
  assert.equal(contarTrocasPendentes(["pending_substitute", "pending_leader", "approved", "rejected", "cancelled"].map((status) => ({ status }))), 2);
});