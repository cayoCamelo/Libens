/**
 * Tipos centrais do Libens.
 * Preparados para serem preenchidos por dados reais (Lovable Cloud) no futuro.
 */

export type Perfil = "servo" | "lider" | "pastor" | "admin";

export interface Ministerio {
  id: string;
  nome: string;
  liderId?: string;
}

export interface Servo {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  perfil: Perfil;
  ministerioIds: string[];
}

export interface Evento {
  id: string;
  nome: string;
  /** ISO date: 2026-10-04 */
  data: string;
  /** HH:mm */
  hora: string;
  local?: string;
}

export interface Escala {
  id: string;
  eventoId: string;
  ministerioId: string;
  servoIds: string[];
  confirmada: boolean;
}

export type PeriodoDia = "manha" | "tarde" | "noite";

export interface Disponibilidade {
  servoId: string;
  /** ISO date */
  data: string;
  periodos: PeriodoDia[];
}
