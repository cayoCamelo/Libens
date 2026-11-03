import test from "node:test";
import assert from "node:assert/strict";
import { navPorPerfil } from "../src/components/layout/nav-config.ts";
test("servo e líder têm quatro abas sem gestão de ministérios", () => {
  for (const role of ["servo", "lider"] as const)
    assert.deepEqual(
      navPorPerfil[role].map((n) => n.to),
      ["/app/inicio", "/app/escalas", "/app/disponibilidade", "/app/perfil"],
    );
});
test("admin tem seis destinos na ordem aprovada e pastor usa página única", () => {
  assert.deepEqual(
    navPorPerfil.admin.map((n) => n.rotulo),
    ["Painel principal", "Escalas", "Disponibilidade", "Ministérios", "Acessos", "Perfil"],
  );
  assert.deepEqual(
    navPorPerfil.pastor.map((n) => n.to),
    ["/app/painel", "/app/perfil"],
  );
  for (const role of ["pastor", "admin"] as const)
    assert(!navPorPerfil[role].some((n) => n.to === "/app/inicio" || n.to === "/app/servos"));
});
test("navegação sem caminhos duplicados", () => {
  for (const items of Object.values(navPorPerfil)) {
    assert.equal(new Set(items.map((i) => i.to)).size, items.length);
    assert(items.some((i) => i.to === "/app/perfil"));
  }
});
