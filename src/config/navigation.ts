import {
  Landmark,
  BarChart3,
  Brain,
  BrainCircuit,
  BookOpen,
  Calendar,
  ClipboardList,
  Clapperboard,
  Columns3,
  Dumbbell,
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

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const DASHBOARD_NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: BarChart3, label: "Relatórios", path: "/reports" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { icon: Columns3, label: "Kanban", path: "/kanban" },
      { icon: Timer, label: "Time Tracker", path: "/tracker" },
      { icon: Calendar, label: "Agenda", path: "/agenda" },
      { icon: ClipboardList, label: "Atas", path: "/atas" },
    ],
  },
  {
    label: "Desenvolvimento",
    items: [
      { icon: Dumbbell, label: "Treino", path: "/treino" },
      { icon: BookOpen, label: "Evolução", path: "/evolucao" },
      { icon: Brain, label: "Skills", path: "/skills" },
    ],
  },
  {
    label: "Conhecimento",
    items: [
      { icon: BrainCircuit, label: "Second Brain", path: "/second-brain" },
      { icon: Clapperboard, label: "Cinemateca", path: "/cinemateca" },
    ],
  },
  {
    label: "Finanças & Privacidade",
    items: [
      { icon: Landmark, label: "Financeiro", path: "/financeiro" },
      { icon: Lock, label: "Cofre", path: "/vault" },
    ],
  },
];

export const DASHBOARD_NAV_ITEMS: NavItem[] = DASHBOARD_NAV_GROUPS.flatMap(
  (g) => g.items,
);

export const SETTINGS_NAV_ITEM: NavItem = {
  icon: Settings,
  label: "Configurações",
  path: "/settings",
};
