CREATE TABLE IF NOT EXISTS athlete_profiles (
  user_id TEXT PRIMARY KEY,
  age INTEGER NOT NULL CHECK (age BETWEEN 16 AND 90),
  weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0),
  height_cm NUMERIC(5,2),
  training_background TEXT,
  primary_goal TEXT NOT NULL CHECK (primary_goal IN ('performance_recomp', 'fat_loss', 'hypertrophy')),
  restrictions TEXT,
  gym_window_start TEXT NOT NULL DEFAULT '07:00',
  gym_window_end TEXT NOT NULL DEFAULT '08:20',
  beach_tennis_days TEXT[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'sunday'],
  protein_target_g_per_kg NUMERIC(3,1) NOT NULL DEFAULT 1.8,
  program_start_date DATE NOT NULL,
  mental_rotation_started_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (beach_tennis_days <@ ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
);

CREATE TABLE IF NOT EXISTS training_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  goal TEXT NOT NULL CHECK (goal IN ('performance_recomp', 'fat_loss', 'hypertrophy')),
  start_date DATE NOT NULL,
  duration_weeks INTEGER NOT NULL DEFAULT 24 CHECK (duration_weeks = 24),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  rationale_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  training_program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  block_index INTEGER NOT NULL CHECK (block_index BETWEEN 1 AND 6),
  week_start INTEGER NOT NULL,
  week_end INTEGER NOT NULL,
  focus_key TEXT NOT NULL,
  focus_label TEXT NOT NULL,
  volume_guidance TEXT NOT NULL,
  intensity_guidance TEXT NOT NULL,
  is_deload_block BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (training_program_id, block_index)
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  training_program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  training_block_id UUID REFERENCES training_blocks(id) ON DELETE SET NULL,
  builder_key TEXT NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 24),
  session_date DATE NOT NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  time_slot TEXT NOT NULL CHECK (time_slot IN ('morning', 'night')),
  session_type TEXT NOT NULL CHECK (session_type IN ('strength', 'power', 'recovery', 'full_body', 'beach_tennis')),
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  target_duration_minutes INTEGER NOT NULL CHECK (target_duration_minutes BETWEEN 15 AND 240),
  target_rpe NUMERIC(3,1),
  is_deload_week BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, builder_key)
);

CREATE TABLE IF NOT EXISTS training_session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  training_session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  prescribed_order INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  category TEXT NOT NULL,
  prescribed_sets INTEGER NOT NULL CHECK (prescribed_sets >= 1),
  target_rep_min INTEGER,
  target_rep_max INTEGER,
  rest_seconds INTEGER,
  tempo TEXT,
  load_mode TEXT NOT NULL CHECK (load_mode IN ('rpe', 'bodyweight', 'time', 'distance')),
  target_rpe NUMERIC(3,1),
  target_rir NUMERIC(3,1),
  progression_rule TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (training_session_id, prescribed_order)
);

CREATE TABLE IF NOT EXISTS training_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  training_session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  session_rpe INTEGER CHECK (session_rpe BETWEEN 1 AND 10),
  session_load NUMERIC(10,1) GENERATED ALWAYS AS ((duration_minutes * COALESCE(session_rpe, 0))::numeric) STORED,
  body_weight_kg NUMERIC(5,2),
  sleep_hours NUMERIC(3,1),
  readiness_score INTEGER CHECK (readiness_score BETWEEN 1 AND 5),
  fatigue_score INTEGER CHECK (fatigue_score BETWEEN 1 AND 5),
  notes_md TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, training_session_id)
);

CREATE TABLE IF NOT EXISTS training_exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  training_log_id UUID NOT NULL REFERENCES training_logs(id) ON DELETE CASCADE,
  training_session_exercise_id UUID NOT NULL REFERENCES training_session_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number >= 1),
  reps_completed INTEGER,
  load_kg NUMERIC(6,2),
  rpe NUMERIC(3,1),
  duration_seconds INTEGER,
  distance_meters NUMERIC(6,2),
  completed BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (training_log_id, training_session_exercise_id, set_number)
);

