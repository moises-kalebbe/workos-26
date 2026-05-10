import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TreinoPage from "@/views/Treino";

const saveSessionLogMock = vi.fn();
const deleteSessionLogMock = vi.fn();
const saveMeasurementMock = vi.fn();
const deleteMeasurementMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/ui/tabs", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react");
  const TabsContext = ReactModule.createContext<{
    value: string;
    setValue: (value: string) => void;
  } | null>(null);

  function useTabsContext() {
    const context = ReactModule.useContext(TabsContext);
    if (!context) {
      throw new Error("Tabs components must be used inside Tabs");
    }
    return context;
  }

  return {
    Tabs: ({
      value,
      onValueChange,
      children,
      className,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      children: React.ReactNode;
      className?: string;
    }) => (
      <TabsContext.Provider value={{ value, setValue: onValueChange }}>
        <div className={className}>{children}</div>
      </TabsContext.Provider>
    ),
    TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div role="tablist" className={className}>{children}</div>
    ),
    TabsTrigger: ({
      value,
      children,
      className,
    }: {
      value: string;
      children: React.ReactNode;
      className?: string;
    }) => {
      const context = useTabsContext();
      const selected = context.value === value;
      return (
        <button
          type="button"
          role="tab"
          aria-selected={selected}
          data-state={selected ? "active" : "inactive"}
          className={className}
          onClick={() => context.setValue(value)}
        >
          {children}
        </button>
      );
    },
    TabsContent: ReactModule.forwardRef<HTMLDivElement, {
      value: string;
      children: React.ReactNode;
      className?: string;
    }>(({ value, children, className }, ref) => {
      const context = useTabsContext();
      if (context.value !== value) return null;
      return <div ref={ref} className={className}>{children}</div>;
    }),
  };
});

vi.mock("@/components/system/delete-confirm-dialog", () => ({
  DeleteConfirmDialog: ({
    open,
    itemLabel,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    itemLabel: string;
    onConfirm: () => void | Promise<void>;
    onOpenChange: (open: boolean) => void;
  }) => (
    open ? (
      <div aria-label={`Confirmacao para ${itemLabel}`}>
        <button type="button" onClick={() => void onConfirm()}>Excluir</button>
        <button type="button" onClick={() => onOpenChange(false)}>Cancelar</button>
      </div>
    ) : null
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_123" },
  }),
}));

vi.mock("@/features/treino/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/features/treino/hooks")>("@/features/treino/hooks");

  const baseSession = {
    id: "session_1",
    user_id: "user_123",
    training_program_id: "program_1",
    training_block_id: "block_1",
    builder_key: "wk1-mon-am",
    week_number: 1,
    day_of_week: "monday",
    time_slot: "morning",
    session_date: "2026-04-12",
    session_type: "strength",
    title: "Lower A",
    objective: "Forca de base",
    target_duration_minutes: 60,
    target_rpe: 8,
    is_deload_week: false,
    created_at: "2026-04-12T10:00:00.000Z",
    updated_at: "2026-04-12T10:00:00.000Z",
    block: {
      id: "block_1",
      user_id: "user_123",
      training_program_id: "program_1",
      block_index: 1,
      week_start: 1,
      week_end: 4,
      focus_label: "Base",
      volume_guidance: "Volume moderado",
      intensity_guidance: "Submaximo",
      created_at: "2026-04-12T10:00:00.000Z",
      updated_at: "2026-04-12T10:00:00.000Z",
    },
    exercises: [
      {
        id: "exercise_1",
        user_id: "user_123",
        training_session_id: "session_1",
        prescribed_order: 1,
        exercise_name: "Supino inclinado com halteres",
        category: "main",
        prescribed_sets: 2,
        target_rep_min: 8,
        target_rep_max: 10,
        rest_seconds: 90,
        tempo: null,
        load_mode: "rpe",
        target_rpe: 8,
        target_rir: 2,
        progression_rule: "Suba 2 kg quando fechar as reps.",
        notes: null,
        created_at: "2026-04-12T10:00:00.000Z",
        updated_at: "2026-04-12T10:00:00.000Z",
      },
    ],
    log: {
      id: "log_1",
      user_id: "user_123",
      training_session_id: "session_1",
      performed_at: "2026-04-12T11:00:00.000Z",
      duration_minutes: 58,
      session_rpe: 8,
      session_load: 464,
      body_weight_kg: 101.2,
      sleep_hours: 7.5,
      readiness_score: 4,
      fatigue_score: 2,
      notes_md: "Bom treino",
      created_at: "2026-04-12T11:00:00.000Z",
      updated_at: "2026-04-12T11:00:00.000Z",
    },
    exerciseLogs: [
      {
        id: "exercise_log_1",
        user_id: "user_123",
        training_log_id: "log_1",
        training_session_exercise_id: "exercise_1",
        set_number: 1,
        reps_completed: 10,
        load_kg: 22,
        rpe: 8,
        duration_seconds: null,
        distance_meters: null,
        completed: true,
        notes: "controle bom",
        created_at: "2026-04-12T11:00:00.000Z",
        updated_at: "2026-04-12T11:00:00.000Z",
      },
    ],
  };

  return {
    ...actual,
    useTreinoFeature: () => ({
      activeProgram: { id: "program_1", status: "active" },
      blocks: [baseSession.block],
      bootstrapping: false,
      bootstrapProgram: vi.fn(),
      chartPoints: [],
      currentWeekNumber: 1,
      currentWeekSessions: [baseSession],
      error: null,
      loading: false,
      mentalEntries: [],
      mentalPrompts: [],
      measurements: [
        {
          id: "measurement_1",
          user_id: "user_123",
          measurement_date: "2026-04-12",
          weight_kg: 101.2,
          waist_cm: 92,
          counter_movement_jump_cm: null,
          sprint_10m_seconds: null,
          shuttle_5_10_5_seconds: null,
          rsa_score: null,
          notes_md: "Hoje",
          created_at: "2026-04-12T11:00:00.000Z",
          updated_at: "2026-04-12T11:00:00.000Z",
        },
        {
          id: "measurement_2",
          user_id: "user_123",
          measurement_date: "2026-04-10",
          weight_kg: 102.4,
          waist_cm: 93,
          counter_movement_jump_cm: null,
          sprint_10m_seconds: null,
          shuttle_5_10_5_seconds: null,
          rsa_score: null,
          notes_md: "Antes",
          created_at: "2026-04-10T11:00:00.000Z",
          updated_at: "2026-04-10T11:00:00.000Z",
        },
      ],
      profile: {
        id: "profile_1",
        user_id: "user_123",
        age: 37,
        weight_kg: 101.2,
        height_cm: 180,
        training_background: "Retorno",
        primary_goal: "performance_recomp",
        restrictions: null,
        gym_window_start: "07:00",
        gym_window_end: "08:20",
        beach_tennis_days: ["monday"],
        protein_target_g_per_kg: 1.8,
        program_start_date: "2026-04-07",
        mental_rotation_started_on: "2026-04-07",
        created_at: "2026-04-07T10:00:00.000Z",
        updated_at: "2026-04-07T10:00:00.000Z",
      },
      deleteMeasurement: deleteMeasurementMock,
      deleteSessionLog: deleteSessionLogMock,
      saveMeasurement: saveMeasurementMock,
      saveSessionLog: saveSessionLogMock,
      savingMeasurement: false,
      savingSession: false,
      sessionsWithContext: [baseSession],
      timezone: "America/Sao_Paulo",
      todayKey: "2026-04-12",
      todayMentalEntry: null,
      todayMentalPrompt: null,
      todaySession: baseSession,
      toggleMentalApplied: vi.fn(),
      exerciseCatalog: [],
      swapSessionExercise: vi.fn(),
      swappingExerciseId: null,
    }),
  };
});

