/**
 * Dados fictícios da primeira etapa do Libens.
 * Nenhum dado real. Este arquivo é o único ponto a substituir quando
 * os dados passarem a vir do backend.
 */
import type {
  Disponibilidade,
  Escala,
  Evento,
  Ministerio,
  Perfil,
  Servo,
} from "@/types/libens";

export const ministerios: Ministerio[] = [
  { id: "min-midia", nome: "Mídia", liderId: "srv-2" },
  { id: "min-transmissao", nome: "Transmissão", liderId: "srv-2" },
  { id: "min-portaria", nome: "Portaria", liderId: "srv-4" },
  { id: "min-louvor", nome: "Louvor", liderId: "srv-5" },
  { id: "min-projecao", nome: "Projeção", liderId: "srv-3" },
  { id: "min-intercessao", nome: "Intercessão", liderId: "srv-6" },
  { id: "min-infantil", nome: "Infantil", liderId: "srv-7" },
];

export const servos: Servo[] = [
  {
    id: "srv-1",
    nome: "Ana Ribeiro",
    email: "ana@exemplo.com",
    telefone: "(00) 90000-0001",
    perfil: "servo",
    ministerioIds: ["min-transmissao", "min-midia"],
  },
  {
    id: "srv-2",
    nome: "Bruno Camargo",
    email: "bruno@exemplo.com",
    perfil: "lider",
    ministerioIds: ["min-midia", "min-transmissao"],
  },
  {
    id: "srv-3",
    nome: "Carla Menezes",
    email: "carla@exemplo.com",
    perfil: "servo",
    ministerioIds: ["min-projecao"],
  },
  {
    id: "srv-4",
    nome: "Daniel Souza",
    email: "daniel@exemplo.com",
    perfil: "lider",
    ministerioIds: ["min-portaria"],
  },
  {
    id: "srv-5",
    nome: "Eliane Prado",
    email: "eliane@exemplo.com",
    perfil: "lider",
    ministerioIds: ["min-louvor"],
  },
  {
    id: "srv-6",
    nome: "Felipe Nunes",
    email: "felipe@exemplo.com",
    perfil: "servo",
    ministerioIds: ["min-intercessao", "min-portaria"],
  },
  {
    id: "srv-7",
    nome: "Gabriela Lima",
    email: "gabriela@exemplo.com",
    perfil: "servo",
    ministerioIds: ["min-infantil"],
  },
  {
    id: "srv-8",
    nome: "Pastor Henrique",
    email: "henrique@exemplo.com",
    perfil: "pastor",
    ministerioIds: [],
  },
];

export const eventos: Evento[] = [
  { id: "evt-1", nome: "Culto de Celebração", data: "2026-10-04", hora: "18:30", local: "Templo" },
  { id: "evt-2", nome: "Culto de Oração", data: "2026-10-08", hora: "19:30", local: "Templo" },
  { id: "evt-3", nome: "Encontro de Jovens", data: "2026-10-11", hora: "19:00", local: "Anexo" },
  { id: "evt-4", nome: "Culto da Família", data: "2026-10-18", hora: "18:30", local: "Templo" },
  { id: "evt-5", nome: "Santa Ceia", data: "2026-10-25", hora: "18:30", local: "Templo" },
];

export const escalas: Escala[] = [
  {
    id: "esc-1",
    eventoId: "evt-1",
    ministerioId: "min-transmissao",
    servoIds: ["srv-1", "srv-2"],
    confirmada: true,
  },
  {
    id: "esc-2",
    eventoId: "evt-1",
    ministerioId: "min-louvor",
    servoIds: ["srv-5", "srv-3"],
    confirmada: true,
  },
  {
    id: "esc-3",
    eventoId: "evt-2",
    ministerioId: "min-intercessao",
    servoIds: ["srv-6"],
    confirmada: false,
  },
  {
    id: "esc-4",
    eventoId: "evt-3",
    ministerioId: "min-midia",
    servoIds: ["srv-1", "srv-2"],
    confirmada: false,
  },
  {
    id: "esc-5",
    eventoId: "evt-4",
    ministerioId: "min-portaria",
    servoIds: ["srv-4", "srv-6"],
    confirmada: true,
  },
  {
    id: "esc-6",
    eventoId: "evt-5",
    ministerioId: "min-projecao",
    servoIds: ["srv-3"],
    confirmada: false,
  },
  {
    id: "esc-7",
    eventoId: "evt-5",
    ministerioId: "min-infantil",
    servoIds: ["srv-7"],
    confirmada: false,
  },
];

export const disponibilidades: Disponibilidade[] = [
  { servoId: "srv-1", data: "2026-10-04", periodos: ["tarde", "noite"] },
  { servoId: "srv-1", data: "2026-10-11", periodos: ["noite"] },
  { servoId: "srv-1", data: "2026-10-18", periodos: ["manha", "noite"] },
];

/** Usuário fictício da sessão de demonstração, por perfil. */
export const usuarioPorPerfil: Record<Perfil, Servo> = {
  servo: servos[0],
  lider: servos[1],
  pastor: servos[7],
  admin: {
    id: "srv-admin",
    nome: "Equipe Libens",
    email: "admin@libens.app",
    perfil: "admin",
    ministerioIds: [],
  },
};

export const rotulosPerfil: Record<Perfil, string> = {
  servo: "Servo",
  lider: "Líder",
  pastor: "Pastor",
  admin: "Administrador",
};

export function ministerioPorId(id: string) {
  return ministerios.find((m) => m.id === id);
}

export function eventoPorId(id: string) {
  return eventos.find((e) => e.id === id);
}

export function servoPorId(id: string) {
  return servos.find((s) => s.id === id);
}

export function servosDoMinisterio(ministerioId: string) {
  return servos.filter((s) => s.ministerioIds.includes(ministerioId));
}

export function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function formatarDataCurta(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
