/**
 * Acesso aos dados reais do Libens (Lovable Cloud).
 * As permissões são garantidas pelo banco (RLS); a interface apenas esconde ações.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Perfil } from "@/types/libens";

export interface MinisterioDb { id: string; name: string; description: string | null; active: boolean }
export interface PessoaDb {
  id: string; full_name: string; email: string; phone: string | null; role: Perfil; active: boolean; created_at: string;
}

export const rotulosPerfil: Record<Perfil, string> = {
  admin: "Administrador",
  pastor: "Pastor",
  lider: "Líder",
  servo: "Servo",
};

export function dataBr(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function traduzirErroDb(e: { message: string; code?: string } | null) {
  if (!e) return null;
  if (e.message.includes("schedules_user_event_unique")) return "Este membro já está escalado para outro ministério neste evento.";
  if (e.code === "P0001") return e.message;
  if (e.message.includes("substitution_open_unique")) return "Já existe um pedido de troca em andamento para esta escala.";
  if (e.code === "23505") return "Esse vínculo já existe.";
  if (e.code === "42501" || /row-level security/i.test(e.message)) return "Você não tem permissão para essa ação.";
  return e.message;
}
export interface EventoDb {
  id: string; name: string; description: string | null; date: string;
  start_time: string; end_time: string | null; location: string | null; active: boolean; created_by: string | null; status: string;
}
export interface EscalaDb {
  id: string; event_id: string; ministry_id: string; user_id: string; status: string; created_at: string;
  created_by: string | null; updated_by: string | null; updated_at: string; response: string;
}
export interface NecessidadeDb { id: string; event_id: string; ministry_id: string; required_count: number }

function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
}

export const rotuloStatus: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Publicada",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Concluída",
  replaced: "Substituída",
};

export async function listarMinisterios() {
  return ok<MinisterioDb[]>(await supabase.from("ministries").select("*").order("name"));
}
export async function listarPessoas() {
  return ok<PessoaDb[]>(
    await supabase.from("profiles").select("id, full_name, email, phone, role, active, created_at").order("full_name"),
  );
}
export async function listarMembros() {
  return ok<{ id: string; user_id: string; ministry_id: string }[]>(
    await supabase.from("user_ministries").select("id, user_id, ministry_id"),
  );
}
export async function listarLideres() {
  return ok<{ id: string; user_id: string; ministry_id: string }[]>(
    await supabase.from("ministry_leaders").select("id, user_id, ministry_id"),
  );
}
export async function listarEventos() {
  return ok<EventoDb[]>(
    await supabase.from("events").select("*").eq("active", true).order("date").order("start_time"),
  );
}
export async function listarNecessidades() {
  return ok<NecessidadeDb[]>(
    await supabase.from("event_ministry_needs").select("id, event_id, ministry_id, required_count"),
  );
}
export async function listarEscalas() {
  return ok<EscalaDb[]>(
    await supabase
      .from("schedules")
      .select("id, event_id, ministry_id, user_id, status, created_at, created_by, updated_by, updated_at, response")
      .not("status", "in", "(cancelled,replaced)"),
  );
}
export async function listarTodasEscalas() {
  return ok<EscalaDb[]>(
    await supabase.from("schedules").select("id, event_id, ministry_id, user_id, status, created_at, created_by, updated_by, updated_at, response"),
  );
}
export async function listarDisponibilidade(userIds?: string[]) {
  let q = supabase.from("availability").select("user_id, date, available");
  if (userIds) q = q.in("user_id", userIds);
  return ok<{ user_id: string; date: string; available: boolean }[]>(await q);
}

export function hora(t: string | null | undefined) {
  return t ? t.slice(0, 5) : "";
}

export function nomeCurto(nome: string) {
  return nome.trim() || "Sem nome";
}

export interface ModeloEventoDb { id: string; name: string; weekday: number; start_time: string; end_time: string | null; active: boolean }
export async function listarModelos() {
  return ok<ModeloEventoDb[]>(
    await supabase.from("event_templates").select("id, name, weekday, start_time, end_time, active").order("weekday", { ascending: false }),
  );
}

export const rotuloResposta: Record<string, string> = { pending: "Aguardando resposta", confirmed: "Confirmado", declined: "Recusado" };
export const rotuloEventoStatus: Record<string, string> = { scheduled: "Agendado", in_progress: "Em andamento", completed: "Concluído", cancelled: "Cancelado" };
export const rotuloTroca: Record<string, string> = {
  pending_substitute: "Aguardando substituto", pending_leader: "Aguardando líder", approved: "Aprovada",
  rejected: "Rejeitada", declined: "Recusada pelo substituto", cancelled: "Cancelada",
};
export interface TrocaDb {
  id: string; schedule_id: string; event_id: string; ministry_id: string; requester_id: string; substitute_id: string;
  status: string; reason: string | null; created_at: string; decided_by: string | null; decided_at: string | null;
}
export async function listarTrocas() {
  return ok<TrocaDb[]>(await supabase.from("substitution_requests").select("*").order("created_at", { ascending: false }));
}
/** Evento aberto para confirmações/trocas (nem concluído nem cancelado). */
export function eventoAberto(e: Pick<EventoDb, "status"> | undefined) {
  return !!e && e.status !== "completed" && e.status !== "cancelled";
}
