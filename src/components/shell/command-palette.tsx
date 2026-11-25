"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Search,
  Key,
  GitCompare,
  Bot,
  Users,
  Activity,
  Settings,
  Plus,
  RotateCcw,
  Copy,
  Trash2,
  Eye,
  ExternalLink,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface CommandItem {
  name: string;
  href?: string;
  action?: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  shortcut?: string;
  type: "navigation" | "action";
}

const navigationCommands: CommandItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Overview of your projects" },
  { name: "Secrets Vault", href: "/dashboard/secrets", icon: Key, description: "Manage secrets across environments" },
  { name: "Environment Diff", href: "/dashboard/diff", icon: GitCompare, description: "Compare and sync environments" },
  { name: "AI Agent Harness", href: "/dashboard/agents", icon: Bot, description: "Manage and monitor AI agents" },
  { name: "Team & RBAC", href: "/dashboard/team", icon: Users, description: "Manage team members and roles" },
  { name: "Activity Audit", href: "/dashboard/activity", icon: Activity, description: "View audit logs and activity" },
  { name: "Settings & KMS", href: "/dashboard/settings", icon: Settings, description: "Configure project settings" },
];

const actionCommands: CommandItem[] = [
  { name: "Create Secret", action: "create-secret", icon: Plus, description: "Add a new secret", shortcut: "⌘N", type: "action" },
  { name: "Import Secrets", action: "import-secrets", icon: RotateCcw, description: "Bulk import from .env file", type: "action" },
  { name: "Export .env", action: "export-env", icon: Copy, description: "Download environment file", type: "action" },
  { name: "Create Agent", action: "create-agent", icon: Bot, description: "Spin up a new AI agent", type: "action" },
  { name: "Invite Member", action: "invite-member", icon: Users, description: "Add team member", type: "action" },
  { name: "Rotate Master Key", action: "rotate-key", icon: RotateCcw, description: "Rotate encryption key", type: "action" },
];

function CommandPaletteContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<CommandItem[]>([]);

  // Combine all commands
  const allCommands = [
    ...navigationCommands.map((cmd) => ({ ...cmd, type: "navigation" as const })),
    ...actionCommands.map((cmd) => ({ ...cmd, type: "action" as const })),
  ];

  // Filter commands based on query
  useEffect(() => {
    if (!query) {
      setFilteredCommands(allCommands);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const scored = allCommands.map((cmd) => {
      const nameMatch = cmd.name.toLowerCase().includes(lowerQuery);
      const descMatch = cmd.description.toLowerCase().includes(lowerQuery);
      const nameStarts = cmd.name.toLowerCase().startsWith(lowerQuery);
      
      let score = 0;
      if (nameStarts) score += 100;
      if (nameMatch) score += 50;
      if (descMatch) score += 10;
      
      return { ...cmd, score };
    }).filter((cmd) => cmd.score > 0);

    scored.sort((a, b) => b.score - a.score);
    setFilteredCommands(scored);
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback((command: CommandItem) => {
    if (command.type === "navigation") {
      router.push(command.href);
      onClose();
    } else if (command.type === "action") {
      // Handle actions - could open dialogs, etc.
      console.log("Action:", command.action);
      onClose();
    }
  }, [router, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleSelect(filteredCommands[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [filteredCommands, selectedIndex, handleSelect, onClose]);

  return (
    <Command className="w-[400px]">
      <CommandInput
        placeholder="Type a command or search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {filteredCommands
            .filter((cmd) => cmd.type === "navigation")
            .map((cmd, index) => (
              <CommandItem
                key={cmd.name}
                onSelect={() => handleSelect(cmd)}
                className={cn(
                  "flex items-center gap-2",
                  selectedIndex === index && "bg-accent"
                )}
              >
                <cmd.icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-left">
                  <div className="font-medium">{cmd.name}</div>
                  <div className="text-xs text-muted-foreground">{cmd.description}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CommandItem>
            ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          {filteredCommands
            .filter((cmd) => cmd.type === "action")
            .map((cmd, index) => (
              <CommandItem
                key={cmd.name}
                onSelect={() => handleSelect(cmd)}
                className={cn(
                  "flex items-center gap-2",
                  selectedIndex === index && "bg-accent"
                )}
              >
                <cmd.icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-left">
                  <div className="font-medium">{cmd.name}</div>
                  <div className="text-xs text-muted-foreground">{cmd.description}</div>
                </div>
                {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

export function CommandPaletteTrigger() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-9 px-3"
            onClick={() => setOpen(true)}
            aria-label="Open command palette (⌘K)"
          >
            <Search className="h-4 w-4" />
            <span className="text-sm">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 text-xs text-muted-foreground bg-muted rounded">
              <span>⌘</span>K
            </kbd>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open command palette (⌘K)</TooltipContent>
      </Tooltip>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <CommandPaletteContent onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Need to import LayoutDashboard from lucide-react
import { LayoutDashboard } from "lucide-react";