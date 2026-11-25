"use client";

import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  GitCompare,
  ArrowLeftRight,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  MinusCircle,
  ArrowUp,
  ArrowDown,
  Filter,
  Zap,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const environments = [
  { value: "development", label: "Development" },
  { value: "staging", label: "Staging" },
  { value: "production", label: "Production" },
];

const mockDiffs = [
  { key: "OPENAI_API_KEY", source: "sk-proj-dev...", target: "sk-proj-prod...", status: "mismatch", category: "AI / LLM" },
  { key: "DATABASE_URL", source: "postgres://dev...", target: "postgres://prod...", status: "mismatch", category: "Database" },
  { key: "REDIS_URL", source: "redis://dev:6379", target: "—", status: "missing_target", category: "Database" },
  { key: "STRIPE_SECRET_KEY", source: "sk_test_...", target: "sk_live_...", status: "mismatch", category: "API Key" },
  { key: "AWS_ACCESS_KEY_ID", source: "AKIA_DEV...", target: "AKIA_PROD...", status: "mismatch", category: "Cloud" },
  { key: "SENTRY_DSN", source: "—", target: "https://prod@sentry.io/123", status: "missing_source", category: "Infra" },
  { key: "SLACK_WEBHOOK_URL", source: "https://hooks.slack.com/dev", target: "https://hooks.slack.com/prod", status: "mismatch", category: "Infra" },
  { key: "GITHUB_TOKEN", source: "ghp_dev...", target: "ghp_prod...", status: "synced", category: "API Key" },
  { key: "VERCEL_TOKEN", source: "—", target: "vercel_prod...", status: "missing_source", category: "Cloud" },
  { key: "DATADOG_API_KEY", source: "datadog_dev...", target: "datadog_prod...", status: "synced", category: "Infra" },
];

