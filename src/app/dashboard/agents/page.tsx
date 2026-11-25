"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  Plus,
  Copy,
  RotateCcw,
  Clock,
  Trash2,
  Shield,
  Zap,
  Settings,
  Check,
  X,
  Loader2,
  Terminal,
  Square,
  Circle,
  Activity,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Key,
  Database,
  Globe,
  Lock,
  Server,
  Layers,
  Box,
  FileText,
  Minus,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const agentTypes = [
  "Autonomous Agent",
  "Coding Assistant",
  "CI/CD Pipeline",
  "Data Extractor",
  "Customer Support Bot",
];

const modelProviders = [
  "OpenAI",
  "Anthropic",
  "Google Gemini",
  "DeepSeek",
  "Custom LLM",
];

const mockAgents = [
  {
    id: "1",
    name: "code-review-bot",
    description: "Automated code review for PRs",
    modelProvider: "Anthropic",
    agentType: "Coding Assistant",
    environment: "development",
    status: "active",
    ttlMinutes: 42,
    quotaUsed: 26,
    quotaLimit: 50000,
    allowedSecrets: ["OPENAI_API_KEY", "GITHUB_TOKEN", "SLACK_WEBHOOK_URL"],
    tokenPrefix: "axm_cod",
    tokenLastFour: "7f2a",
  },
  {
    id: "2",
    name: "ci-pipeline-agent",
    description: "Runs CI/CD pipelines with secret injection",
    modelProvider: "OpenAI",
    agentType: "CI/CD Pipeline",
    environment: "staging",
    status: "active",
    ttlMinutes: 18,
    quotaUsed: 67,
    quotaLimit: 100000,
    allowedSecrets: ["DATABASE_URL", "AWS_ACCESS_KEY", "VERCEL_TOKEN"],
    tokenPrefix: "axm_cip",
    tokenLastFour: "3b9e",
  },
  {
    id: "3",
    name: "data-extractor",
    description: "Extracts data from APIs",
    modelProvider: "Google Gemini",
    agentType: "Data Extractor",
    environment: "production",
    status: "sandboxed",
    ttlMinutes: 5,
    quotaUsed: 12,
    quotaLimit: 25000,
    allowedSecrets: ["STRIPE_SECRET_KEY", "DATADOG_API_KEY"],
    tokenPrefix: "axm_dat",
    tokenLastFour: "a1c4",
  },
];

const terminalOutput = [
  "[$] axiom proxy start --agent=code-review-bot",
  "[✓] Connected to agent harness: code-review-bot",
  "[✓] Token validated: axm_cod_****7f2a",
  "[✓] Secrets injected: 3/3 (OPENAI_API_KEY, GITHUB_TOKEN, SLACK_WEBHOOK_URL)",
  "[✓] Proxy firewall: ENABLED (allowlist: api.anthropic.com, api.github.com, hooks.slack.com)",
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
];

