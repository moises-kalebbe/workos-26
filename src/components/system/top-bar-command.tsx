"use client";

import React, { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getAllNavItems, getRouteMeta } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

const NAV_ITEMS = getAllNavItems();

const QUICK_ACTIONS = [
  { label: "Nova tarefa no Kanban", path: "/kanban?compose=task", shortcut: "Task" },
  { label: "Novo lancamento financeiro", path: "/financeiro?compose=entry", shortcut: "Finance" },
  { label: "Novo projeto no Tracker", path: "/tracker?compose=project", shortcut: "Project" },
  { label: "Nova skill", path: "/skills?compose=skill", shortcut: "Skill" },
  { label: "Nova nota", path: "/second-brain?compose=note", shortcut: "Note" },
  { label: "Nova credencial", path: "/vault?compose=credential", shortcut: "Vault" },
];

export function TopBarCommand() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleSelect(path: string) {
    setOpen(false);
    router.push(path);
  }

  const currentRoute = getRouteMeta(pathname);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 gap-2 rounded-2xl border-border/60 bg-white/[0.03] px-3 text-muted-foreground shadow-none hover:bg-white/[0.06] hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Abrir busca rapida"
      >
        <Search className="h-4 w-4 text-cyan-300" />
        <span className="hidden text-sm md:inline">Buscar pagina</span>
        <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground/80">
          Ctrl K
        </span>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Ir para uma pagina ou disparar uma acao..." />
        <CommandList>
          <CommandEmpty>Nenhuma pagina encontrada.</CommandEmpty>
          <CommandGroup heading="Acoes frequentes">
            {QUICK_ACTIONS.map((item) => (
              <CommandItem key={item.path} value={item.label} onSelect={() => handleSelect(item.path)}>
                <Plus className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                <CommandShortcut>{item.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Navegacao">
            {NAV_ITEMS.map((item) => (
              <CommandItem key={item.path} value={`${item.label} ${item.summary} ${item.path}`} onSelect={() => handleSelect(item.path)}>
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                <CommandShortcut>{item.path === "/" ? "Home" : item.path}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Contexto atual">
            <CommandItem
              value={`${currentRoute.label} ${currentRoute.nextActionLabel}`}
              onSelect={() => handleSelect(currentRoute.primaryActionPath || currentRoute.path)}
            >
              <currentRoute.icon className="mr-2 h-4 w-4" />
              <span>{currentRoute.nextActionLabel}</span>
              <CommandShortcut>{currentRoute.label}</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
