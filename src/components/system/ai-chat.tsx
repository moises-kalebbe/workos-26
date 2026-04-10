"use client";

import { useEffect, useRef, useState } from "react";
import { BrainCircuit, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type Anthropic from "@anthropic-ai/sdk";

type Role = "user" | "assistant";
type ChatMessage = { role: Role; text: string };

async function sendChat(messages: { role: Role; content: string }[], token: string) {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  const data = await res.json() as { reply?: string; error?: string };
  if (!res.ok) throw new Error(data.error || "Erro ao contatar IA");
  return data.reply ?? "";
}

export function AiChat() {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const next: ChatMessage[] = [...history, { role: "user", text }];
    setHistory(next);
    setLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error("Sessão não encontrada");
      const apiMessages = next.map((m) => ({ role: m.role, content: m.text }));
      const reply = await sendChat(apiMessages, token);
      setHistory([...next, { role: "assistant", text: reply }]);
    } catch (err) {
      setHistory([...next, { role: "assistant", text: `Erro: ${(err as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button — desktop right side */}
      <button
        className="fixed bottom-6 right-6 z-50 hidden h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 transition-transform active:scale-95 md:flex"
        onClick={() => setOpen((v) => !v)}
        aria-label="Assistente IA"
      >
        <BrainCircuit className="h-5 w-5 text-primary-foreground" />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 hidden w-80 flex-col rounded-2xl border border-border bg-card shadow-2xl md:flex"
          style={{ maxHeight: "60vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Assistente WorkOS</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" style={{ flexShrink: 1, overflowY: "auto" }}>
            {history.length === 0 && (
              <div className="text-center space-y-2 py-4">
                <p className="text-xs text-muted-foreground">Pergunte sobre seus dados:</p>
                {[
                  "Como foi minha semana?",
                  "Quais tarefas são urgentes?",
                  "Resumo financeiro do mês",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); }}
                    className="block w-full rounded-lg border border-border bg-background/50 px-3 py-1.5 text-left text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {history.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[90%] rounded-xl px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
              </div>
            ))}
            {loading && (
              <div className="bg-secondary rounded-xl px-3 py-2 w-fit">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <Input
              className="flex-1 h-8 text-sm"
              placeholder="Pergunte algo..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void send()}
              disabled={loading}
            />
            <Button size="sm" className="h-8 w-8 p-0" onClick={() => void send()} disabled={loading || !input.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
