import {
  BarChart3,
  Brain,
  BrainCircuit,
  Calendar,
  ClipboardList,
  Columns3,
  LayoutDashboard,
  Lock,
  Settings,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  shortLabel?: string;
  description?: string;
};

export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", description: "Visao executiva do dia" },
  { icon: Timer, label: "Time Tracker", path: "/tracker", description: "Controle de horas e faturamento" },
  { icon: Columns3, label: "Kanban", path: "/kanban", description: "Fluxo de tarefas por coluna" },
  { icon: Calendar, label: "Agenda", path: "/agenda", description: "Compromissos e reunioes" },
  { icon: ClipboardList, label: "Atas", path: "/atas", description: "Registros e follow-ups" },
  { icon: Brain, label: "Skills", path: "/skills", description: "Biblioteca de habilidades" },
  { icon: BrainCircuit, label: "Second Brain", path: "/second-brain", description: "Notas e conexoes de conhecimento" },
  { icon: Lock, label: "Cofre", path: "/vault", description: "Credenciais seguras" },
  { icon: BarChart3, label: "Relatorios", path: "/reports", description: "Indicadores por periodo" },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  icon: Settings,
  label: "Configuracoes",
  path: "/settings",
  description: "Preferencias da conta e projetos",
};

