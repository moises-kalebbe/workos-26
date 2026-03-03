export interface Project {
  id: string;
  user_id: string;
  name: string;
  client: string | null;
  hourly_rate: number;
  monthly_agreed_amount?: number | null;
  monthly_agreed_hours?: number | null;
  daily_agreed_hours?: number | null;
  workdays?: string[] | null;
  daily_rate?: number | null;
  color: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TimeSession {
  id: string;
  project_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
  project?: Project;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  column_index: number;
  priority: "urgent" | "high" | "normal" | "low";
  urgency: "urgent" | "not_urgent";
  importance: "important" | "not_important";
  position: number;
  client: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  subtasks?: Subtask[];
}

export type EisenhowerQuadrant = "do_now" | "schedule" | "delegate" | "eliminate";

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface VaultEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  client: string | null;
  service: string | null;
  url: string | null;
  username: string | null;
  encrypted_password: string;
  iv: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  plan: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface SkillCategory {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillDocument {
  id: string;
  user_id: string;
  category_id: string;
  project_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  content_md: string;
  source_type: "manual" | "upload" | "seed";
  created_at: string;
  updated_at: string;
  last_downloaded_at: string | null;
}

export type SecondBrainStatus = "inbox" | "note" | "archived";
export type SecondBrainLinkType = "manual" | "wikilink";

export interface SecondBrainNote {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  slug: string;
  content_md: string;
  source_url: string | null;
  tags: string[];
  status: SecondBrainStatus;
  captured_at: string;
  created_at: string;
  updated_at: string;
}

export interface SecondBrainLink {
  id: string;
  user_id: string;
  source_note_id: string;
  target_note_id: string;
  link_type: SecondBrainLinkType;
  created_at: string;
}

export interface SecondBrainGraphNode {
  id: string;
  title: string;
  status: SecondBrainStatus;
  tags: string[];
}

export interface SecondBrainGraphEdge {
  id: string;
  source: string;
  target: string;
  link_type: SecondBrainLinkType;
}

export interface CurrentWorkOverview {
  hasActiveSession: boolean;
  projectName: string | null;
  companyName: string | null;
  startedAt: string | null;
  elapsedSeconds: number;
  estimatedValue: number;
}

export interface TimelineSessionBlock {
  id: string;
  label: string;
  company: string | null;
  startMinute: number;
  endMinute: number;
  leftPercent: number;
  widthPercent: number;
  durationSeconds: number;
  estimatedValue: number;
  isActive: boolean;
  color: string | null;
}

