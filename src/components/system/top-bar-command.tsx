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
        className="h-9 gap-2 rounded-full border-border/70 bg-background/70 px-3 text-muted-foreground hover:bg-accent/60"
        onClick={() => setOpen(true)}
        aria-label="Abrir busca rápida"
      >
        <Search className="h-4 w-4" />
        <span className="hidden text-sm md:inline">Busca rápida</span>
        <span className="text-xs text-muted-foreground/80">Ctrl K</span>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Ir para uma página..." />
        <CommandList>
          <CommandEmpty>Nenhuma página encontrada.</CommandEmpty>
          <CommandGroup heading="Navegação">
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