describe("TreinoPage", () => {
  beforeEach(() => {
    saveSessionLogMock.mockReset().mockResolvedValue(true);
    deleteSessionLogMock.mockReset().mockResolvedValue(true);
    saveMeasurementMock.mockReset().mockResolvedValue(true);
    deleteMeasurementMock.mockReset().mockResolvedValue(true);
  });

  it("permite reverter alteracoes e limpar serie no registro da sessao", async () => {
    render(<TreinoPage />);

    fireEvent.click(screen.getByRole("tab", { name: /sessao/i }));

    const notesField = await screen.findByDisplayValue("Bom treino");
    fireEvent.change(notesField, { target: { value: "rascunho temporario" } });
    fireEvent.click(screen.getByRole("button", { name: /reverter alteracoes/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Bom treino")).toBeInTheDocument();
    });

    const repsField = screen.getByDisplayValue("10") as HTMLInputElement;
    fireEvent.click(screen.getAllByRole("button", { name: /limpar serie/i })[0]);

    await waitFor(() => {
      expect(repsField).toHaveValue("");
    });
  });

  it("exclui o registro da sessao com confirmacao", async () => {
    render(<TreinoPage />);

    fireEvent.click(screen.getByRole("tab", { name: /sessao/i }));
    fireEvent.click(await screen.findByText("Excluir registro"));

    const confirmButtons = within(document.body).getAllByRole("button", { name: "Excluir" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(deleteSessionLogMock).toHaveBeenCalledTimes(1);
    });
  });

  it("permite editar e excluir checkpoints do historico", async () => {
    render(<TreinoPage />);

    fireEvent.click(screen.getByRole("tab", { name: /evolucao/i }));

    const editButtons = await screen.findAllByRole("button", { name: /editar/i });
    const deleteButtons = screen.getAllByRole("button", { name: /^excluir$/i });
    const historyContainer = editButtons[editButtons.length - 1].closest("div.rounded-xl");
    expect(historyContainer).not.toBeNull();

    fireEvent.click(editButtons[editButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /atualizar checkpoint/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue("Antes")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /atualizar checkpoint/i }));

    await waitFor(() => {
      expect(saveMeasurementMock).toHaveBeenCalledWith(expect.objectContaining({
        measurementDate: "2026-04-10",
        notesMd: "Antes",
      }));
    });

    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    const confirmButtons = within(document.body).getAllByRole("button", { name: "Excluir" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(deleteMeasurementMock).toHaveBeenCalledWith("measurement_2");
    });
  });
});
