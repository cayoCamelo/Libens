import test from 'node:test';
import assert from 'node:assert/strict';
import { navPorPerfil } from '../src/components/layout/nav-config.ts';
test('gestão pastoral e administrativa têm entradas distintas e acesso administrativo separado',()=>{
 assert.equal(navPorPerfil.pastor[0]?.to,'/app/inicio');
 assert.equal(navPorPerfil.admin[0]?.to,'/app/painel');
 assert.equal(navPorPerfil.admin.some(n=>n.to==='/app/admin'),true);
 for(const role of ['servo','lider','pastor'] as const)assert.equal(navPorPerfil[role].some(n=>n.to==='/app/admin'||n.to==='/app/painel'),false);
});
test('navegação compacta conserva todas as páginas sem duplicar caminhos',()=>{
 for(const items of Object.values(navPorPerfil)){
  assert.equal(new Set(items.map(i=>i.to)).size,items.length);
  assert.equal(items.some(i=>i.to==='/app/perfil'),true);
  assert.equal(items.slice(0,3).length+items.slice(3).length,items.length);
 }
});
