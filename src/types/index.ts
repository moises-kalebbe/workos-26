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

export type FinancialEntryType = "income" | "expense";
export type FinancialEntryStatus = "pending" | "paid" | "overdue";
export type FinancialEntryRecurrence = "none" | "monthly" | "yearly";

export interface FinancialEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  type: FinancialEntryType;
  category: string;
  title: string;
  description: string | null;
  counterparty_name: string;
  amount: number;
  currency: string;
  status: FinancialEntryStatus;
  due_date: string;
  paid_at: string | null;
  competency_date: string | null;
  recurrence: FinancialEntryRecurrence;
  alert_days_before: number;
  is_platform_cost: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  skill_document_id: string | null;
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

export interface VaultRepository {
  id: string;
  user_id: string;
  project_id: string | null;
  local_path: string;
  remote_url: string | null;
  html_url?: string | null;
  repo_name: string;
  owner_name: string | null;
  provider: string;
  source_type?: "local_scan" | "github_sync";
  external_id?: string | null;
  is_remote_only?: boolean;
  default_branch: string | null;
  detected_environment_count: number;
  last_scanned_at: string | null;
  last_scan_status: "idle" | "success" | "error";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VaultEnvironmentEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  repository_id: string | null;
  env_key: string;
  env_scope: "local" | "development" | "production" | "staging" | "unknown";
  source_path: string;
  encrypted_value: string;
  iv: string;
  detected_provider: string | null;
  created_at: string;
  updated_at: string;
}

export interface VaultSyncRun {
  id: string;
  user_id: string;
  project_id: string | null;
  repository_id: string | null;
  run_type: "repo_scan" | "env_scan" | "windows_notes_import" | "github_sync";
  status: "success" | "error" | "skipped";
  summary: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface VaultGithubConnection {
  id: string;
  user_id: string;
  display_name: string;
  encrypted_token: string;
  iv: string;
  github_user_id: string | null;
  github_login: string;
  github_name: string | null;
  avatar_url: string | null;
  scopes: string[];
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
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
  source_type?: "manual" | "capture" | "windows-notes-import";
  source_metadata?: Record<string, unknown>;
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

