import test from "node:test";
import assert from "node:assert/strict";
import { validarTamanhoFonte, tamanhosFonte, chaveFonte } from "../src/lib/acessibilidade.ts";
test("preferência inválida nunca altera a escala de texto e é isolada por conta", () => {
  for (const v of [null, "", "999", "__proto__", "constructor"])
    assert.equal(validarTamanhoFonte(v), "padrao");
  assert.equal(validarTamanhoFonte("grande"), "grande");
  assert.equal(validarTamanhoFonte("muitoGrande"), "muitoGrande");
  assert.deepEqual(Object.values(tamanhosFonte), [100, 125, 150]);
  assert.notEqual(chaveFonte("a"), chaveFonte("b"));
});
