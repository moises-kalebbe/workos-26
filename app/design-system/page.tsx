"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FilterBar } from "@/components/system/filter-bar";
import { FormDialog } from "@/components/system/form-dialog";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";

export default function DesignSystemPage() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Design System"
        description="Catalogo visual dos componentes premium utilizados no WorkOS"
        actions={<Badge variant="secondary">v1</Badge>}
      />

      <SectionCard title="Tokens" subtitle="Base de cores, estados e densidade">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Primary", "bg-primary"],
            ["Secondary", "bg-secondary"],
            ["Success", "bg-success-muted"],
            ["Warning", "bg-warning-muted"],
            ["Danger", "bg-danger-muted"],
          ].map(([label, className]) => (
            <div key={label} className="space-y-2 rounded-xl border border-border p-3">
              <div className={`h-10 rounded-md ${className}`} />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Acoes" subtitle="Botões e estados">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primario</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </SectionCard>

      <SectionCard title="Filtros">
        <FilterBar>
          <Input placeholder="Buscar..." className="max-w-[260px]" />
          <Button variant="outline" size="sm">
            Hoje
          </Button>
          <Button variant="outline" size="sm">
            Semana
          </Button>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>Modo foco</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </FilterBar>
      </SectionCard>

      <SectionCard title="Formularios e Modais">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOpen(true)}>Abrir FormDialog</Button>
          <Badge variant="outline">Input + Textarea + Validation</Badge>
        </div>
      </SectionCard>

      <SectionCard title="Conteudo">
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Visao A</TabsTrigger>
            <TabsTrigger value="b">Visao B</TabsTrigger>
          </TabsList>
          <TabsContent value="a" className="pt-3 text-sm text-muted-foreground">
            Conteudo com hierarquia visual premium.
          </TabsContent>
          <TabsContent value="b" className="pt-3 text-sm text-muted-foreground">
            Estados e componentes reaproveitaveis para todas as telas.
          </TabsContent>
        </Tabs>
      </SectionCard>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Exemplo de FormDialog"
        description="Padrao de formulario para criacao e edicao"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Titulo</Label>
            <Input placeholder="Nome do recurso" />
          </div>
          <div className="space-y-2">
            <Label>Descricao</Label>
            <Textarea placeholder="Contexto e detalhes" />
          </div>
          <Button className="w-full" onClick={() => setOpen(false)}>
            Salvar
          </Button>
        </div>
      </FormDialog>
    </div>
  );
}

