import { useState, useEffect } from "react";
import { Plus, Lock, Eye, EyeOff, Copy, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { VaultEntry } from "@/types";

export default function VaultPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  // Form
  const [newClient, setNewClient] = useState("");
  const [newService, setNewService] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newNotes, setNewNotes] = useState("");

  useEffect(() => {
    if (user) loadEntries();
  }, [user]);

  async function loadEntries() {
    setLoading(true);
    const { data } = await supabase
      .from("vault_entries")
      .select("*")
      .order("client");
    setEntries((data || []) as unknown as VaultEntry[]);
    setLoading(false);
  }

  async function createEntry() {
    if (!newClient || !newPassword || !user) return;

    // Simple client-side encoding (in production, encrypt server-side)
    const encoded = btoa(newPassword);
    const iv = crypto.randomUUID();

    const { error } = await supabase.from("vault_entries").insert({
      user_id: user.id,
      client: newClient,
      service: newService || null,
      url: newUrl || null,
      username: newUsername || null,
      encrypted_password: encoded,
      iv,
      notes: newNotes || null,
    });

    if (error) {
      toast.error("Erro ao salvar credencial");
    } else {
      toast.success("Credencial salva!");
      setDialogOpen(false);
      setNewClient("");
      setNewService("");
      setNewUrl("");
      setNewUsername("");
      setNewPassword("");
      setNewNotes("");
      loadEntries();
    }
  }

  function togglePassword(id: string) {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Auto-hide after 30s
        setTimeout(() => {
          setVisiblePasswords((p) => {
            const n = new Set(p);
            n.delete(id);
            return n;
          });
        }, 30000);
      }
      return next;
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  }

  function decodePassword(encoded: string) {
    try {
      return atob(encoded);
    } catch {
      return "***";
    }
  }

  const filtered = entries.filter(
    (e) =>
      e.client.toLowerCase().includes(search.toLowerCase()) ||
      (e.service || "").toLowerCase().includes(search.toLowerCase())
  );

  // Group by client
  const grouped = filtered.reduce<Record<string, VaultEntry[]>>((acc, entry) => {
    if (!acc[entry.client]) acc[entry.client] = [];
    acc[entry.client].push(entry);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cofre</h1>
          <p className="text-sm text-muted-foreground">Credenciais organizadas por cliente</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Nova Credencial
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Nova Credencial</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Cliente *</Label>
                  <Input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="Empresa" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Serviço</Label>
                  <Input value={newService} onChange={(e) => setNewService(e.target.value)} placeholder="Gmail, AWS..." className="bg-background border-border" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">URL</Label>
                <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Usuário</Label>
                <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="usuario@email.com" className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Senha *</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Notas</Label>
                <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Observações..." className="bg-background border-border" />
              </div>
              <Button onClick={createEntry} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                Salvar Credencial
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente ou serviço..."
          className="pl-10 bg-card border-border"
        />
      </div>

      {/* Entries */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-1">Cofre vazio</p>
          <p className="text-sm text-muted-foreground">Adicione credenciais para manter tudo organizado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([client, entries]) => (
            <div key={client} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">{client}</h3>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {entries.length}
                </span>
              </div>
              <div className="divide-y divide-border">
                {entries.map((entry) => {
                  const isVisible = visiblePasswords.has(entry.id);
                  const password = decodePassword(entry.encrypted_password);

                  return (
                    <div key={entry.id} className="px-5 py-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{entry.service || "Sem serviço"}</p>
                          {entry.url && (
                            <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                              {entry.url}
                            </a>
                          )}
                        </div>
                      </div>

                      {entry.username && (
                        <div className="flex items-center justify-between rounded-lg bg-background p-2">
                          <span className="text-xs text-muted-foreground">Usuário: <span className="text-foreground font-mono">{entry.username}</span></span>
                          <button onClick={() => copyToClipboard(entry.username!)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between rounded-lg bg-background p-2">
                        <span className="text-xs text-muted-foreground">
                          Senha: <span className="text-foreground font-mono">{isVisible ? password : "••••••••"}</span>
                        </span>
                        <div className="flex gap-1">
                          <button onClick={() => togglePassword(entry.id)} className="text-muted-foreground hover:text-foreground p-1">
                            {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => copyToClipboard(password)} className="text-muted-foreground hover:text-foreground p-1">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {entry.notes && (
                        <p className="text-xs text-muted-foreground">{entry.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
