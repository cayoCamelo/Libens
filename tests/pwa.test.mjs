import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const code = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker(fetch = globalThis.fetch) {
 const handlers = {};
 const self = { location: {origin:'https://libens.example'}, clients: {claim:async()=>{},matchAll:async()=>[],openWindow:async()=>{}}, skipWaiting:()=>{} , addEventListener:(name,fn)=>handlers[name]=fn };
 runInNewContext(code,{self,URL,Response,fetch});return {handlers,self};
}
test('offline navigation explains connection requirement without caching private requests',async()=>{
 const {handlers}=worker(async()=>{throw new Error('offline')});
 let response;
 handlers.fetch({request:{mode:'navigate'},respondWith:r=>response=r});
 const r=await response;assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(await r.text(),/sem conexão/);
 let intercepted=false;
 handlers.fetch({request:{mode:'cors'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
test('notification click ignores external payload URLs and opens authenticated app entry',async()=>{
 const {handlers,self}=worker();let url;let pending;let closed=false;
 self.clients.openWindow=async v=>url=v;
 handlers.notificationclick({notification:{data:{url:'https://evil.example'},close:()=>closed=true},waitUntil:p=>pending=p});
 await pending;assert.equal(closed,true);assert.equal(url,'https://libens.example/app/inicio');
});
test('install manifest references correctly sized PNG icons and stays in application origin',async()=>{
 const m=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(m.display,'standalone');assert.equal(m.scope,'/');assert.equal(m.start_url,'/app/inicio');
 for(const n of [192,512]){
  const icon=m.icons.find(i=>i.sizes===`${n}x${n}`);assert.ok(icon);
  const bytes=await readFile(new URL('../public'+icon.src,import.meta.url));assert.equal(bytes.readUInt32BE(16),n);assert.equal(bytes.readUInt32BE(20),n);
 }
});
