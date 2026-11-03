import {
  CalendarDays,
  CalendarCheck,
  Church,
  Home,
  LayoutDashboard,
  Settings2,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Perfil } from "@/types/libens";

export interface ItemNav {
  rotulo: string;
  to: string;
  icone: LucideIcon;
}

const inicio: ItemNav = { rotulo: "Início", to: "/app/inicio", icone: Home };
const escalas: ItemNav = { rotulo: "Escalas", to: "/app/escalas", icone: CalendarDays };
const disponibilidade: ItemNav = {
  rotulo: "Disponibilidade",
  to: "/app/disponibilidade",
  icone: CalendarCheck,
};
const ministerios: ItemNav = { rotulo: "Ministérios", to: "/app/ministerios", icone: Church };
const perfilItem: ItemNav = { rotulo: "Perfil", to: "/app/perfil", icone: User };
const painel: ItemNav = { rotulo: "Painel", to: "/app/painel", icone: LayoutDashboard };
const admin: ItemNav = { rotulo: "Administração", to: "/app/admin", icone: Settings2 };

export const navPorPerfil: Record<Perfil, ItemNav[]> = {
  servo: [inicio, escalas, disponibilidade, perfilItem],
  lider: [inicio, escalas, disponibilidade, perfilItem],
  pastor: [{ ...painel, rotulo: "Painel pastoral" }, perfilItem],
  admin: [
    { ...painel, rotulo: "Painel principal" },
    escalas,
    disponibilidade,
    ministerios,
    { ...admin, rotulo: "Acessos" },
    perfilItem,
  ],
};
