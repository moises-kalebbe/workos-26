export interface Project {
  id: string;
  user_id: string;
  name: string;
  client: string | null;
  niche?: string | null;
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
  financial_contract_id: string | null;
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
  payment_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type FinancialContractStatus = "active" | "inactive";

export interface FinancialContract {
  id: string;
  user_id: string;
  project_id: string | null;
  type: FinancialEntryType;
  name: string;
  counterparty_name: string;
  category: string;
  amount: number;
  currency: string;
  recurrence: FinancialEntryRecurrence;
  due_day: number;
  alert_days_before: number;
  start_date: string;
  end_date: string | null;
  status: FinancialContractStatus;
  payment_url: string | null;
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
  clickup_token: string | null;
  clickup_view_id: string | null;
  whatsapp_number: string | null;
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

export type MeetingMinutesStatus = "pending" | "in_progress" | "resolved";

export interface MeetingMinutesChecklistEntry {
  id: string;
  title: string;
  completed: boolean;
}

export interface MeetingMinutesItem {
  id: string;
  user_id: string;
  meeting_event_id: string;
  meeting_series_key: string;
  meeting_start_at: string;
  meeting_summary: string;
  title: string;
  detail: string | null;
  checklist_json: MeetingMinutesChecklistEntry[];
  status: MeetingMinutesStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  enabled: boolean;
  browser_enabled: boolean;
  toast_enabled: boolean;
  meetings_enabled: boolean;
  meeting_follow_up_enabled: boolean;
  tasks_enabled: boolean;
  finance_enabled: boolean;
  meeting_reminder_minutes: number[];
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  weekend_notifications: boolean;
  max_notifications_per_cycle: number;
  updated_at: string;
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

export type DailyReflectionMood = "excellent" | "good" | "neutral" | "tired" | "heavy";

export interface DailyReflectionChecklistEntry {
  id: string;
  title: string;
  completed: boolean;
}

export interface DailyReflectionPrompt {
  id: string;
  position: number;
  title: string;
  score: number;
  summary: string;
  application_hint: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReflectionSetting {
  user_id: string;
  rotation_started_on: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReflectionEntry {
  id: string;
  user_id: string;
  entry_date: string;
  prompt_id: string;
  checklist_json: DailyReflectionChecklistEntry[];
  actions_taken_md: string;
  tomorrow_focus: string;
  self_rating: number;
  mood: DailyReflectionMood;
  created_at: string;
  updated_at: string;
}

export type TrainingPrimaryGoal = "performance_recomp" | "fat_loss" | "hypertrophy";
export type TrainingDayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
export type TrainingTimeSlot = "morning" | "night";
export type TrainingProgramStatus = "active" | "archived";
export type TrainingSessionType =
  | "strength"
  | "power"
  | "recovery"
  | "full_body"
  | "beach_tennis";
export type TrainingExerciseLoadMode = "rpe" | "bodyweight" | "time" | "distance";
export type MentalGameCategory =
  | "breathing"
  | "reset"
  | "focus"
  | "communication"
  | "imagery"
  | "awareness"
  | "confidence";

export interface AthleteProfile {
  user_id: string;
  age: number;
  weight_kg: number;
  height_cm: number | null;
  training_background: string | null;
  primary_goal: TrainingPrimaryGoal;
  restrictions: string | null;
  gym_window_start: string;
  gym_window_end: string;
  beach_tennis_days: TrainingDayOfWeek[];
  protein_target_g_per_kg: number;
  program_start_date: string;
  mental_rotation_started_on: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingProgram {
  id: string;
  user_id: string;
  name: string;
  goal: TrainingPrimaryGoal;
  start_date: string;
  duration_weeks: number;
  status: TrainingProgramStatus;
  rationale_summary: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingBlock {
  id: string;
  user_id: string;
  training_program_id: string;
  block_index: number;
  week_start: number;
  week_end: number;
  focus_key: string;
  focus_label: string;
  volume_guidance: string;
  intensity_guidance: string;
  is_deload_block: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingSession {
  id: string;
  user_id: string;
  training_program_id: string;
  training_block_id: string | null;
  builder_key: string;
  week_number: number;
  session_date: string;
  day_of_week: TrainingDayOfWeek;
  time_slot: TrainingTimeSlot;
  session_type: TrainingSessionType;
  title: string;
  objective: string;
  target_duration_minutes: number;
  target_rpe: number | null;
  is_deload_week: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExerciseCatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  video_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingSessionExercise {
  id: string;
  user_id: string;
  training_session_id: string;
  prescribed_order: number;
  exercise_name: string;
  category: string;
  prescribed_sets: number;
  target_rep_min: number | null;
  target_rep_max: number | null;
  rest_seconds: number | null;
  tempo: string | null;
  load_mode: TrainingExerciseLoadMode;
  target_rpe: number | null;
  target_rir: number | null;
  progression_rule: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingLog {
  id: string;
  user_id: string;
  training_session_id: string;
  performed_at: string;
  duration_minutes: number;
  session_rpe: number | null;
  session_load: number;
  body_weight_kg: number | null;
  sleep_hours: number | null;
  readiness_score: number | null;
  fatigue_score: number | null;
  notes_md: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingExerciseLog {
  id: string;
  user_id: string;
  training_log_id: string;
  training_session_exercise_id: string;
  set_number: number;
  reps_completed: number | null;
  load_kg: number | null;
  rpe: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AthleteMeasurement {
  id: string;
  user_id: string;
  measurement_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  counter_movement_jump_cm: number | null;
  sprint_10m_seconds: number | null;
  shuttle_5_10_5_seconds: number | null;
  rsa_score: number | null;
  notes_md: string | null;
  created_at: string;
  updated_at: string;
}

export interface MentalGamePrompt {
  id: string;
  position: number;
  title: string;
  cue: string;
  application_hint: string;
  category: MentalGameCategory;
  evidence_tag: string;
  created_at: string;
  updated_at: string;
}

export interface MentalGameEntry {
  id: string;
  user_id: string;
  entry_date: string;
  prompt_id: string;
  applied: boolean;
  notes_md: string | null;
  created_at: string;
  updated_at: string;
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

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientFile {
  id: string;
  user_id: string;
  client_id: string;
  file_name: string;
  file_mime: string;
  file_size: number;
  service_date: string;
  service_type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientFileWithData = ClientFile & { file_data: string };

