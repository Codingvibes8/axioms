"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Key,
  GitCompare,
  Bot,
  Users,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Secrets", href: "/dashboard/secrets", icon: Key },
  { name: "Environment Diff", href: "/dashboard/diff", icon: GitCompare },
  { name: "AI Agents", href: "/dashboard/agents", icon: Bot },
  { name: "Team", href: "/dashboard/team", icon: Users },
  { name: "Activity", href: "/dashboard/activity", icon: Activity },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-full border-r bg-background transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className={cn("flex h-16 items-center justify-center border-b px-4", collapsed && "justify-center")}>
            {!collapsed && (
              <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
                <span className="text-primary">Axiom</span>
              </Link>
            )}
            {collapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/dashboard" className="text-primary font-bold text-lg">
                    A
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Go to Dashboard</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3" aria-label="Main navigation">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const tab = searchParams.get("tab");
              const isTabActive = item.href === "/dashboard/secrets" && tab
                ? pathname === "/dashboard/secrets" && tab
                : false;

              return (
                <Tooltip key={item.name} disableHoverableContent={collapsed}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive || isTabActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        collapsed && "justify-center"
                      )}
                      aria-current={isActive || isTabActive ? "page" : undefined}
                    >
                      <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {!collapsed && <span>{item.name}</span>}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Collapse toggle */}
          <div className="border-t p-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full justify-center"
                  onClick={onToggle}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}