export default function DiffPage() {
  const [sourceEnv, setSourceEnv] = React.useState("development");
  const [targetEnv, setTargetEnv] = React.useState("production");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [showValues, setShowValues] = React.useState<Record<string, boolean>>({});
  const [copied, setCopied] = React.useState<string | null>(null);
  const [confirmSync, setConfirmSync] = React.useState(false);
  const [syncMode, setSyncMode] = React.useState<"missing" | "mismatches" | "all">("missing");

  const filteredDiffs = mockDiffs.filter((diff) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "synced") return diff.status === "synced";
    if (statusFilter === "mismatch") return diff.status === "mismatch";
    if (statusFilter === "missing") return diff.status === "missing_source" || diff.status === "missing_target";
    return true;
  });

  const stats = {
    total: mockDiffs.length,
    synced: mockDiffs.filter(d => d.status === "synced").length,
    mismatched: mockDiffs.filter(d => d.status === "mismatch").length,
    missing: mockDiffs.filter(d => d.status === "missing_source" || d.status === "missing_target").length,
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    const variantMap: Record<string, string> = {
      synced: "green",
      mismatch: "yellow",
      missing_source: "red",
      missing_target: "red",
    };
    return (
      <Badge variant={variantMap[status] || "zinc"} className="text-xs gap-1">
        {status === "synced" && <CheckCircle className="h-3 w-3" />}
        {status === "mismatch" && <AlertCircle className="h-3 w-3" />}
        {status === "missing_source" && <MinusCircle className="h-3 w-3" />}
        {status === "missing_target" && <Plus className="h-3 w-3" />}
        {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
      </Badge>
    );
  };

  const handleBulkSync = (mode: "missing" | "mismatches" | "all") => {
    setSyncMode(mode);
    setConfirmSync(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <GitCompare className="h-8 w-8 text-primary" />
            Environment Diff
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Compare and synchronize secrets across environments
          </p>
        </div>
        <Button variant="outline" asChild>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Diff
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Refresh Comparison?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will re-fetch the latest secrets from both environments and recompute the diff.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => {}}>Cancel</AlertDialogAction>
                <AlertDialogAction onClick={() => {}}>Refresh</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { name: "Total Compared", value: stats.total, icon: GitCompare, color: "text-blue-500" },
          { name: "Synced", value: stats.synced, icon: CheckCircle, color: "text-green-500" },
          { name: "Mismatched", value: stats.mismatched, icon: AlertCircle, color: "text-yellow-500" },
          { name: "Missing", value: stats.missing, icon: MinusCircle, color: "text-red-500" },
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

      {/* Environment Selectors */}
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Source</Label>
                <Select value={sourceEnv} onValueChange={setSourceEnv}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {environments.map((env) => (
                      <SelectItem key={env.value} value={env.value}>{env.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => { const tmp = sourceEnv; setSourceEnv(targetEnv); setTargetEnv(tmp); }} aria-label="Swap environments">
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Swap source and target</TooltipContent>
              </Tooltip>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Target</Label>
                <Select value={targetEnv} onValueChange={setTargetEnv}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {environments.map((env) => (
                      <SelectItem key={env.value} value={env.value}>{env.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-zinc-400" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="mismatch">Mismatched</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-medium">Bulk Actions Available</p>
                <p className="text-sm text-zinc-500">
                  {stats.missing} missing • {stats.mismatched} mismatched
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="default"
                onClick={() => handleBulkSync("missing")}
                disabled={stats.missing === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Sync Missing ({stats.missing})
              </Button>
              <Button
                variant="outline"
                onClick={() => handleBulkSync("mismatches")}
                disabled={stats.mismatched === 0}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Fix Mismatches ({stats.mismatched})
              </Button>
              <Button
                variant="outline"
                onClick={() => handleBulkSync("all")}
                disabled={stats.missing + stats.mismatched === 0}
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Sync All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diff Table */}
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Differences
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            Showing {filteredDiffs.length} of {mockDiffs.length} secrets
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Secret</TableHead>
                  <TableHead className="w-[25%]">Source ({sourceEnv})</TableHead>
                  <TableHead className="w-[25%]">Target ({targetEnv})</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="w-[10%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDiffs.map((diff) => (
                  <TableRow key={diff.key}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{diff.key}</span>
                        <Badge variant="outline" className="text-xs">{diff.category}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm text-zinc-500 flex-1 truncate">
                          {diff.source === "—" ? <span className="text-zinc-400 italic">(not set)</span> : diff.source}
                        </div>
                        {diff.source !== "—" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(diff.source, `source-${diff.key}`)}>
                                {copied === `source-${diff.key}` ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy value</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm text-zinc-500 flex-1 truncate">
                          {diff.target === "—" ? <span className="text-zinc-400 italic">(not set)</span> : diff.target}
                        </div>
                        {diff.target !== "—" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(diff.target, `target-${diff.key}`)}>
                                {copied === `target-${diff.key}` ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy value</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(diff.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {diff.status !== "synced" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500 hover:bg-green-500/10" onClick={() => {}}>
                                {diff.status === "missing_target" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {diff.status === "missing_target" ? "Sync to target" : "Sync to source"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {diff.status === "mismatch" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500 hover:bg-blue-500/10" onClick={() => {}}>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Fix mismatch</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredDiffs.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium">All secrets are in sync!</h3>
              <p className="text-zinc-500 mt-1">No differences found between {sourceEnv} and {targetEnv}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Sync Confirmation */}
      <AlertDialog open={confirmSync} onOpenChange={() => setConfirmSync(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {syncMode === "missing" ? "Sync Missing Secrets" : syncMode === "mismatches" ? "Fix Mismatches" : "Full Sync"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {syncMode === "missing" && `This will copy ${stats.missing} missing secrets from ${sourceEnv} to ${targetEnv}.`}
              {syncMode === "mismatches" && `This will overwrite ${stats.mismatched} mismatched secrets in ${targetEnv} with values from ${sourceEnv}.`}
              {syncMode === "all" && `This will sync all ${stats.missing + stats.mismatched} differences (${stats.missing} missing, ${stats.mismatched} mismatched).`}
              This action will create new versions in the target environment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setConfirmSync(false)}>Cancel</AlertDialogAction>
            <AlertDialogAction onClick={() => { setConfirmSync(false); /* handle sync */ }}>
              {syncMode === "missing" ? "Sync Missing" : syncMode === "mismatches" ? "Fix Mismatches" : "Sync All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}