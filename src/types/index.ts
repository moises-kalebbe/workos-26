export interface Project {
  id: string;
  user_id: string;
  name: string;
  client: string | null;
  hourly_rate: number;
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
  priority: string;
  position: number;
  client: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  subtasks?: Subtask[];
}

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
  client: string;
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
