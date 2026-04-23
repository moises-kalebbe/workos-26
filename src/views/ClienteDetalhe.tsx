"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/dbClient";
import { PageHeader } from "@/components/system/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteConfirmDialog } from "@/components/system/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import type { Client, ClientFile } from "@/types";
import { SERVICE_TYPES } from "@/features/clientes/types";

const FILE_SIZE_LIMIT = 10 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  const [year, month] = iso.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatDateShort(iso: string) {
  const [year, month] = iso.split("-");
  return `${month}/${year}`;
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await db.auth.getSession();
  return session?.access_token ?? null;
}

async function authorizedFetch(input: string, init?: RequestInit) {
  const token = await getAuthToken();
  const headers = new Headers(init?.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}

type UploadForm = {
  fileName: string;
  fileMime: string;
  fileSize: number;
  fileData: string;
  serviceMonth: string;
  serviceType: string;
  description: string;
};

const EMPTY_UPLOAD: UploadForm = {
  fileName: "",
  fileMime: "",
  fileSize: 0,
  fileData: "",
  serviceMonth: new Date().toISOString().slice(0, 7),
  serviceType: "",
  description: "",
};

export default function ClienteDetalhePage({ clientId }: { clientId: string }) {
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [loading, setLoading] = useState(true);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [upload, setUpload] = useState<UploadForm>(EMPTY_UPLOAD);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [filterType, setFilterType] = useState("__all__");
  const [filterMonth, setFilterMonth] = useState("__all__");

  const [deleteFileTarget, setDeleteFileTarget] = useState<ClientFile | null>(null);
  const [deleteClientOpen, setDeleteClientOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [clientRes, filesRes] = await Promise.all([
        db.from("clients").select("*").eq("id", clientId).maybeSingle(),
        db
          .from("client_files")
          .select("id,user_id,client_id,file_name,file_mime,file_size,service_date,service_type,description,created_at,updated_at")
          .eq("client_id", clientId)
          .order("service_date", { ascending: false }),
      ]);

      if (clientRes.error) throw new Error(clientRes.error.message);
      if (!clientRes.data) {
        toast.error("Cliente não encontrado");
        router.push("/clientes");
        return;
      }

      setClient(clientRes.data as unknown as Client);
      setFiles((filesRes.data as unknown as ClientFile[]) ?? []);
    } catch (err) {
      toast.error("Erro ao carregar dados");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openEditClient() {
    if (!client) return;
    setEditForm({
      name: client.name,
      email: client.email ?? "",
      phone: client.phone ?? "",
      notes: client.notes ?? "",
    });
    setEditDialogOpen(true);
  }

  async function handleEditSave() {
    if (!editForm.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setEditSaving(true);
    try {
      const { error } = await db.from("clients").update({
        name: editForm.name.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        notes: editForm.notes.trim() || null,
      }).eq("id", clientId);
      if (error) throw new Error(error.message);
      toast.success("Cliente atualizado");
      setEditDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error("Erro ao salvar");
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteClient() {
    try {
      const { error } = await db.from("clients").delete().eq("id", clientId);
      if (error) throw new Error(error.message);
      toast.success("Cliente excluído");
      router.push("/clientes");
    } catch (err) {
      toast.error("Erro ao excluir cliente");
      console.error(err);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > FILE_SIZE_LIMIT) {
      toast.error("Arquivo excede o limite de 10MB");
      e.target.value = "";
      return;
    }
    setFolderFiles([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const base64 = result.split(",")[1] ?? "";
      setUpload((prev) => ({
        ...prev,
        fileName: file.name,
        fileMime: file.type || "application/octet-stream",
        fileSize: file.size,
        fileData: base64,
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const all = Array.from(e.target.files ?? []);
    const valid = all.filter((f) => f.size <= FILE_SIZE_LIMIT);
    const oversized = all.length - valid.length;
    if (oversized > 0) toast.warning(`${oversized} arquivo(s) ignorados por exceder 10MB`);
    if (valid.length === 0) return;
    setFolderFiles(valid);
    setUpload((prev) => ({ ...prev, fileName: "", fileData: "", fileMime: "", fileSize: 0 }));
  }

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload() {
    if (!upload.serviceType) { toast.error("Selecione o tipo de serviço"); return; }
    if (!upload.serviceMonth) { toast.error("Informe o mês do serviço"); return; }

    const serviceDate = `${upload.serviceMonth}-01`;

    // Pasta: upload sequencial
    if (folderFiles.length > 0) {
      if (!upload.serviceType) { toast.error("Selecione o tipo de serviço"); return; }
      setUploading(true);
      setUploadProgress({ done: 0, total: folderFiles.length });
      let errors = 0;
      for (let i = 0; i < folderFiles.length; i++) {
        const file = folderFiles[i];
        try {
          const base64 = await readFileAsBase64(file);
          const res = await authorizedFetch("/api/clientes/upload", {
            method: "POST",
            body: JSON.stringify({
              client_id: clientId,
              file_name: file.name,
              file_mime: file.type || "application/octet-stream",
              file_size: file.size,
              file_data: base64,
              service_date: serviceDate,
              service_type: upload.serviceType,
              description: upload.description.trim() || null,
            }),
          });
          if (!res.ok) errors++;
        } catch {
          errors++;
        }
        setUploadProgress({ done: i + 1, total: folderFiles.length });
      }
      setUploading(false);
      setUploadProgress(null);
      if (errors > 0) toast.warning(`${errors} arquivo(s) falharam ao enviar`);
      else toast.success(`${folderFiles.length} arquivo(s) enviados com sucesso`);
      setUploadDialogOpen(false);
      setFolderFiles([]);
      setUpload(EMPTY_UPLOAD);
      if (folderInputRef.current) folderInputRef.current.value = "";
      await loadData();
      return;
    }

    // Arquivo único
    if (!upload.fileData) { toast.error("Selecione um arquivo"); return; }
    setUploading(true);
    try {
      const res = await authorizedFetch("/api/clientes/upload", {
        method: "POST",
        body: JSON.stringify({
          client_id: clientId,
          file_name: upload.fileName,
          file_mime: upload.fileMime,
          file_size: upload.fileSize,
          file_data: upload.fileData,
          service_date: serviceDate,
          service_type: upload.serviceType,
          description: upload.description.trim() || null,
        }),
      });
      const json = (await res.json()) as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao enviar");
      toast.success("Arquivo enviado com sucesso");
      setUploadDialogOpen(false);
      setUpload(EMPTY_UPLOAD);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar arquivo");
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(file: ClientFile) {
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/clientes/download/${file.id}`, { headers });
      if (!res.ok) throw new Error("Arquivo não encontrado");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Erro ao baixar arquivo");
      console.error(err);
    }
  }

  async function handleDeleteFile(file: ClientFile) {
    try {
      const { error } = await db.from("client_files").delete().eq("id", file.id);
      if (error) throw new Error(error.message);
      toast.success("Arquivo removido");
      setDeleteFileTarget(null);
      await loadData();
    } catch (err) {
      toast.error("Erro ao remover arquivo");
      console.error(err);
    }
  }

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchType = filterType === "__all__" || f.service_type === filterType;
      const matchMonth = filterMonth === "__all__" || f.service_date.startsWith(filterMonth);
      return matchType && matchMonth;
    });
  }, [files, filterType, filterMonth]);

  const reportByType = useMemo(() => {
    const map: Record<string, { count: number; lastDate: string }> = {};
    for (const f of filteredFiles) {
      const cur = map[f.service_type];
      if (!cur) {
        map[f.service_type] = { count: 1, lastDate: f.service_date };
      } else {
        cur.count += 1;
        if (f.service_date > cur.lastDate) cur.lastDate = f.service_date;
      }
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredFiles]);

  const availableMonths = useMemo(() => {
    const months = new Set(files.map((f) => f.service_date.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [files]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit -ml-2"
        onClick={() => router.push("/clientes")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Clientes
      </Button>

      <PageHeader
        title={client.name}
        description={[client.email, client.phone].filter(Boolean).join(" · ") || ""}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={openEditClient}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteClientOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir cliente
            </Button>
            <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo arquivo
            </Button>
          </>
        }
      />

      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Arquivos ({files.length})</TabsTrigger>
          <TabsTrigger value="report">Relatório Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="mt-4">
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos os meses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os meses</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatDate(m + "-01")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os tipos</SelectItem>
                {SERVICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filterMonth !== "__all__" || filterType !== "__all__") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFilterMonth("__all__"); setFilterType("__all__"); }}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <UploadCloud className="h-10 w-10 opacity-40" />
              <p className="text-sm">
                {filterMonth !== "__all__" || filterType !== "__all__" ? "Nenhum arquivo com esses filtros" : "Nenhum arquivo enviado ainda"}
              </p>
              {filterMonth === "__all__" && filterType === "__all__" && (
                <Button variant="outline" size="sm" onClick={() => setUploadDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Enviar primeiro arquivo
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3"
                >
                  <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{file.file_name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{file.service_type}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(file.service_date)}</span>
                      <span className="text-xs text-muted-foreground">{formatBytes(file.file_size)}</span>
                      {file.description && (
                        <span className="text-xs text-muted-foreground">· {file.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Baixar arquivo"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      title="Remover arquivo"
                      onClick={() => setDeleteFileTarget(file)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos os meses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os meses</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatDate(m + "-01")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filterMonth !== "__all__" && (
              <Button variant="ghost" size="sm" onClick={() => setFilterMonth("__all__")}>
                Ver tudo
              </Button>
            )}
          </div>

          {reportByType.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum arquivo para o período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo de serviço</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Arquivos</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Última entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {reportByType.map(([type, { count, lastDate }]) => (
                    <tr key={type} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{count}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatDateShort(lastDate)}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30">
                    <td className="px-4 py-3 font-semibold">Total</td>
                    <td className="px-4 py-3 text-center font-bold">
                      {reportByType.reduce((acc, [, { count }]) => acc + count, 0)}
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {filteredFiles.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Detalhamento
              </h3>
              <div className="flex flex-col gap-2">
                {filteredFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5">
                    <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.file_name}</p>
                      {file.description && (
                        <p className="text-xs text-muted-foreground">{file.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{file.service_type}</Badge>
                      <span>{formatDateShort(file.service_date)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) {
          setUpload(EMPTY_UPLOAD);
          setFolderFiles([]);
          setUploadProgress(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          if (folderInputRef.current) folderInputRef.current.value = "";
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar arquivo{folderFiles.length > 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label>Origem *</Label>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
              <input
                type="file"
                ref={folderInputRef}
                className="hidden"
                // @ts-expect-error webkitdirectory não está no tipo padrão
                webkitdirectory=""
                multiple
                onChange={handleFolderSelect}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Arquivo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => folderInputRef.current?.click()}
                  className="flex-1"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Pasta
                </Button>
              </div>

              {folderFiles.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <p className="font-medium">{folderFiles.length} arquivo(s) selecionado(s)</p>
                  <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
                    {folderFiles.slice(0, 20).map((f) => (
                      <p key={f.name} className="truncate text-xs text-muted-foreground">{f.name}</p>
                    ))}
                    {folderFiles.length > 20 && (
                      <p className="text-xs text-muted-foreground">…e mais {folderFiles.length - 20}</p>
                    )}
                  </div>
                </div>
              ) : upload.fileName ? (
                <p className={cn("truncate text-sm text-muted-foreground")}>
                  {upload.fileName} · {formatBytes(upload.fileSize)}
                </p>
              ) : null}

              {uploadProgress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando {uploadProgress.done}/{uploadProgress.total}…
                </div>
              )}
            </div>

            {folderFiles.length === 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>Nome do arquivo</Label>
                <Input
                  placeholder="Nome do arquivo"
                  value={upload.fileName}
                  onChange={(e) => setUpload((u) => ({ ...u, fileName: e.target.value }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Mês do serviço *</Label>
                <Input
                  type="month"
                  value={upload.serviceMonth}
                  onChange={(e) => setUpload((u) => ({ ...u, serviceMonth: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Tipo de serviço *</Label>
                <Select
                  value={upload.serviceType}
                  onValueChange={(v) => setUpload((u) => ({ ...u, serviceType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva brevemente o serviço realizado..."
                rows={2}
                value={upload.description}
                onChange={(e) => setUpload((u) => ({ ...u, description: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={uploading || (folderFiles.length === 0 && !upload.fileData)}>
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {folderFiles.length > 1 ? `Enviar ${folderFiles.length} arquivos` : "Enviar arquivo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nome *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Telefone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Observações</Label>
              <Textarea
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editSaving}>
                Cancelar
              </Button>
              <Button onClick={handleEditSave} disabled={editSaving}>
                {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete file confirmation */}
      {deleteFileTarget && (
        <DeleteConfirmDialog
          open={!!deleteFileTarget}
          onOpenChange={(open) => !open && setDeleteFileTarget(null)}
          onConfirm={() => handleDeleteFile(deleteFileTarget)}
          itemLabel={`"${deleteFileTarget.file_name}"`}
        />
      )}

      {/* Delete client confirmation */}
      <DeleteConfirmDialog
        open={deleteClientOpen}
        onOpenChange={setDeleteClientOpen}
        onConfirm={handleDeleteClient}
        itemLabel={`o cliente "${client.name}"`}
      />
    </div>
  );
}
