CREATE TABLE public.skill_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_skill_categories_user_name
  ON public.skill_categories(user_id, name);

ALTER TABLE public.skill_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Skill categories own data"
ON public.skill_categories
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER tr_skill_categories_updated
BEFORE UPDATE ON public.skill_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.skill_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.skill_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  summary text,
  content_md text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('manual', 'upload', 'seed')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_downloaded_at timestamp with time zone,
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_skill_documents_user_category
  ON public.skill_documents(user_id, category_id);

CREATE INDEX idx_skill_documents_user_updated
  ON public.skill_documents(user_id, updated_at DESC);

ALTER TABLE public.skill_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Skill documents own data"
ON public.skill_documents
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER tr_skill_documents_updated
BEFORE UPDATE ON public.skill_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

