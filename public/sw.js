/* Libens: no cache of authenticated pages, tokens, API data or avatars. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>Libens — Sem conexão</title><main><h1>Você está sem conexão</h1><p>Conecte-se à internet para consultar suas escalas com segurança.</p><button onclick="location.reload()">Tentar novamente</button></main></html>',
    {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}
  )));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('/app/inicio', self.location.origin).href;
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(url); return client.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
