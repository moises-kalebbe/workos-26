import {
  BarChart3,
  Brain,
  BrainCircuit,
  Calendar,
  Columns3,
  Command,
  LayoutDashboard,
  Lock,
  Settings,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavGroup = "today" | "base" | "system";

export type NavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  group: NavGroup;
  priority: number;
  summary: string;
  attentionLabel: string;
  nextActionLabel: string;
  riskLabel: string;
  primaryActionLabel?: string;
  primaryActionPath?: string;
  shortLabel?: string;
};

export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/",
    group: "today",
    priority: 1,
    summary: "Cockpit do dia com agenda, foco, risco e proxima entrega.",
    attentionLabel: "Pendencias e gargalos do dia",
    nextActionLabel: "Abrir o modulo que destrava a proxima entrega",
    riskLabel: "Integracoes ausentes ou tarefas sem dono",
    primaryActionLabel: "Revisar prioridades",
    primaryActionPath: "/kanban",
  },
  {
    icon: Calendar,
    label: "Agenda",
    path: "/agenda",
    group: "today",
    priority: 2,
    summary: "Compromissos, blocos de foco e rituais do dia em um unico fluxo.",
    attentionLabel: "Reunioes sem resposta e compromissos proximos",
    nextActionLabel: "Confirmar agenda e abrir o proximo compromisso",
    riskLabel: "Calendario desconectado ou dia sem planejamento",
    primaryActionLabel: "Organizar hoje",
    primaryActionPath: "/agenda",
  },
  {
    icon: Columns3,
    label: "Kanban",
    path: "/kanban",
    group: "today",
    priority: 3,
    summary: "Execucao priorizada com visao clara do que entra, anda e conclui.",
    attentionLabel: "Tarefas vencidas e excesso em andamento",
    nextActionLabel: "Puxar a tarefa certa para agora",
    riskLabel: "Board inflado ou sem foco recomendado",
    primaryActionLabel: "Criar tarefa",
    primaryActionPath: "/kanban?compose=task",
  },
  {
    icon: Timer,
    label: "Time Tracker",
    path: "/tracker",
    group: "today",
    priority: 4,
    summary: "Tempo, foco e valor do dia sem perder o projeto ativo.",
    attentionLabel: "Sessao atual e projetos sem uso hoje",
    nextActionLabel: "Retomar o projeto que precisa andar agora",
    riskLabel: "Tempo nao registrado ou foco pulverizado",
    primaryActionLabel: "Novo projeto",
    primaryActionPath: "/tracker?compose=project",
  },
  {
    icon: Brain,
    label: "Skills",
    path: "/skills",
    group: "base",
    priority: 5,
    summary: "Biblioteca de metodos e playbooks para agir mais rapido.",
    attentionLabel: "Conhecimento recente e skill em foco",
    nextActionLabel: "Abrir a skill que apoia a tarefa atual",
    riskLabel: "Biblioteca sem curadoria ou sem preview util",
    primaryActionLabel: "Nova skill",
    primaryActionPath: "/skills?compose=skill",
  },
  {
    icon: BrainCircuit,
    label: "Second Brain",
    path: "/second-brain",
    group: "base",
    priority: 6,
    summary: "Notas conectadas para capturar, relacionar e recuperar contexto.",
    attentionLabel: "Inbox de notas e conexoes pendentes",
    nextActionLabel: "Capturar ou consolidar a proxima nota",
    riskLabel: "Notas soltas sem relacao ou sem curadoria",
    primaryActionLabel: "Capturar nota",
    primaryActionPath: "/second-brain?compose=note",
  },
  {
    icon: Lock,
    label: "Cofre",
    path: "/vault",
    group: "base",
    priority: 7,
    summary: "Hub operacional de acessos, repositorios e imports por empresa.",
    attentionLabel: "Saude do cofre e ultimo sync local",
    nextActionLabel: "Cadastrar ou revisar credencial critica",
    riskLabel: "Credenciais sem manutencao ou sync antigo",
    primaryActionLabel: "Nova credencial",
    primaryActionPath: "/vault?compose=credential",
  },
  {
    icon: BarChart3,
    label: "Relatorios",
    path: "/reports",
    group: "base",
    priority: 8,
    summary: "Leitura executiva de horas, valor e concentracao de esforco.",
    attentionLabel: "Tendencia de foco e projeto lider do periodo",
    nextActionLabel: "Comparar onde o tempo gerou mais valor",
    riskLabel: "Sem dados suficientes para leitura util",
    primaryActionLabel: "Exportar dados",
    primaryActionPath: "/reports",
  },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  icon: Settings,
  label: "Configuracoes",
  path: "/settings",
  group: "system",
  priority: 99,
  summary: "Perfil, empresas e preferencias que sustentam a operacao.",
  attentionLabel: "Empresas, perfil e preferencias basicas",
  nextActionLabel: "Ajustar a base do workspace",
  riskLabel: "Configuracoes desatualizadas e dados inconsistentes",
  primaryActionLabel: "Editar empresas",
  primaryActionPath: "/settings?tab=companies",
};

export const COMMAND_CENTER_ITEM: NavItem = {
  icon: Command,
  label: "Busca rapida",
  path: "/command-center",
  group: "system",
  priority: 0,
  summary: "Atalhos para navegar e disparar acoes frequentes.",
  attentionLabel: "Acesso rapido aos fluxos principais",
  nextActionLabel: "Abrir a rota ou acao certa sem navegar manualmente",
  riskLabel: "Perder tempo abrindo modulos em sequencia",
};

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  today: "Hoje",
  base: "Base",
  system: "Sistema",
};

export function getAllNavItems() {
  return [...DASHBOARD_NAV_ITEMS, SETTINGS_NAV_ITEM];
}

export function getRouteMeta(pathname: string) {
  const allItems = getAllNavItems();
  const exact = allItems.find((item) => item.path === pathname);
  if (exact) return exact;

  const nested = allItems.find((item) => pathname.startsWith(`${item.path}/`) && item.path !== "/");
  return nested || DASHBOARD_NAV_ITEMS[0];
}

