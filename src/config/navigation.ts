import {
  Landmark,
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
};

export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Timer, label: "Time Tracker", path: "/tracker" },
  { icon: Columns3, label: "Kanban", path: "/kanban" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: ClipboardList, label: "Atas", path: "/atas" },
  { icon: Landmark, label: "Financeiro", path: "/financeiro" },
  { icon: Brain, label: "Skills", path: "/skills" },
  { icon: BrainCircuit, label: "Second Brain", path: "/second-brain" },
  { icon: Lock, label: "Cofre", path: "/vault" },
  { icon: BarChart3, label: "Relatorios", path: "/reports" },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  icon: Settings,
  label: "Configuracoes",
  path: "/settings",
};

