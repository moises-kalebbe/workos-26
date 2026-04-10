import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getRequestUser } from "@/lib/auth";
import { createServerDbClient } from "@/lib/serverDbClient";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const tools: Anthropic.Tool[] = [
  {
    name: "get_financial_summary",
    description: "Retorna um resumo financeiro do usuário: total de receitas, despesas, lucro, entradas pendentes e vencidas. Use para perguntas sobre dinheiro, faturamento, fluxo de caixa.",
    input_schema: {
      type: "object" as const,
      properties: {
        months_back: {
          type: "number",
          description: "Quantos meses para trás buscar (padrão: 3)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_tracker_summary",
    description: "Retorna resumo de horas trabalhadas por projeto. Use para perguntas sobre tempo, produtividade, horas por cliente.",
    input_schema: {
      type: "object" as const,
      properties: {
        days_back: {
          type: "number",
          description: "Quantos dias para trás buscar (padrão: 30)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_tasks_summary",
    description: "Retorna tarefas abertas agrupadas por prioridade Eisenhower e status. Use para perguntas sobre o que fazer, tarefas urgentes, backlog.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>, userId: string): Promise<string> {
  const db = createServerDbClient(userId);

  if (name === "get_financial_summary") {
    const monthsBack = Number(input.months_back) || 3;
    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);
    const { data } = await db
      .from("financial_entries")
      .select("type, amount, status, due_date, title")
      .eq("user_id", userId)
      .gte("due_date", since.toISOString().slice(0, 10))
      .order("due_date", { ascending: false });

    const entries = data || [];
    const income = entries.filter((e: any) => e.type === "income");
    const expense = entries.filter((e: any) => e.type === "expense");
    const totalIncome = income.reduce((s: number, e: any) => s + e.amount, 0);
    const totalExpense = expense.reduce((s: number, e: any) => s + e.amount, 0);
    const overdue = entries.filter((e: any) => e.status === "overdue");
    const pending = entries.filter((e: any) => e.status === "pending");

    return JSON.stringify({
      period_months: monthsBack,
      total_income: totalIncome,
      total_expense: totalExpense,
      profit: totalIncome - totalExpense,
      overdue_count: overdue.length,
      overdue_total: overdue.reduce((s: number, e: any) => s + e.amount, 0),
      pending_count: pending.length,
      pending_total: pending.reduce((s: number, e: any) => s + e.amount, 0),
      top_income: income.slice(0, 5).map((e: any) => ({ title: e.title, amount: e.amount, due: e.due_date })),
      top_expense: expense.slice(0, 5).map((e: any) => ({ title: e.title, amount: e.amount, due: e.due_date })),
    });
  }

  if (name === "get_tracker_summary") {
    const daysBack = Number(input.days_back) || 30;
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();
    const { data } = await db
      .from("time_sessions")
      .select("project_id, duration_seconds, started_at, project:projects(name, hourly_rate)")
      .eq("user_id", userId)
      .gte("started_at", since)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(500);

    const sessions = data || [];
    const byProject = new Map<string, { name: string; seconds: number; rate: number }>();
    for (const s of sessions as any[]) {
      const key = s.project_id || "sem_projeto";
      const existing = byProject.get(key) || { name: s.project?.name || "Sem projeto", seconds: 0, rate: s.project?.hourly_rate || 0 };
      existing.seconds += s.duration_seconds || 0;
      byProject.set(key, existing);
    }

    const sorted = [...byProject.values()].sort((a, b) => b.seconds - a.seconds);
    const totalSeconds = sorted.reduce((s, p) => s + p.seconds, 0);
    const totalValue = sorted.reduce((s, p) => s + (p.seconds / 3600) * p.rate, 0);

    return JSON.stringify({
      period_days: daysBack,
      total_hours: (totalSeconds / 3600).toFixed(1),
      total_value: Math.round(totalValue),
      projects: sorted.map((p) => ({
        name: p.name,
        hours: (p.seconds / 3600).toFixed(1),
        value: Math.round((p.seconds / 3600) * p.rate),
      })),
    });
  }

  if (name === "get_tasks_summary") {
    const { data } = await db
      .from("tasks")
      .select("id, title, urgency, importance, priority, due_date, column_index, project:projects(name)")
      .eq("user_id", userId)
      .lt("column_index", 2)
      .order("position");

    const tasks = (data || []) as any[];
    const doNow = tasks.filter((t) => t.urgency === "urgent" && t.importance === "important");
    const schedule = tasks.filter((t) => t.urgency === "not_urgent" && t.importance === "important");
    const delegate = tasks.filter((t) => t.urgency === "urgent" && t.importance === "not_important");
    const eliminate = tasks.filter((t) => t.urgency === "not_urgent" && t.importance === "not_important");
    const overdue = tasks.filter((t) => t.due_date && t.due_date < new Date().toISOString().slice(0, 10));

    const fmt = (t: any) => ({ title: t.title, project: t.project?.name, due: t.due_date });

    return JSON.stringify({
      total_open: tasks.length,
      overdue: overdue.length,
      do_now: doNow.slice(0, 5).map(fmt),
      schedule: schedule.slice(0, 5).map(fmt),
      delegate: delegate.length,
      eliminate: eliminate.length,
    });
  }

  return JSON.stringify({ error: "Tool not found" });
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { messages?: Anthropic.MessageParam[] };
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const systemPrompt = `Você é o assistente pessoal do WorkOS — um sistema de produtividade pessoal.
Você tem acesso a dados reais do usuário: finanças, horas trabalhadas, tarefas e projetos.
Responda sempre em português do Brasil, de forma direta e útil.
Use as ferramentas disponíveis para buscar dados antes de responder perguntas sobre esses temas.
Seja conciso: máximo 3-4 parágrafos por resposta.`;

  let response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    messages,
  });

  // Agentic loop — resolve tool calls
  const assistantMessages: Anthropic.MessageParam[] = [];
  let iterations = 0;

  while (response.stop_reason === "tool_use" && iterations < 4) {
    iterations++;
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    assistantMessages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (tu) => ({
        type: "tool_result" as const,
        tool_use_id: tu.id,
        content: await runTool(tu.name, tu.input as Record<string, unknown>, user.id),
      })),
    );

    response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: [...messages, ...assistantMessages, { role: "user", content: toolResults }],
    });
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return NextResponse.json({ reply: textBlock?.text ?? "" });
}
