"use client";

import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Activity,
  Search,
  Filter,
  Download,
  Eye,
  ChevronDown,
  ChevronUp,
  FileText,
  Database,
  Key,
  Bot,
  Shield,
  Users,
  Globe,
  RotateCcw,
  Lock,
  Unlock,
  Trash2,
  Plus,
  Minus,
  Edit,
  Copy,
  Check,
  MoreVertical,
  Calendar,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  "SECRET_CREATED",
  "SECRET_READ",
  "SECRET_UPDATED",
  "SECRET_DELETED",
  "SECRET_ROLLBACK",
  "ENV_SYNC",
  "AGENT_TOKEN_ISSUED",
  "AGENT_ACCESS_GRANTED",
  "AGENT_KILLSWITCH_TRIGGERED",
  "KEY_ROTATION",
  "MFA_ENABLED",
  "MFA_DISABLED",
] as const;

const environments = [
  { value: "development", label: "Development" },
  { value: "staging", label: "Staging" },
  { value: "production", label: "Production" },
];

const mockLogs = [
  { id: "1", action: "SECRET_CREATED", resource: "OPENAI_API_KEY", environment: "production", user: "Alex Chen", email: "alex@company.com", time: "2024-01-15T10:30:00Z", details: "Created secret in AI / LLM category", ip: "192.168.1.1" },
  { id: "2", action: "ENV_SYNC", resource: "DATABASE_URL (dev → staging)", environment: "staging", user: "Sarah Johnson", email: "sarah@company.com", time: "2024-01-15T09:15:00Z", details: "Synced 5 secrets from development", ip: "192.168.1.2" },
  { id: "3", action: "AGENT_ACCESS_GRANTED", resource: "code-review-bot", environment: "development", user: "Mike Rodriguez", email: "mike@company.com", time: "2024-01-15T08:45:00Z", details: "Invoked agent with prompt length: 156", ip: "192.168.1.3" },
  { id: "4", action: "SECRET_UPDATED", resource: "STRIPE_SECRET_KEY", environment: "production", user: "Alex Chen", email: "alex@company.com", time: "2024-01-14T16:20:00Z", details: "Updated secret value and rotated version", ip: "192.168.1.1" },
  { id: "5", action: "AGENT_TOKEN_ISSUED", resource: "ci-pipeline-agent", environment: "staging", user: "Sarah Johnson", email: "sarah@company.com", time: "2024-01-14T14:10:00Z", details: "Created agent harness with token prefix: axm_cip", ip: "192.168.1.2" },
  { id: "6", action: "SECRET_ROLLBACK", resource: "AWS_ACCESS_KEY_ID", environment: "production", user: "Alex Chen", email: "alex@company.com", time: "2024-01-14T11:30:00Z", details: "Rolled back from v3 to v1 (new version: 4)", ip: "192.168.1.1" },
  { id: "7", action: "KEY_ROTATION", resource: "Master key v3", environment: "production", user: "Alex Chen", email: "alex@company.com", time: "2024-01-13T09:00:00Z", details: "Rotated master key, re-encrypted 247 secrets", ip: "192.168.1.1" },
  { id: "8", action: "MFA_ENABLED", resource: "Project settings", environment: "production", user: "Sarah Johnson", email: "sarah@company.com", time: "2024-01-13T08:45:00Z", details: "Enabled MFA requirement for production", ip: "192.168.1.2" },
  { id: "9", action: "SECRET_DELETED", resource: "OLD_API_KEY", environment: "development", user: "Mike Rodriguez", email: "mike@company.com", time: "2024-01-12T15:20:00Z", details: "Deleted deprecated secret", ip: "192.168.1.3" },
  { id: "10", action: "AGENT_KILLSWITCH_TRIGGERED", resource: "data-extractor", environment: "production", user: "Alex Chen", email: "alex@company.com", time: "2024-01-12T10:00:00Z", details: "Kill switch triggered: Compromised token", ip: "192.168.1.1" },
  { id: "11", action: "SECRET_READ", resource: "DATABASE_URL", environment: "production", user: "ci-bot", email: "ci-bot@company.com", time: "2024-01-15T10:25:00Z", details: "Agent accessed secret for deployment", ip: "10.0.0.1" },
  { id: "12", action: "ENV_SYNC", resource: "SLACK_WEBHOOK_URL (staging → prod)", environment: "production", user: "Sarah Johnson", email: "sarah@company.com", time: "2024-01-11T13:30:00Z", details: "Synced 1 secret to production", ip: "192.168.1.2" },
];

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  SECRET_CREATED: Plus,
  SECRET_READ: Eye,
  SECRET_UPDATED: Edit,
  SECRET_DELETED: Trash2,
  SECRET_ROLLBACK: RotateCcw,
  ENV_SYNC: Database,
  AGENT_TOKEN_ISSUED: Key,
  AGENT_ACCESS_GRANTED: Bot,
  AGENT_KILLSWITCH_TRIGGERED: Shield,
  KEY_ROTATION: RotateCcw,
  MFA_ENABLED: Lock,
  MFA_DISABLED: Unlock,
};

