CREATE TABLE IF NOT EXISTS daily_reflection_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  score NUMERIC(3,1) NOT NULL,
  summary TEXT NOT NULL,
  application_hint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_reflection_settings (
  user_id TEXT PRIMARY KEY,
  rotation_started_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_reflection_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  entry_date DATE NOT NULL,
  prompt_id UUID NOT NULL REFERENCES daily_reflection_prompts(id) ON DELETE RESTRICT,
  actions_taken_md TEXT NOT NULL DEFAULT '',
  self_rating INTEGER NOT NULL CHECK (self_rating BETWEEN 1 AND 5),
  mood TEXT NOT NULL CHECK (mood IN ('excellent', 'good', 'neutral', 'tired', 'heavy')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_reflection_entries_user_date
  ON daily_reflection_entries(user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_reflection_entries_user_prompt
  ON daily_reflection_entries(user_id, prompt_id);

DROP TRIGGER IF EXISTS tr_daily_reflection_prompts_updated ON daily_reflection_prompts;
CREATE TRIGGER tr_daily_reflection_prompts_updated
  BEFORE UPDATE ON daily_reflection_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_daily_reflection_settings_updated ON daily_reflection_settings;
CREATE TRIGGER tr_daily_reflection_settings_updated
  BEFORE UPDATE ON daily_reflection_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_daily_reflection_entries_updated ON daily_reflection_entries;
CREATE TRIGGER tr_daily_reflection_entries_updated
  BEFORE UPDATE ON daily_reflection_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO daily_reflection_prompts (position, title, score, summary, application_hint)
VALUES
  (1, 'Focar na 1 tarefa mais importante do dia', 10.0, 'Parar de tentar fazer tudo e escolher o que realmente move o jogo.', 'Antes de começar o dia, escreva: “Se eu só concluísse uma coisa hoje, qual geraria mais resultado?” Comece por ela.'),
  (2, 'Eliminar o que não importa', 10.0, 'Produtividade não é fazer mais; é cortar o que drena energia.', 'Pegue sua lista atual e risque 30% do que não gera resultado direto.'),
  (3, 'Proteger a manhã', 9.9, 'O começo do dia define seu estado mental e sua execução.', 'Primeiros 30 a 60 minutos sem redes, sem conversa aleatória, sem apagar incêndio.'),
  (4, 'Fazer blocos de foco profundo', 9.9, 'Trabalho importante precisa de tempo sem interrupção.', 'Reserve 60 a 90 minutos com celular longe e só uma tarefa aberta.'),
  (5, 'Perguntar: “Isso é realmente necessário?”', 9.8, 'Muita coisa parece urgente, mas não é necessária.', 'Antes de aceitar tarefas, responder mensagens ou iniciar ajustes, faça essa pergunta.'),
  (6, 'Escrever para pensar', 9.8, 'Escrever organiza a mente e melhora decisões.', 'Todo dia, 5 minutos anotando: problema, causa, próxima ação.'),
  (7, 'Ter uma rotina mínima repetível', 9.7, 'Consistência vence motivação.', 'Crie um ritual simples: água, revisar prioridades, foco na tarefa principal.'),
  (8, 'Medir o que importa', 9.7, 'O que não é medido vira sensação, não gestão.', 'Escolha 3 métricas da sua semana e acompanhe sempre.'),
  (9, 'Aprender a dizer não', 9.7, 'Toda vez que você diz sim para o irrelevante, diz não para o essencial.', 'Responda convites e demandas com filtro: “isso aproxima ou afasta da meta?”'),
  (10, 'Dormir melhor', 9.6, 'Energia ruim destrói foco, humor e execução.', 'Durma em horário parecido por alguns dias e reduza tela antes de dormir.'),
  (11, 'Delegar antes de sobrecarregar', 9.6, 'Você não deve ser o gargalo de tudo.', 'Liste 3 tarefas que outra pessoa ou sistema pode assumir.'),
  (12, 'Automatizar tarefas repetitivas', 9.5, 'Tudo que repete demais merece sistema.', 'Identifique uma tarefa semanal repetitiva e transforme em automação ou template.'),
  (13, 'Fazer revisão semanal', 9.5, 'Quem revisa, corrige rota mais rápido.', 'Uma vez por semana, veja: o que funcionou, o que travou, o que ajustar.'),
  (14, 'Reduzir estímulos', 9.4, 'Distração constante quebra sua capacidade de pensar profundo.', 'Silencie notificações e deixe só o essencial.'),
  (15, 'Ter clareza de prioridade', 9.4, 'Sem prioridade clara, tudo compete com tudo.', 'Defina 3 prioridades da semana e deixe visíveis.'),
  (16, 'Journaling simples', 9.4, 'Registrar pensamentos ajuda a tirar peso mental e ganhar direção.', 'Escreva de manhã ou à noite: 3 preocupações, 3 ações, 1 aprendizado.'),
  (17, 'Fazer perguntas melhores', 9.3, 'A qualidade da sua vida melhora com a qualidade das perguntas.', 'Troque “por que isso acontece comigo?” por “qual a melhor resposta possível agora?”'),
  (18, 'Quebrar problemas em partes', 9.3, 'Problemas grandes parecem impossíveis porque estão mal divididos.', 'Ao travar, separe em etapas menores e execute a próxima ação visível.'),
  (19, 'Treinar consistência, não euforia', 9.3, 'Sucesso não vem de dias brilhantes, mas de repetição inteligente.', 'Escolha um hábito pequeno e repita por 7 dias seguidos.'),
  (20, 'Controlar input', 9.2, 'O que entra na sua cabeça molda sua energia e decisões.', 'Reduza consumo de conteúdo aleatório e aumente conteúdo útil.'),
  (21, 'Pausas estratégicas', 9.2, 'Parar direito melhora performance, não atrapalha.', 'A cada bloco forte, faça uma pausa curta longe da tela.'),
  (22, 'Treino físico como ferramenta mental', 9.2, 'Corpo e mente não andam separados.', '20 a 30 minutos de movimento amanhã já mudam seu estado.'),
  (23, 'Meditação ou silêncio intencional', 9.1, 'Menos ruído interno, mais clareza.', '5 minutos sentado sem tela, só respirando e observando os pensamentos.'),
  (24, 'Tomar decisões por princípios', 9.1, 'Princípios reduzem indecisão.', 'Escreva 3 regras pessoais para trabalho, dinheiro ou rotina.'),
  (25, 'Aprender com os melhores', 9.1, 'Modelar gente boa acelera o caminho.', 'Escolha uma pessoa referência e observe hábitos, não só resultados.'),
  (26, 'Testar pequeno antes de expandir', 9.0, 'Pequenos experimentos evitam grandes erros.', 'Antes de lançar algo grande, rode uma versão simples primeiro.'),
  (27, 'Criar ambiente favorável', 9.0, 'Disciplina fica mais fácil quando o ambiente ajuda.', 'Deixe mesa limpa, apps fechados e material pronto antes de trabalhar.'),
  (28, 'Separar criatividade de execução', 8.9, 'Pensar e executar ao mesmo tempo trava ambos.', 'Primeiro gere ideias, depois edite e implemente.'),
  (29, 'Registrar ideias boas rapidamente', 8.9, 'Ideias somem se você confiar só na memória.', 'Use notas rápidas para guardar insights assim que surgirem.'),
  (30, 'Aceitar desconforto como parte do progresso', 8.9, 'Crescimento quase sempre vem com atrito.', 'Quando algo importante incomodar, não fuja na hora; continue por mais 10 minutos.'),
  (31, 'Consumir menos informação e agir mais', 8.8, 'Excesso de estudo sem prática vira fuga sofisticada.', 'Para cada conteúdo consumido, extraia 1 ação concreta.'),
  (32, 'Ter uma pergunta de fechamento do dia', 8.8, 'Fechar o dia bem melhora o próximo.', 'À noite responda: “o que avancei de verdade hoje?”'),
  (33, 'Criar regras para o celular', 8.8, 'Celular sem limite destrói atenção.', 'Deixe fora do alcance em momentos de foco.'),
  (34, 'Evitar multitarefa', 8.7, 'Multitarefa costuma ser troca rápida de atenção com perda de qualidade.', 'Faça uma coisa por vez até concluir ou chegar a um marco claro.'),
  (35, 'Ter um sistema simples de captura', 8.7, 'Tarefas, ideias e pendências precisam de um lugar confiável.', 'Use uma única lista central para tudo.'),
  (36, 'Identificar seus gargalos', 8.7, 'Um único gargalo pode travar todo o restante.', 'Pergunte: “qual ponto hoje mais atrasa meu resultado?”'),
  (37, 'Buscar alavancagem', 8.6, 'Fazer coisas que continuam gerando resultado depois do esforço inicial.', 'Foque em ativos: conteúdo reaproveitável, automação, processo, relacionamento.'),
  (38, 'Controlar impulsos de resposta', 8.6, 'Responder tudo na hora fragmenta seu dia.', 'Crie horários específicos para mensagens e e-mails.'),
  (39, 'Simplificar a alimentação', 8.5, 'Comer de forma caótica afeta energia e disciplina.', 'Organize refeições mais previsíveis em dias de trabalho intenso.'),
  (40, 'Ter critérios para oportunidades', 8.5, 'Nem toda oportunidade vale o custo.', 'Defina critérios antes: lucro, tempo, alinhamento, esforço, potencial.'),
  (41, 'Conversar com pessoas de alto nível', 8.5, 'Seu padrão sobe quando seu ambiente sobe.', 'Busque uma conversa por semana com alguém que expande sua visão.'),
  (42, 'Usar checklists', 8.4, 'Checklist reduz erro bobo e sobrecarga mental.', 'Crie checklist para tarefas recorrentes.'),
  (43, 'Praticar gratidão objetiva', 8.4, 'Ajuda a reduzir ansiedade e trazer estabilidade emocional.', 'Escreva 3 coisas concretas pelas quais você é grato hoje.'),
  (44, 'Reforçar o que funciona', 8.4, 'Muita gente vive corrigindo falhas e esquece de ampliar acertos.', 'Veja o que deu certo na semana e dobre isso.'),
  (45, 'Limitar reuniões desnecessárias', 8.3, 'Reunião sem clareza consome vida.', 'Antes de aceitar, pergunte objetivo, duração e resultado esperado.'),
  (46, 'Usar perguntas de reflexão dura', 8.3, 'Encarar verdades desconfortáveis acelera maturidade.', 'Pergunte: “onde estou fingindo não saber o que preciso fazer?”'),
  (47, 'Aprender a recuperar energia', 8.2, 'Alta performance sem recuperação vira exaustão.', 'Proteja descanso, pausas e tempo sem estímulo.'),
  (48, 'Reduzir perfeccionismo', 8.2, 'Perfeccionismo muitas vezes é procrastinação elegante.', 'Entregue a versão boa o suficiente e melhore depois.'),
  (49, 'Curadoria de relacionamentos', 8.1, 'Algumas pessoas drenam, outras aceleram.', 'Aproxime-se de quem te fortalece e limite o que te sabota.'),
  (50, 'Experimentar novas abordagens', 8.0, 'Rigidez demais impede evolução.', 'Teste uma nova rotina, ferramenta ou forma de trabalhar por 7 dias.')
ON CONFLICT (position) DO UPDATE
SET
  title = EXCLUDED.title,
  score = EXCLUDED.score,
  summary = EXCLUDED.summary,
  application_hint = EXCLUDED.application_hint,
  updated_at = NOW();
