export type QuickStartScoringWeights = {
  inProgress: number;
  dueToday: number;
  recentlyUpdated: number;
  mostActiveProject: number;
  heavilyFocusedPenalty: number;
};

export type QuickStartScoringProfile = {
  version: string;
  minScore: number;
  heavyFocusThresholdSeconds: number;
  weights: QuickStartScoringWeights;
  changelog: Array<{
    version: string;
    date: string;
    notes: string;
  }>;
};

export const QUICK_START_SCORING_PROFILE: QuickStartScoringProfile = {
  version: "2026.03.v2",
  minScore: 20,
  heavyFocusThresholdSeconds: 45 * 60,
  weights: {
    inProgress: 45,
    dueToday: 25,
    recentlyUpdated: 12,
    mostActiveProject: 8,
    heavilyFocusedPenalty: -20,
  },
  changelog: [
    {
      version: "2026.03.v1",
      date: "2026-03-05",
      notes: "Versao inicial do score com pesos fixos para validacao do MVP.",
    },
    {
      version: "2026.03.v2",
      date: "2026-03-06",
      notes: "Ajuste para priorizar tarefa em andamento e reduzir dependencia de atualizacao recente.",
    },
  ],
};

