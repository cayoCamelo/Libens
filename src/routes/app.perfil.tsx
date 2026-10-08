import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Camera, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatarWhatsapp, useAvatarUrl, useMeuPerfilExtra } from "@/lib/avatar";
import { rotulosPerfil } from "@/lib/dados";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";

export const Route = createFileRoute("/app/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Libens" },
      { name: "description", content: "Sua foto, seus dados, ministérios e lembretes no Libens." },
      { property: "og:title", content: "Perfil — Libens" },
      { property: "og:description", content: "Sua foto, seus dados, ministérios e lembretes no Libens." },
    ],
  }),
  component: PerfilPage,
});

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX = 2 * 1024 * 1024;

function PerfilPage() {
  const { usuario, carregando, ativo, recarregarPerfil } = useSessao();
  const d = useDados();
  const qc = useQueryClient();
  const extra = useMeuPerfilExtra(usuario.id);
  const foto = useAvatarUrl(extra.data?.avatar_url);
  const arquivo = useRef<HTMLInputElement>(null);
  const meus = d.ministerios.filter((m) => d.participo.has(m.id) || d.lidero.has(m.id));

  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [whats, setWhats] = useState("");
  const [bio, setBio] = useState("");
  const [msg, setMsg] = useState<{ erro: boolean; t: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { setNome(usuario.nome); setTel(usuario.telefone ?? ""); }, [usuario.nome, usuario.telefone]);
  useEffect(() => {
    if (extra.data) { setBio(extra.data.bio); setWhats(formatarWhatsapp(extra.data.whatsapp)); }
  }, [extra.data]);

  const atualizarExtra = () => qc.invalidateQueries({ queryKey: ["libens", "perfil-extra", usuario.id] });

  const salvar = async () => {
    setMsg(null);
    const digitos = whats.replace(/\D/g, "");
    if (digitos && (digitos.length < 10 || digitos.length > 13))
      return setMsg({ erro: true, t: "WhatsApp inválido. Use DDD + número, ex.: (85) 99999-9999." });
    if (bio.length > 300) return setMsg({ erro: true, t: "A bio pode ter no máximo 300 caracteres." });
    const { error } = await supabase.from("profiles").update({
      full_name: nome.trim(), phone: tel.trim() || null, bio: bio.trim() || null, whatsapp: digitos || null,
    }).eq("id", usuario.id);
    setMsg(error ? { erro: true, t: error.message } : { erro: false, t: "Dados salvos." });
    await Promise.all([recarregarPerfil(), atualizarExtra()]);
  };

  const enviarFoto = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    if (!TIPOS.includes(f.type)) return setMsg({ erro: true, t: "Use uma imagem JPG, PNG ou WEBP." });
    if (f.size > MAX) return setMsg({ erro: true, t: "A foto deve ter no máximo 2 MB." });
    const valida = await new Promise<boolean>((res) => {
      const img = new Image();
      img.onload = () => res(img.width > 0);
      img.onerror = () => res(false);
      img.src = URL.createObjectURL(f);
    });
    if (!valida) return setMsg({ erro: true, t: "Arquivo de imagem inválido." });
    setEnviando(true);
    const ext = f.type.split("/")[1];
    const caminho = `${usuario.id}/foto-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("avatars").upload(caminho, f, { contentType: f.type });
    if (up.error) { setEnviando(false); return setMsg({ erro: true, t: up.error.message }); }
    const antiga = extra.data?.avatar_url;
    await supabase.from("profiles").update({ avatar_url: caminho }).eq("id", usuario.id);
    if (antiga) await supabase.storage.from("avatars").remove([antiga]);
    setEnviando(false);
    await atualizarExtra();
  };

  const removerFoto = async () => {
    const antiga = extra.data?.avatar_url;
    if (!antiga) return;
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", usuario.id);
    await supabase.storage.from("avatars").remove([antiga]);
    await atualizarExtra();
  };

  const alternarLembretes = async (v: boolean) => {
    await supabase.from("profiles").update({ reminders_enabled: v }).eq("id", usuario.id);
    await atualizarExtra();
  };

  return (
    <AppShell titulo="Perfil" descricao="Seus dados no Libens">
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
            <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-primary text-3xl font-semibold text-primary-foreground">
              {foto ? <img src={foto} alt="Sua foto de perfil" className="h-full w-full object-cover" /> : usuario.nome.charAt(0).toUpperCase() || "?"}
            </div>
            <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => { void enviarFoto(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={enviando} onClick={() => arquivo.current?.click()}>
                <Camera className="h-4 w-4" /> {enviando ? "Enviando..." : extra.data?.avatar_url ? "Trocar foto" : "Enviar foto"}
              </Button>
              {extra.data?.avatar_url ? (
                <Button size="sm" variant="ghost" onClick={() => void removerFoto()}><Trash2 className="h-4 w-4" /> Remover</Button>
              ) : null}
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{carregando ? "Carregando..." : usuario.nome}</p>
              <div className="mt-1 flex justify-center gap-2">
                <Badge>{rotulosPerfil[usuario.perfil]}</Badge>
                {!ativo ? <Badge variant="secondary">Inativo</Badge> : null}
              </div>
            </div>
            {extra.data?.bio ? <p className="text-sm text-muted-foreground">{extra.data.bio}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="font-semibold text-foreground">Meus dados</p>
            <div className="space-y-1.5"><Label htmlFor="nome">Nome</Label><Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" value={usuario.email} disabled /></div>
            <div className="space-y-1.5"><Label htmlFor="tel">Telefone</Label><Input id="tel" value={tel} onChange={(e) => setTel(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="whats">WhatsApp</Label>
              <Input id="whats" inputMode="tel" placeholder="(85) 99999-9999" value={whats} onChange={(e) => setWhats(e.target.value)} onBlur={() => setWhats(formatarWhatsapp(whats))} />
              <p className="text-xs text-muted-foreground">Visível só para você, Pastor e Administrador.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Ex.: Atuo na área de mídia e transmissão da igreja." />
              <p className="text-right text-xs text-muted-foreground">{bio.length}/300</p>
            </div>
            <Button onClick={() => void salvar()}>Salvar</Button>
            {msg ? <p className={msg.erro ? "text-sm text-destructive" : "text-sm text-success"}>{msg.t}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="font-semibold text-foreground">Meus ministérios</p>
            <div className="flex flex-wrap gap-1.5">
              {meus.length === 0 ? <span className="text-sm text-muted-foreground">Nenhum ainda</span> : null}
              {meus.map((m) => <Badge key={m.id} variant="secondary">{m.name}{d.lidero.has(m.id) ? " · líder" : ""}</Badge>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="flex items-center gap-2 font-semibold text-foreground"><Bell className="h-4 w-4" /> Lembretes de escala</p>
              <p className="text-xs text-muted-foreground">Avisos 24 horas e 2 horas antes de cada escala.</p>
            </div>
            <Switch checked={extra.data?.reminders_enabled ?? true} onCheckedChange={(v) => void alternarLembretes(v)} aria-label="Receber lembretes de escala" />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
