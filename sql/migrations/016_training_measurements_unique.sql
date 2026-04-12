DELETE FROM athlete_measurements AS older
USING athlete_measurements AS newer
WHERE older.user_id = newer.user_id
  AND older.measurement_date = newer.measurement_date
  AND (
    COALESCE(older.updated_at, older.created_at) < COALESCE(newer.updated_at, newer.created_at)
    OR (
      COALESCE(older.updated_at, older.created_at) = COALESCE(newer.updated_at, newer.created_at)
      AND older.id < newer.id
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'athlete_measurements_user_measurement_date_key'
  ) THEN
    ALTER TABLE athlete_measurements
      ADD CONSTRAINT athlete_measurements_user_measurement_date_key
      UNIQUE (user_id, measurement_date);
  END IF;
END $$;
