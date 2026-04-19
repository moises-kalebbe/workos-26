CREATE TABLE IF NOT EXISTS cinemateca_movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  seed_id INTEGER,
  title TEXT NOT NULL,
  year INTEGER,
  genre TEXT,
  imdb_rating TEXT,
  synopsis TEXT,
  poster_url TEXT,
  status TEXT NOT NULL DEFAULT 'want_to_watch' CHECK (status IN ('want_to_watch', 'watching', 'watched')),
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 10),
  notes TEXT,
  watched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, seed_id)
);

CREATE INDEX IF NOT EXISTS idx_cinemateca_movies_user_status ON cinemateca_movies(user_id, status);
CREATE INDEX IF NOT EXISTS idx_cinemateca_movies_user_rating ON cinemateca_movies(user_id, user_rating) WHERE user_rating IS NOT NULL;

DROP TRIGGER IF EXISTS tr_cinemateca_movies_updated ON cinemateca_movies;
CREATE TRIGGER tr_cinemateca_movies_updated BEFORE UPDATE ON cinemateca_movies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
