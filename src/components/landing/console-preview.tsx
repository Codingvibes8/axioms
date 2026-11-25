"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Bot,
  GitCompare,
  RotateCcw,
  Terminal,
  Zap,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const tabStyles = "bg-zinc-900 border border-zinc-700 rounded-lg p-4 font-mono text-sm text-zinc-100";

export function ConsolePreview() {
  const [activeTab, setActiveTab] = React.useState("agents");
  const [copied, setCopied] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // Simulated terminal output for Live Proxy Simulator
  const [terminalLines, setTerminalLines] = React.useState<string[]>([
    "[$] axiom proxy start --agent=code-review-bot",
    "[✓] Connected to agent harness: code-review-bot",
    "[✓] Token validated: axm_cod_****7f2a",
    "[✓] Secrets injected: 12/12 (OPENAI_KEY, GITHUB_TOKEN, ...)",
    "[✓] Proxy firewall: ENABLED (allowlist: api.openai.com, api.github.com)",
    "",
    "[10:42:13] ▶ Invoking agent with prompt: 'Review PR #247'",
    "[10:42:14] ◀ Fetching repository context...",
    "[10:42:15] ◀ Analyzing diff: 142 files changed",
    "[10:42:16] ◀ Running security scan...",
    "[10:42:17] ◀ Generating review comments...",
    "[10:42:18] ✓ Review posted: 23 comments, 3 approvals needed",
    "[10:42:18] ℹ Tokens used: 1,247 / 50,000/hr",
    "",
    "[10:43:22] ▶ Invoking agent with prompt: 'Fix failing tests'",
    "[10:43:23] ◀ Identifying test failures...",
    "[10:43:24] ◀ Applying fixes to 3 files...",
    "[10:43:26] ✓ Tests passing: 247/247",
  ]);

  // Animate terminal lines
  React.useEffect(() => {
    const extraLines = [
      "[10:45:01] ▶ Invoking agent with prompt: 'Refactor auth module'",
      "[10:45:02] ◀ Loading codebase context...",
      "[10:45:03] ◀ Analyzing dependencies...",
      "[10:45:05] ◀ Generating refactoring plan...",
      "[10:45:07] ✓ Plan ready: 8 files to modify",
    ];
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < extraLines.length) {
        setTerminalLines((prev) => [...prev, extraLines[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 bg-zinc-900 border-b border-zinc-800">
        {[
          { id: "agents", label: "AI Agent Harness", icon: Bot },
          { id: "diff", label: "Env Diff Sync", icon: GitCompare },
          { id: "rollback", label: "Rollback Vault", icon: RotateCcw },
        ].map((tab) => (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                )}
                aria-selected={activeTab === tab.id}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{tab.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Tab content */}
      <div className={cn(tabStyles, "min-h-[320px] max-h-[400px] overflow-y-auto")}>
        {activeTab === "agents" && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs uppercase tracking-wider">Agent Harness</span>
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle className="h-3 w-3" />
                <span className="text-xs">LIVE</span>
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-center p-3 bg-zinc-800/50 rounded-lg">
              <div>
                <div className="text-2xl font-mono text-green-400">3</div>
                <div className="text-xs text-zinc-500">Active Agents</div>
              </div>
              <div>
                <div className="text-2xl font-mono text-blue-400">12,847</div>
                <div className="text-xs text-zinc-500">Tokens/hr</div>
              </div>
              <div>
                <div className="text-2xl font-mono text-yellow-400">42m</div>
                <div className="text-xs text-zinc-500">Avg TTL</div>
              </div>
            </div>

            {/* Agent cards */}
            <div className="space-y-2">
              {[
                { name: "code-review-bot", status: "active", ttl: "42m", quota: 26 },
                { name: "ci-pipeline-agent", status: "active", ttl: "18m", quota: 67 },
                { name: "data-extractor", status: "sandboxed", ttl: "5m", quota: 12 },
              ].map((agent) => (
                <div key={agent.name} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      agent.status === "active" && "bg-green-400",
                      agent.status === "sandboxed" && "bg-yellow-400",
                      agent.status === "revoked" && "bg-red-400"
                    )} />
                    <div>
                      <div className="font-mono text-sm">{agent.name}</div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          TTL: {agent.ttl}
                        </span>
                        <span>Quota: {agent.quota}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-white">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-white">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-red-400">
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Proxy Simulator */}
            <div className="border-t border-zinc-700 pt-3 mt-3">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs uppercase tracking-wider">Live Proxy Simulator</span>
                <span className="flex items-center gap-1 text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs">STREAMING</span>
                </span>
              </div>
              <div className="font-mono text-xs text-zinc-300 leading-relaxed">
                {terminalLines.map((line, i) => (
                  <div key={i} className={cn(
                    "transition-opacity duration-300",
                    line.startsWith("[✓]") && "text-green-400",
                    line.startsWith("[▶]") && "text-blue-400",
                    line.startsWith("[◀]") && "text-yellow-400",
                    line.includes("✓") && "text-green-400",
                    line.includes("ℹ") && "text-blue-400",
                    line === "" && "h-2"
                  )}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "diff" && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs uppercase tracking-wider">Environment Diff</span>
              <span className="text-xs">development → production</span>
            </div>

            <div className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-medium">1-Click Sync Available</span>
              <span className="ml-auto px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                12 missing • 3 mismatched
              </span>
            </div>

            <div className="space-y-2">
              {[
                { key: "OPENAI_API_KEY", status: "missing", source: "—", target: "sk-proj-***" },
                { key: "DATABASE_URL", status: "mismatch", source: "postgres://dev...", target: "postgres://prod..." },
                { key: "REDIS_URL", status: "missing", source: "—", target: "redis://prod..." },
                { key: "STRIPE_SECRET", status: "synced", source: "sk_live_***", target: "sk_live_***" },
                { key: "AWS_ACCESS_KEY", status: "synced", source: "AKIA***", target: "AKIA***" },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-3 p-2 bg-zinc-800/50 rounded-lg text-xs">
                  <span className="font-mono w-32 truncate">{item.key}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs font-medium",
                    item.status === "missing" && "bg-red-500/20 text-red-400",
                    item.status === "mismatch" && "bg-yellow-500/20 text-yellow-400",
                    item.status === "synced" && "bg-green-500/20 text-green-400"
                  )}>
                    {item.status}
                  </span>
                  <div className="flex-1 flex items-center gap-2 text-zinc-500">
                    <span className="font-mono">{item.source}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="font-mono">{item.target}</span>
                  </div>
                  {item.status !== "synced" && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-green-400 hover:text-green-300">
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button className="w-full mt-2" variant="default" size="sm">
              <Zap className="h-4 w-4 mr-2" />
              Sync Missing & Fix Mismatches (15 secrets)
            </Button>
          </div>
        )}

        {activeTab === "rollback" && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs uppercase tracking-wider">Rollback Vault</span>
              <span className="text-xs">v3 vs v2 comparison</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-green-400" />
                  <span className="font-medium text-green-400">v3 (Current)</span>
                </div>
                <div className="space-y-1 text-xs text-zinc-400">
                  <div className="flex justify-between"><span>AES-256-GCM</span><span className="text-green-400">✓</span></div>
                  <div className="flex justify-between"><span>Key rotation: Auto</span><span className="text-green-400">✓</span></div>
                  <div className="flex justify-between"><span>Snapshot encryption</span><span className="text-green-400">✓</span></div>
                  <div className="flex justify-between"><span>Zero-downtime rotate</span><span className="text-green-400">✓</span></div>
                  <div className="flex justify-between"><span>Audit trail</span><span className="text-green-400">✓</span></div>
                </div>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-yellow-400" />
                  <span className="font-medium text-yellow-400">v2 (Legacy)</span>
                </div>
                <div className="space-y-1 text-xs text-zinc-400">
                  <div className="flex justify-between"><span>AES-256-CBC</span><span className="text-red-400">✗</span></div>
                  <div className="flex justify-between"><span>Key rotation: Manual</span><span className="text-red-400">✗</span></div>
                  <div className="flex justify-between"><span>No snapshot encryption</span><span className="text-red-400">✗</span></div>
                  <div className="flex justify-between"><span>Downtime required</span><span className="text-red-400">✗</span></div>
                  <div className="flex justify-between"><span>Limited audit</span><span className="text-red-400">✗</span></div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Auto-migrated 47 projects</span>
              </div>
              <p className="text-xs text-zinc-400">
                All projects upgraded to v3 encryption. Zero secrets exposed during rotation.
                Master key fingerprint: <code className="font-mono">SHA256:9f86d081...</code>
              </p>
            </div>

            <Button variant="outline" className="w-full" size="sm">
              View Rotation History
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}