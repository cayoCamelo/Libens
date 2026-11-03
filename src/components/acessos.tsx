import { useId, useState } from "react";
import { Lock } from "lucide-react";
import { ExcluirServo } from "@/components/excluir-servo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { rotulosPerfil, traduzirErroDb } from "@/lib/dados";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/perfil-context";
import { useDados } from "@/lib/use-dados";
import type { Perfil } from "@/types/libens";

export function Acessos() {
  const { perfil, usuario, recarregarPerfil } = useSessao();
  const d = useDados();
  const fieldId = useId();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("todos");
  const [id, setId] = useState<string | null>(null),
    [role, setRole] = useState<Perfil>("servo"),
    [active, setActive] = useState(true),
    [leaders, setLeaders] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selected = d.pessoas.find((p) => p.id === id);
  const protegido =
    selected?.role === "admin" ||
    selected?.id === usuario.id ||
    (perfil === "pastor" && selected?.role === "pastor");
  const list = d.pessoas.filter(
    (p) =>
      (p.full_name + " " + p.email)
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()) &&
      (filter === "todos" || (filter === "ativos" ? p.active : !p.active)),
  );
  if (!d.global) return <p>Acesso exclusivo de Pastor(a) e Admin.</p>;
  async function save() {
    if (!selected || protegido || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("set_member_access", {
        _uid: selected.id,
        _role: role,
        _leaders: role === "lider" ? leaders : [],
        _active: active,
      });
      if (r.error) throw r.error;
      await Promise.all([d.recarregar(), recarregarPerfil()]);
      setId(null);
    } catch (e) {
      setError(traduzirErroDb(e as { message: string; code?: string }) ?? "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label="Gestão de acessos">
      <p className="text-sm text-muted-foreground">
        {perfil === "admin"
          ? "Defina Líderes, seus ministérios e Pastor(a)."
          : "Defina Líderes e seus ministérios. O perfil de Pastor(a) é definido somente pelo Admin."}
      </p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          aria-label="Buscar usuário em Acessos"
          placeholder="Nome ou e-mail"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-11 min-w-0"
        />
        <select
          aria-label="Situação da conta"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="min-h-11 rounded-md border border-border bg-background p-2 text-sm"
        >
          <option value="todos">Todas as contas</option>
          <option value="ativos">Ativas</option>
          <option value="inativos">Inativas</option>
        </select>
      </div>
      {d.erro ? (
        <p role="alert" className="text-sm text-destructive">
          {d.erro.message}
        </p>
      ) : null}
      {d.carregando ? <p role="status">Carregando contas...</p> : null}
      <div className="divide-y divide-border border-y border-border">
        {list.map((p) => (
          <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{p.full_name || p.email}</p>
              <p className="break-words text-xs text-muted-foreground">
                {rotulosPerfil[p.role]} · {p.active ? "Ativo" : "Inativo"}
                {d.lideres.some((l) => l.user_id === p.id)
                  ? ` · ${d.lideres
                      .filter((l) => l.user_id === p.id)
                      .map((l) => d.ministerios.find((m) => m.id === l.ministry_id)?.name)
                      .filter(Boolean)
                      .join(", ")}`
                  : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setId(p.id);
                setRole(p.role);
                setActive(p.active);
                setLeaders(d.lideres.filter((l) => l.user_id === p.id).map((l) => l.ministry_id));
                setError("");
              }}
            >
              {p.role === "admin" ? <Lock className="h-4 w-4" /> : null}
              {p.role === "admin" ? "Detalhes" : "Gerenciar"}
            </Button>
          </div>
        ))}
      </div>
      {!d.carregando && !list.length ? (
        <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
      ) : null}
      <Dialog open={!!selected} onOpenChange={(v) => !v && !busy && setId(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-words pr-5">
              {selected?.full_name || "Usuário"}
            </DialogTitle>
            <DialogDescription className="break-all">{selected?.email}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Ministérios:{" "}
            {d.membros
              .filter((m) => m.user_id === selected?.id)
              .map((m) => d.ministerios.find((x) => x.id === m.ministry_id)?.name)
              .filter(Boolean)
              .join(", ") || "Nenhum"}
          </p>
          {protegido ? (
            <p className="text-sm text-muted-foreground">
              {selected?.role === "admin"
                ? "A conta administradora é única e protegida."
                : selected?.id === usuario.id
                  ? "Você não pode alterar o próprio acesso."
                  : "Somente Admin altera o acesso de Pastor(a)."}
            </p>
          ) : (
            <>
              <Label htmlFor={fieldId}>Função</Label>
              <select
                id={fieldId}
                value={role}
                onChange={(e) => setRole(e.target.value as Perfil)}
                disabled={busy}
                className="min-h-11 rounded-md border border-border bg-background p-2 text-sm"
              >
                {(perfil === "admin" ? ["servo", "lider", "pastor"] : ["servo", "lider"]).map(
                  (r) => (
                    <option key={r} value={r}>
                      {rotulosPerfil[r as Perfil]}
                    </option>
                  ),
                )}
              </select>
              {role === "lider" ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Ministérios que irá liderar</legend>
                  {d.ministerios
                    .filter((m) => m.active || leaders.includes(m.id))
                    .map((m) => (
                      <label
                        key={m.id}
                        className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3"
                      >
                        <Checkbox
                          checked={leaders.includes(m.id)}
                          disabled={busy || (!leaders.includes(m.id) && leaders.length >= 2)}
                          onCheckedChange={(v) =>
                            setLeaders(v ? [...leaders, m.id] : leaders.filter((x) => x !== m.id))
                          }
                        />
                        <span className="text-sm">
                          {m.name}
                          {!m.active ? " (inativo — remova para salvar)" : ""}
                        </span>
                      </label>
                    ))}
                  <p className="text-xs text-muted-foreground">
                    A liderança será vinculada aos ministérios selecionados. Até dois ministérios
                    por membro.
                  </p>
                </fieldset>
              ) : null}
              {perfil === "admin" ? (
                <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
                  Conta ativa
                  <Switch checked={active} onCheckedChange={setActive} disabled={busy} />
                </label>
              ) : null}
              <Button
                disabled={busy || (role === "lider" && !leaders.length)}
                onClick={() => void save()}
              >
                {busy ? "Salvando..." : "Salvar acesso"}
              </Button>
            </>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {selected && !busy && perfil === "admin" ? (
            <div className="border-t border-border pt-2">
              <ExcluirServo pessoa={selected} onExcluido={() => setId(null)} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