export default function AgentsPage() {
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [showToken, setShowToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [killSwitchId, setKillSwitchId] = React.useState<string | null>(null);
  const [terminalLines, setTerminalLines] = React.useState<string[]>([]);
  const [terminalIndex, setTerminalIndex] = React.useState(0);

  // Simulate terminal output
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < terminalOutput.length) {
        setTerminalLines(prev => [...prev, terminalOutput[i]]);
        i++;
      } else {
        clearInterval(interval);
        // Restart after delay
        setTimeout(() => {
          setTerminalLines([]);
          i = 0;
        }, 5000);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    const variantMap: Record<string, "green" | "yellow" | "red" | "orange" | "zinc"> = {
      active: "green",
      sandboxed: "yellow",
      revoked: "red",
      rate_limited: "orange",
    };
    return (
      <Badge variant={variantMap[status] || "zinc"} className="gap-1">
        {status === "active" && <Circle className="h-2 w-2 bg-green-500" />}
        {status === "sandboxed" && <Circle className="h-2 w-2 bg-yellow-500" />}
        {status === "revoked" && <Circle className="h-2 w-2 bg-red-500" />}
        {status === "rate_limited" && <Circle className="h-2 w-2 bg-orange-500" />}
        {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
      </Badge>
    );
  };

  const formatTTL = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            AI Agent Harness
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage ephemeral agent tokens, quotas, killswitches, and live proxy simulation
          </p>
        </div>
        <Button asChild>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Agent Harness</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="agent-name">Name</Label>
                    <Input id="agent-name" placeholder="code-review-bot" />
                  </div>
                  <div>
                    <Label htmlFor="agent-provider">Model Provider</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelProviders.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="agent-type">Agent Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {agentTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="agent-env">Environment</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select environment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="agent-ttl">TTL (minutes)</Label>
                    <Input id="agent-ttl" type="number" defaultValue="60" min="5" max="10080" />
                  </div>
                  <div>
                    <Label htmlFor="agent-quota">Token Limit/hour</Label>
                    <Input id="agent-quota" type="number" defaultValue="50000" min="1000" max="1000000" />
                  </div>
                </div>
                <div>
                  <Label>Allowed Secrets</Label>
                  <div className="flex flex-wrap gap-2">
                    {["OPENAI_API_KEY", "DATABASE_URL", "STRIPE_SECRET_KEY", "GITHUB_TOKEN", "AWS_ACCESS_KEY", "SLACK_WEBHOOK_URL"].map((secret) => (
                      <Badge key={secret} variant="outline" className="cursor-pointer hover:bg-primary/10">{secret}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button onClick={() => { setShowCreateDialog(false); setShowToken("axm_new_abcdef123456"); }}>
                  Create Agent
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { name: "Total Agents", value: "3", icon: Bot, color: "text-blue-500" },
          { name: "Active", value: "2", icon: Activity, color: "text-green-500" },
          { name: "Total Tokens/hr", value: "175,000", icon: Zap, color: "text-yellow-500" },
          { name: "Sandboxed", value: "1", icon: Shield, color: "text-yellow-500" },
        ].map((stat) => (
          <Card key={stat.name} className="border-zinc-200 dark:border-zinc-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{stat.name}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Cards */}
      <div className="space-y-4">
        {mockAgents.map((agent) => (
          <Card key={agent.id} className="border-zinc-200 dark:border-zinc-700">
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Agent Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg font-mono">{agent.name}</h3>
                      {getStatusBadge(agent.status)}
                      <Badge variant="outline" className="text-xs">{agent.modelProvider}</Badge>
                      <Badge variant="outline" className="text-xs">{agent.agentType}</Badge>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">{agent.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        TTL: {formatTTL(agent.ttlMinutes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="h-4 w-4" />
                        Quota: {agent.quotaUsed}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Server className="h-4 w-4" />
                        {agent.environment}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quota Bar */}
                <div className="hidden lg:block w-48">
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                    <span>Token Quota</span>
                    <span>{agent.quotaUsed}%</span>
                  </div>
                  <Progress value={agent.quotaUsed} className="h-2" />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 lg:ml-auto">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(`${agent.tokenPrefix}_****${agent.tokenLastFour}`, agent.id)}>
                        {copied === agent.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy token alias</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => { /* rotate */ }}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Rotate token</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => { /* extend TTL */ }}>
                        <Clock className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Extend TTL +60m</TooltipContent>
                  </Tooltip>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { /* change status */ }}>Status: {agent.status}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setKillSwitchId(agent.id)}>
                        <Shield className="mr-2 h-4 w-4 text-red-500" />
                        Trigger Kill Switch
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(agent.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />Delete Agent
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Allowed Secrets */}
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-zinc-500">Allowed Secrets</Label>
                  <span className="text-xs text-zinc-500">{agent.allowedSecrets.length} secrets</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {agent.allowedSecrets.map((secret) => (
                    <Badge key={secret} variant="outline" className="text-xs">{secret}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Proxy Simulator */}
      <Card className="border-zinc-200 dark:border-zinc-700 sticky bottom-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Live Proxy Simulator
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-green-500 text-sm">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              STREAMING
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-xs text-zinc-300 bg-zinc-950 rounded-lg p-4 max-h-64 overflow-y-auto">
            {terminalLines.map((line, i) => (
              <div key={i} className={cn(
                "transition-opacity duration-300",
                line.startsWith("[✓]") && "text-green-400",
                line.startsWith("[▶]") && "text-blue-400",
                line.startsWith("[◀]") && "text-yellow-400",
                line.includes("✓") && "text-green-400",
                line.includes("ℹ") && "text-blue-400",
                line === "" && "h-3"
              )}>
                {line}
              </div>
            ))}
            {terminalLines.length === 0 && (
              <div className="text-zinc-500 text-center py-8">
                <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Waiting for agent activity...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Agent Token Reveal */}
      {showToken && (
        <AlertDialog open={true} onOpenChange={() => setShowToken(null)}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Agent Created Successfully</AlertDialogTitle>
              <AlertDialogDescription>
                Your agent token will only be shown once. Copy and store it securely.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 my-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-zinc-500">Token</Label>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(showToken!, "new-token")}>
                  {copied === "new-token" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <code className="font-mono text-sm break-all">{showToken}</code>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowToken(null)}>I've copied it</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently revoke the agent and delete its token. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDeleteId(null)}>Cancel</AlertDialogAction>
            <AlertDialogAction onClick={() => setDeleteId(null)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kill Switch Confirmation */}
      <AlertDialog open={!!killSwitchId} onOpenChange={() => setKillSwitchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trigger Kill Switch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke the agent's token and block all future requests. The agent will be marked as "revoked".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setKillSwitchId(null)}>Cancel</AlertDialogAction>
            <AlertDialogAction onClick={() => setKillSwitchId(null)}>Trigger Kill Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}