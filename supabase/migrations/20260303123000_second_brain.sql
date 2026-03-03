BEGIN;

CREATE TABLE IF NOT EXISTS public.second_brain_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  content_md text NOT NULL DEFAULT '',
  source_url text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'inbox'
    CHECK (status IN ('inbox', 'note', 'archived')),
  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_second_brain_notes_user_status_updated
  ON public.second_brain_notes(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_second_brain_notes_tags_gin
  ON public.second_brain_notes
  USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_second_brain_notes_user_slug
  ON public.second_brain_notes(user_id, slug);

ALTER TABLE public.second_brain_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Second brain notes own data"
ON public.second_brain_notes
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.second_brain_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_note_id uuid NOT NULL REFERENCES public.second_brain_notes(id) ON DELETE CASCADE,
  target_note_id uuid NOT NULL REFERENCES public.second_brain_notes(id) ON DELETE CASCADE,
  link_type text NOT NULL CHECK (link_type IN ('manual', 'wikilink')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (source_note_id <> target_note_id),
  UNIQUE (user_id, source_note_id, target_note_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_second_brain_links_user_source
  ON public.second_brain_links(user_id, source_note_id);

CREATE INDEX IF NOT EXISTS idx_second_brain_links_user_target
  ON public.second_brain_links(user_id, target_note_id);

ALTER TABLE public.second_brain_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Second brain links own data"
ON public.second_brain_links
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.validate_second_brain_link_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_owner uuid;
  target_owner uuid;
BEGIN
  SELECT user_id INTO source_owner
  FROM public.second_brain_notes
  WHERE id = NEW.source_note_id;

  SELECT user_id INTO target_owner
  FROM public.second_brain_notes
  WHERE id = NEW.target_note_id;

  IF source_owner IS NULL OR target_owner IS NULL THEN
    RAISE EXCEPTION 'Source or target note does not exist';
  END IF;

  IF NEW.user_id IS DISTINCT FROM source_owner OR NEW.user_id IS DISTINCT FROM target_owner THEN
    RAISE EXCEPTION 'Link ownership mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_second_brain_notes_updated ON public.second_brain_notes;
CREATE TRIGGER tr_second_brain_notes_updated
BEFORE UPDATE ON public.second_brain_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS tr_second_brain_links_validate_ownership ON public.second_brain_links;
CREATE TRIGGER tr_second_brain_links_validate_ownership
BEFORE INSERT OR UPDATE ON public.second_brain_links
FOR EACH ROW
EXECUTE FUNCTION public.validate_second_brain_link_ownership();

COMMIT;
