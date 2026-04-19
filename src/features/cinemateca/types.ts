export type CinematecaStatus = "want_to_watch" | "watching" | "watched";

export interface CinematecaMovie {
  id: string;
  user_id: string;
  seed_id: number | null;
  title: string;
  year: number | null;
  genre: string | null;
  imdb_rating: string | null;
  synopsis: string | null;
  poster_url: string | null;
  status: CinematecaStatus;
  user_rating: number | null;
  notes: string | null;
  watched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CinematecaSeedMovie {
  seed_id: number;
  title: string;
  year: number;
  genre: string;
  imdb_rating: string;
  synopsis: string;
}
