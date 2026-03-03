
-- ============================================
-- WorkOS Database Schema
-- ============================================

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free',
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client TEXT,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#8b5cf6',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_user ON public.projects(user_id);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projects own data" ON public.projects FOR ALL USING (user_id = auth.uid());

-- Time sessions table
CREATE TABLE public.time_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
      ELSE NULL
    END
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_project ON public.time_sessions(project_id);
CREATE INDEX idx_sessions_user ON public.time_sessions(user_id);
CREATE INDEX idx_sessions_started ON public.time_sessions(started_at DESC);
ALTER TABLE public.time_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions own data" ON public.time_sessions FOR ALL USING (user_id = auth.uid());

-- Tasks table (Kanban)
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  column_index INTEGER NOT NULL DEFAULT 0,
  priority TEXT DEFAULT 'normal',
  position INTEGER NOT NULL DEFAULT 0,
  client TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_user ON public.tasks(user_id);
CREATE INDEX idx_tasks_column ON public.tasks(user_id, column_index, position);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tasks own data" ON public.tasks FOR ALL USING (user_id = auth.uid());

-- Subtasks table
CREATE TABLE public.subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subtasks_task ON public.subtasks(task_id);
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subtasks via task" ON public.subtasks FOR ALL USING (
  task_id IN (SELECT id FROM public.tasks WHERE user_id = auth.uid())
);

-- Vault entries table
CREATE TABLE public.vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client TEXT NOT NULL,
  service TEXT,
  url TEXT,
  username TEXT,
  encrypted_password TEXT NOT NULL,
  iv TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vault_user ON public.vault_entries(user_id);
ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vault own data" ON public.vault_entries FOR ALL USING (user_id = auth.uid());

-- ============================================
-- Triggers
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_vault_updated BEFORE UPDATE ON public.vault_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto set completed_at when task moves to column 2
CREATE OR REPLACE FUNCTION public.set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.column_index = 2 AND (OLD.column_index IS NULL OR OLD.column_index != 2) THEN
    NEW.completed_at = now();
  ELSIF NEW.column_index != 2 THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_task_completed BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_completed_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
