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
test("pastor e admin acessam ministérios e painéis, somente admin tem usuários e acessos", () => {
  for (const role of ["pastor", "admin"] as const) {
    assert(navPorPerfil[role].some((n) => n.to === "/app/ministerios"));
    assert(navPorPerfil[role].some((n) => n.to === "/app/painel"));
  }
  assert(!navPorPerfil.pastor.some((n) => n.to === "/app/admin"));
  assert(navPorPerfil.admin.some((n) => n.to === "/app/admin"));
});
test("navegação sem caminhos duplicados", () => {
  for (const items of Object.values(navPorPerfil)) {
    assert.equal(new Set(items.map((i) => i.to)).size, items.length);
    assert(items.some((i) => i.to === "/app/perfil"));
  }
});
