"use client";

import React, { useEffect, useState } from "react";
import { Command, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { DASHBOARD_NAV_ITEMS, SETTINGS_NAV_ITEM } from "@/config/navigation";
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

const NAV_ITEMS = [...DASHBOARD_NAV_ITEMS, SETTINGS_NAV_ITEM];

export function TopBarCommand() {
  const router = useRouter();
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
        <CommandInput placeholder="Ir para uma pagina..." />
        <CommandList>
          <CommandEmpty>Nenhuma pagina encontrada.</CommandEmpty>
          <CommandGroup heading="Navegacao">
            {NAV_ITEMS.map((item) => (
              <CommandItem key={item.path} value={`${item.label} ${item.path}`} onSelect={() => handleSelect(item.path)}>
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                <CommandShortcut>{item.path === "/" ? "Home" : item.path}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