CREATE TABLE IF NOT EXISTS athlete_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  measurement_date DATE NOT NULL,
  weight_kg NUMERIC(5,2),
  waist_cm NUMERIC(5,2),
  counter_movement_jump_cm NUMERIC(5,2),
  sprint_10m_seconds NUMERIC(5,2),
  shuttle_5_10_5_seconds NUMERIC(5,2),
  rsa_score NUMERIC(6,2),
  notes_md TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mental_game_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  cue TEXT NOT NULL,
  application_hint TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('breathing', 'reset', 'focus', 'communication', 'imagery', 'awareness', 'confidence')),
  evidence_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mental_game_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  entry_date DATE NOT NULL,
  prompt_id UUID NOT NULL REFERENCES mental_game_prompts(id) ON DELETE RESTRICT,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  notes_md TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_training_programs_user ON training_programs(user_id, status, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_training_blocks_user ON training_blocks(user_id, training_program_id, block_index);
CREATE INDEX IF NOT EXISTS idx_training_sessions_user_date ON training_sessions(user_id, session_date, time_slot);
CREATE INDEX IF NOT EXISTS idx_training_session_exercises_user_session ON training_session_exercises(user_id, training_session_id, prescribed_order);
CREATE INDEX IF NOT EXISTS idx_training_logs_user_performed ON training_logs(user_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_exercise_logs_user_log ON training_exercise_logs(user_id, training_log_id);
CREATE INDEX IF NOT EXISTS idx_athlete_measurements_user_date ON athlete_measurements(user_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_mental_game_entries_user_date ON mental_game_entries(user_id, entry_date DESC);

DROP TRIGGER IF EXISTS tr_athlete_profiles_updated ON athlete_profiles;
CREATE TRIGGER tr_athlete_profiles_updated BEFORE UPDATE ON athlete_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tr_training_programs_updated ON training_programs;
CREATE TRIGGER tr_training_programs_updated BEFORE UPDATE ON training_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tr_training_blocks_updated ON training_blocks;
CREATE TRIGGER tr_training_blocks_updated BEFORE UPDATE ON training_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tr_training_sessions_updated ON training_sessions;
CREATE TRIGGER tr_training_sessions_updated BEFORE UPDATE ON training_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tr_training_session_exercises_updated ON training_session_exercises;
CREATE TRIGGER tr_training_session_exercises_updated BEFORE UPDATE ON training_session_exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tr_training_logs_updated ON training_logs;
CREATE TRIGGER tr_training_logs_updated BEFORE UPDATE ON training_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tr_training_exercise_logs_updated ON training_exercise_logs;
CREATE TRIGGER tr_training_exercise_logs_updated BEFORE UPDATE ON training_exercise_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tr_athlete_measurements_updated ON athlete_measurements;
CREATE TRIGGER tr_athlete_measurements_updated BEFORE UPDATE ON athlete_measurements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tr_mental_game_prompts_updated ON mental_game_prompts;
CREATE TRIGGER tr_mental_game_prompts_updated BEFORE UPDATE ON mental_game_prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tr_mental_game_entries_updated ON mental_game_entries;
CREATE TRIGGER tr_mental_game_entries_updated BEFORE UPDATE ON mental_game_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO mental_game_prompts (position, title, cue, application_hint, category, evidence_tag)
VALUES
  (1, 'Respira antes do saque', 'um suspiro longo', 'Antes de sacar, solte o ar e relaxe ombros e mao dominante.', 'breathing', 'pst'),
  (2, 'Uma bola por vez', 'so esta bola', 'Traga a atencao para a bola atual e corte a pressa de resolver o game inteiro.', 'focus', 'pst'),
  (3, 'Erro curto, reset rapido', 'errou, resetou', 'Depois do erro, fale uma frase curta e operacional antes do proximo ponto.', 'reset', 'pst'),
  (4, 'Fale com o parceiro cedo', 'fala antes da rede', 'Use uma chamada curta antes do saque ou retorno para alinhar intencao.', 'communication', 'pst'),
  (5, 'Leitura de vento sem irritacao', 'vento e dado', 'Aceite o vento como contexto do jogo, nao como desculpa.', 'awareness', 'pst'),
  (6, 'Olho na intencao, nao no medo', 'bate decidido', 'Escolha o alvo antes da batida e va nele com decisao.', 'confidence', 'pst'),
  (7, 'Respiracao na troca de lado', 'baixa a frequencia', 'Use a troca de lado para baixar o ritmo cardiaco e limpar a mente.', 'breathing', 'pst'),
  (8, 'Visualize o primeiro ponto', 've o ponto antes', 'Antes do treino ou jogo, imagine um ponto bem executado com calma.', 'imagery', 'pst'),
  (9, 'Nao discuta o ponto perdido', 'aprende e anda', 'Tire um aprendizado do erro e siga, sem alongar a frustracao.', 'reset', 'pst'),
  (10, 'Chame a bola com conviccao', 'minha com voz firme', 'Comunique a bola cedo e com voz simples.', 'communication', 'pst'),
  (11, 'Base baixa, mente calma', 'baixo e calmo', 'Use a postura atletica como gatilho para entrar no presente.', 'focus', 'pst'),
  (12, 'Rotina de retorno', 'olho, passo, bate', 'Repita a mesma rotina nos retornos para ganhar estabilidade mental.', 'focus', 'pst'),
  (13, 'Confie no golpe simples', 'simples ganha jogo', 'Quando apertar, reduza o risco e entregue uma bola de qualidade.', 'confidence', 'pst'),
  (14, 'Sem reclamar da areia', 'adapta e joga', 'A areia muda o jogo para todo mundo; foque em se adaptar mais rapido.', 'awareness', 'pst'),
  (15, 'Respire depois do ponto longo', 'solta o ar e volta', 'Use a exalacao longa para nao carregar o ponto anterior.', 'breathing', 'pst'),
  (16, 'Olhe para o parceiro, nao para o placar', 'conecta e segue', 'No aperto, reconecte com o parceiro antes de pensar no resultado.', 'communication', 'pst'),
  (17, 'Auto-talk operacional', 'alto, cedo, firme', 'Troque frases emocionais por comandos curtos de execucao.', 'focus', 'pst'),
  (18, 'Volte para os pes', 'sente a base', 'Quando dispersar, sinta os pes na areia e retorne ao corpo.', 'awareness', 'pst'),
  (19, 'Visualize o lob e a cobertura', 'sobe e recompõe', 'Antecipe a cobertura antes do ponto com uma imagem simples.', 'imagery', 'pst'),
  (20, 'Aceite a oscilacao', 'oscilou, segue', 'Nao espere perfeicao; espere resposta rapida ao erro.', 'confidence', 'pst'),
  (21, 'Reset depois da dupla falta', 'novo ponto agora', 'Interrompa a narrativa negativa imediatamente apos um erro feio.', 'reset', 'pst'),
  (22, 'Micro-objetivo no game', 'primeira bola boa', 'Escolha um objetivo simples para o game atual.', 'focus', 'pst'),
  (23, 'Respire antes de decidir', 'respira e escolhe', 'Respire e so depois defina o alvo tatico do ponto.', 'breathing', 'pst'),
  (24, 'Comunicacao positiva', 'curto e util', 'Fale pouco e de forma construtiva com o parceiro.', 'communication', 'pst'),
  (25, 'Veja a bola alta', 'altura ganha tempo', 'Quando pressionado, pense em margem e altura antes de potencia.', 'confidence', 'pst'),
  (26, 'Observe sem julgar', 'so observa', 'Perceba o que aconteceu no ponto sem adicionar drama.', 'awareness', 'pst'),
  (27, 'Rotina entre pontos', 'vira, respira, decide', 'Use a mesma sequencia entre pontos para reduzir ansiedade.', 'focus', 'pst'),
  (28, 'Imagem do saque limpo', 'saque solto', 'Antes de sacar, veja a mecanica fluida por um segundo.', 'imagery', 'pst'),
  (29, 'Parceiro como ancora', 'olha e alinha', 'Olhe para o parceiro para voltar ao plano, nao ao erro.', 'communication', 'pst'),
  (30, 'Erro nao define o set', 'um ponto nao e o set', 'Evite transformar um erro em previsao de derrota.', 'confidence', 'pst'),
  (31, 'Respiracao para destravar o braco', 'expira e solta', 'Expire antes da execucao para tirar tensao do ombro.', 'breathing', 'pst'),
  (32, 'Leia o adversario cedo', 'olho no corpo', 'Observe sinais corporais antes de a bola sair.', 'awareness', 'pst'),
  (33, 'Comando no smash', 'alto e inteiro', 'Antes do overhead, use uma palavra que lembre extensao e equilibrio.', 'focus', 'pst'),
  (34, 'Recompensa da consistencia', 'mais uma boa', 'Valorize sequencias de boas decisoes, nao so winners.', 'confidence', 'pst'),
  (35, 'Visualize o ponto de resposta', 've a resposta certa', 'Imagine a primeira resposta taticamente correta, nao a perfeita.', 'imagery', 'pst'),
  (36, 'Sem pressa para matar', 'construa primeiro', 'Ganhe o direito de acelerar o ponto.', 'focus', 'pst'),
  (37, 'Fale o obvio com o parceiro', 'curto e claro', 'Em bola no meio ou vento forte, simplifique a comunicacao.', 'communication', 'pst'),
  (38, 'Reset corporal', 'ombro solto, mandibula solta', 'Relaxe mandibula e ombros para reduzir rigidez em momentos tensos.', 'reset', 'pst'),
  (39, 'Mente no presente em game point', 'mesma rotina, mesmo ponto', 'Trate game point como apenas mais um ponto de execucao.', 'confidence', 'pst'),
  (40, 'Atencao no primeiro passo', 'explode primeiro', 'Pense no primeiro passo e nao no rally inteiro.', 'focus', 'pst'),
  (41, 'Respire ao ouvir o placar', 'placar entra, ansiedade sai', 'Use o placar como informacao, nao como gatilho emocional.', 'breathing', 'pst'),
  (42, 'Feche o dia com 1 aprendizado', 'aprendi isso hoje', 'Depois do treino ou jogo, registre um ajuste mental para a proxima sessao.', 'awareness', 'pst')
ON CONFLICT (position) DO UPDATE
SET
  title = EXCLUDED.title,
  cue = EXCLUDED.cue,
  application_hint = EXCLUDED.application_hint,
  category = EXCLUDED.category,
  evidence_tag = EXCLUDED.evidence_tag,
  updated_at = NOW();