const actionColors: Record<string, string> = {
  SECRET_CREATED: "text-green-500 bg-green-500/10",
  SECRET_READ: "text-blue-500 bg-blue-500/10",
  SECRET_UPDATED: "text-yellow-500 bg-yellow-500/10",
  SECRET_DELETED: "text-red-500 bg-red-500/10",
  SECRET_ROLLBACK: "text-purple-500 bg-purple-500/10",
  ENV_SYNC: "text-indigo-500 bg-indigo-500/10",
  AGENT_TOKEN_ISSUED: "text-orange-500 bg-orange-500/10",
  AGENT_ACCESS_GRANTED: "text-cyan-500 bg-cyan-500/10",
  AGENT_KILLSWITCH_TRIGGERED: "text-red-500 bg-red-500/10",
  KEY_ROTATION: "text-purple-500 bg-purple-500/10",
  MFA_ENABLED: "text-green-500 bg-green-500/10",
  MFA_DISABLED: "text-red-500 bg-red-500/10",
};

export default function ActivityPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState<string>("all");
  const [envFilter, setEnvFilter] = React.useState<string>("all");
  const [copied, setCopied] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [exportFormat, setExportFormat] = React.useState<"json" | "csv">("json");

  const filteredLogs = mockLogs.filter((log) => {
    const matchesSearch = log.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesEnv = envFilter === "all" || log.environment === envFilter;
    return matchesSearch && matchesAction && matchesEnv;
  });

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleExport = () => {
    let content: string;
    let filename: string;
    
    if (exportFormat === "json") {
      content = JSON.stringify(filteredLogs, null, 2);
      filename = `axiom-audit-log-${new Date().toISOString().split("T")[0]}.json`;
    } else {
      const headers = ["ID", "Action", "Resource", "Environment", "User", "Email", "Time", "Details", "IP"];
      const rows = filteredLogs.map(log => [
        log.id,
        log.action,
        log.resource,
        log.environment,
        log.user,
        log.email,
        log.time,
        log.details,
        log.ip,
      ]);
      content = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
      filename = `axiom-audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    }
    
    const blob = new Blob([content], { type: exportFormat === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getEnvBadge = (env: string) => {
    return (
      <Badge variant={
        env === "production" ? "red" :
        env === "staging" ? "yellow" :
        env === "development" ? "green" : "zinc"
      } className="text-xs">
        {env}
      </Badge>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            Activity Audit
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Append-only audit log with filtering, search, and export
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export {exportFormat.toUpperCase()}
          </Button>
          <Select value={exportFormat} onValueChange={(v: "json" | "csv") => setExportFormat(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search by resource, user, or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-zinc-400" />
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>{action.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={envFilter} onValueChange={setEnvFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All environments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All environments</SelectItem>
                  {environments.map((env) => (
                    <SelectItem key={env.value} value={env.value}>{env.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-zinc-500">
              {filteredLogs.length} of {mockLogs.length} entries
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Table */}
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-zinc-400 mb-4" />
              <h3 className="text-lg font-medium">No activity found</h3>
              <p className="text-zinc-500 mt-1">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const Icon = actionIcons[log.action] || Activity;
                    const colorClass = actionColors[log.action] || "text-zinc-500 bg-zinc-500/10";
                    const isExpanded = expandedId === log.id;

                    return (
                      <React.Fragment key={log.id}>
                        <TableRow>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="text-sm font-mono whitespace-nowrap">
                            {formatTime(log.time)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("gap-1", colorClass)}>
                              <Icon className="h-3 w-3" />
                              {log.action.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm max-w-[200px] truncate">
                            {log.resource}
                          </TableCell>
                          <TableCell>{getEnvBadge(log.environment)}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{log.user}</p>
                              <p className="text-xs text-zinc-500">{log.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-zinc-500 max-w-[300px] truncate">
                            {log.details}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(JSON.stringify(log, null, 2), log.id)}>
                                  {copied === log.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy log entry</TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={9} className="p-0">
                              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 border-t border-zinc-200 dark:border-zinc-700">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <Label className="text-xs text-zinc-500">IP Address</Label>
                                    <p className="font-mono text-sm">{log.ip}</p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-zinc-500">Timestamp</Label>
                                    <p className="font-mono text-sm">{log.time}</p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-zinc-500">Action</Label>
                                    <p className="font-medium capitalize">{log.action.replace(/_/g, " ")}</p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-zinc-500">Resource</Label>
                                    <p className="font-mono text-sm">{log.resource}</p>
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label className="text-xs text-zinc-500">Details</Label>
                                    <p className="text-sm">{log.details}</p>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}