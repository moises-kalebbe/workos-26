import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreate,
  mockDbFrom,
  mockGetRequestUser,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockDbFrom: vi.fn(),
  mockGetRequestUser: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

vi.mock("@/lib/auth", () => ({
  getRequestUser: mockGetRequestUser,
}));

vi.mock("@/lib/serverDbClient", () => ({
  createServerDbClient: vi.fn(() => ({
    from: mockDbFrom,
  })),
}));

import { POST } from "../../app/api/ai/chat/route";

function createQueryBuilder(result: unknown) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    not: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: result })),
  };

  return builder;
}

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = "test-key";
    delete process.env.OPENROUTER_MODEL;
    mockGetRequestUser.mockResolvedValue({ id: "user_123" });
  });

  it("returns a plain assistant reply when the model does not call tools", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: "Resumo da sua semana.",
            tool_calls: [],
          },
        },
      ],
    });

    const response = await POST(new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "Como foi minha semana?" }],
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reply: "Resumo da sua semana." });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toEqual(expect.objectContaining({
      model: "moonshotai/kimi-k2.6",
      tool_choice: "auto",
    }));
  });

  it("executes a single tool call and returns the follow-up answer", async () => {
    mockDbFrom.mockReturnValue(createQueryBuilder([
      {
        id: "task_1",
        title: "Cobrar cliente",
        urgency: "urgent",
        importance: "important",
        due_date: "2026-04-23",
        project: { name: "Lu Burger" },
      },
    ]));
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "call_tasks",
                  type: "function",
                  function: {
                    name: "get_tasks_summary",
                    arguments: "{}",
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "Você tem 1 tarefa urgente.",
              tool_calls: [],
            },
          },
        ],
      });

    const response = await POST(new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "Quais tarefas são urgentes?" }],
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reply: "Você tem 1 tarefa urgente." });
    expect(mockDbFrom).toHaveBeenCalledWith("tasks");
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          tool_calls: expect.arrayContaining([
            expect.objectContaining({
              id: "call_tasks",
            }),
          ]),
        }),
        expect.objectContaining({
          role: "tool",
          tool_call_id: "call_tasks",
        }),
      ]),
    );
  });

  it("supports multiple tool calls in the same iteration", async () => {
    mockDbFrom
      .mockReturnValueOnce(createQueryBuilder([
        { type: "income", amount: 1000, status: "pending", due_date: "2026-04-20", title: "Cliente A" },
      ]))
      .mockReturnValueOnce(createQueryBuilder([
        { project_id: "project_1", duration_seconds: 7200, project: { name: "Cliente A", hourly_rate: 100 } },
      ]));

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "call_financial",
                  type: "function",
                  function: { name: "get_financial_summary", arguments: "{\"months_back\":1}" },
                },
                {
                  id: "call_tracker",
                  type: "function",
                  function: { name: "get_tracker_summary", arguments: "{\"days_back\":7}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "Financeiro e horas carregados.",
              tool_calls: [],
            },
          },
        ],
      });

    const response = await POST(new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "Resumo financeiro e horas" }],
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reply: "Financeiro e horas carregados." });
    expect(mockDbFrom).toHaveBeenNthCalledWith(1, "financial_entries");
    expect(mockDbFrom).toHaveBeenNthCalledWith(2, "time_sessions");
  });

  it("returns an explicit error when OPENROUTER_API_KEY is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;

    const response = await POST(new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "Olá" }],
      }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "OPENROUTER_API_KEY não configurada" });
  });

  it("wraps provider errors with a controlled message", async () => {
    mockCreate.mockRejectedValue(new Error("Model unavailable"));

    const response = await POST(new Request("http://localhost/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "Resumo financeiro do mês" }],
      }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Falha ao consultar o OpenRouter: Model unavailable" });
  });
});
