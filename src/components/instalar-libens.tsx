import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Bell, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSessao } from "@/lib/perfil-context";
import { useNotificacoes } from "@/components/sino-notificacoes";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const Context = createContext<{ prompt: InstallEvent | null; installed: boolean; clear: () => void }>({ prompt: null, installed: false, clear: () => {} });
export function InstalacaoProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(media.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    update();
    const capture = (e: Event) => { e.preventDefault(); setPrompt(e as InstallEvent); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', done);
    media.addEventListener('change', update);
    if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', done); media.removeEventListener('change', update); };
  }, []);
  return <Context.Provider value={{ prompt, installed, clear: () => setPrompt(null) }}>{children}</Context.Provider>;
}
const preference = (id: string) => `libens-avisos-aberto:${id}`;
export async function fecharAvisos() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const list = await registration?.getNotifications();
  list?.filter((n) => n.tag.startsWith('libens-')).forEach((n) => n.close());
}
async function mostrarAviso(tag: string, title = 'Aviso de teste — Libens', body = 'Os avisos deste aparelho estão funcionando com o Libens aberto.') {
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration?.active) throw new Error('A instalação está sendo preparada. Aguarde e tente novamente.');
  await registration.showNotification(title, { body, icon: '/libens-192.png', tag: `libens-${tag}` });
}
export function InstalarLibens() {
  const { usuario } = useSessao();
  const { prompt, installed, clear } = useContext(Context);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setSupported(window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator);
    setEnabled(localStorage.getItem(preference(usuario.id)) === '1' && 'Notification' in window && Notification.permission === 'granted');
  }, [usuario.id]);
  const instalar = async () => {
    if (!prompt) { setMsg('Android: abra este endereço no Chrome, toque em ⋮ e em Instalar aplicativo ou Adicionar à tela inicial. iPhone: abra no Safari, toque em Compartilhar e Adicionar à Tela de Início.'); return; }
    setBusy(true);
    try { await prompt.prompt(); const choice = await prompt.userChoice; setMsg(choice.outcome === 'accepted' ? 'Instalação solicitada ao celular.' : 'Você pode instalar depois pelo menu do navegador.'); clear(); }
    catch { setMsg('Use o menu do navegador para instalar o Libens.'); }
    finally { setBusy(false); }
  };
  const ativar = async () => {
    // Permission request stays directly in a user gesture (including iOS Home Screen).
    const result = await Notification.requestPermission();
    if (result !== 'granted') { setMsg('Permissão não concedida. Se foi bloqueada, libere as notificações nas configurações do navegador/celular. No iPhone, instale e abra pelo ícone primeiro.'); return; }
    try { await mostrarAviso('teste'); localStorage.setItem(preference(usuario.id), '1'); setEnabled(true); window.dispatchEvent(new Event('libens-avisos')); setMsg('Avisos com o Libens aberto ativados. O envio com o app fechado ainda não está disponível.'); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível mostrar o aviso.'); }
  };
  const desativar = () => { localStorage.removeItem(preference(usuario.id)); setEnabled(false); window.dispatchEvent(new Event('libens-avisos')); void fecharAvisos(); setMsg('Avisos desativados neste aparelho para sua conta.'); };
  return <Card><CardContent className="space-y-3 p-5">
    <h2 className="font-semibold">Libens no celular</h2>
    <p className="text-sm text-muted-foreground">Instale para abrir pelo ícone do Libens na tela inicial. É necessário estar conectado à internet.</p>
    <Button className="min-h-11 w-full sm:w-auto" disabled={busy || installed} onClick={() => void instalar()}><Download className="h-4 w-4" />{installed ? 'Libens instalado' : 'Instalar Libens'}</Button>
    <p className="text-sm text-muted-foreground">Avisos do celular: funcionam enquanto o Libens estiver aberto e em execução. Com o aplicativo fechado, o envio Web Push ainda não está disponível. A instalação não ativa permissões automaticamente. Os avisos exibem data, horário, evento e ministério na tela do celular.</p>
    <div className="flex flex-wrap gap-2">
      {enabled ? <><Button variant="outline" onClick={() => void mostrarAviso('teste').catch(() => setMsg('Não foi possível exibir o teste. Verifique a permissão nas configurações do celular.'))}>Testar aviso</Button><Button variant="ghost" onClick={desativar}>Desativar neste aparelho</Button></> : <Button variant="outline" disabled={!supported} onClick={() => void ativar().catch(() => setMsg('Não foi possível ativar os avisos. Abra no navegador do celular e tente novamente.'))}><Bell className="h-4 w-4" />Ativar avisos com o app aberto</Button>}
    </div>
    {!supported ? <p className="text-sm text-muted-foreground">Se este navegador não permitir avisos, abra no Chrome do Android ou instale pela opção do Safari no iPhone.</p> : null}
    <p role="status" className="text-sm text-muted-foreground">{msg}</p>
  </CardContent></Card>;
}
export function AvisosNoAparelho() {
  const { usuario } = useSessao();
  const [enabled, setEnabled] = useState(false);
  const q = useNotificacoes(enabled ? 60 * 1000 : 5 * 60 * 1000);
  const [since] = useState(() => Date.now());
  const [seen] = useState(() => new Set<string>());
  useEffect(() => {
    const update = () => setEnabled(localStorage.getItem(preference(usuario.id)) === '1');
    update(); window.addEventListener('libens-avisos', update);
    return () => { window.removeEventListener('libens-avisos', update); void fecharAvisos(); };
  }, [usuario.id]);
  useEffect(() => {
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    for (const n of q.data ?? []) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      if (!n.read_at && Date.parse(n.created_at) > since) void mostrarAviso(n.id, `Libens · ${n.title}`, n.body ?? 'Abra o Libens para consultar os detalhes.').catch(() => {});
    }
  }, [q.data, enabled, seen, since]);
  return null;
}
