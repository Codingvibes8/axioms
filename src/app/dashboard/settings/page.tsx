"use client";

import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Settings,
  Shield,
  Key,
  RotateCcw,
  Lock,
  Unlock,
  Bell,
  Globe,
  Database,
  Zap,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  Download,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Server,
  HardDrive,
  Cpu,
  MemoryStick,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const webhookTypes = [
  { id: "slack", name: "Slack", icon: Globe, color: "text-purple-500" },
  { id: "discord", name: "Discord", icon: Globe, color: "text-blue-500" },
  { id: "pagerduty", name: "PagerDuty", icon: Bell, color: "text-red-500" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState("general");
  const [masterKeyFingerprint, setMasterKeyFingerprint] = React.useState("SHA256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
  const [showNewFingerprint, setShowNewFingerprint] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [confirmRotation, setConfirmRotation] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [mfaEnabled, setMfaEnabled] = React.useState(true);
  const [firewallEnabled, setFirewallEnabled] = React.useState(true);
  const [auditRetention, setAuditRetention] = React.useState(90);
  const [autoBackup, setAutoBackup] = React.useState(true);
  const [slackWebhook, setSlackWebhook] = React.useState("");
  const [discordWebhook, setDiscordWebhook] = React.useState("");
  const [pagerdutyKey, setPagerdutyKey] = React.useState("");

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRotation = () => {
    const newFingerprint = `SHA256:${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
    setShowNewFingerprint(newFingerprint);
    setConfirmRotation(false);
    setTimeout(() => {
      setMasterKeyFingerprint(newFingerprint);
      setShowNewFingerprint(null);
    }, 2000);
  };

  const handleSave = () => {
    setDirty(false);
    // Save to backend
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8 text-primary" />
            Settings & KMS
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Configure project settings, master key rotation, webhooks, and security policies
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button onClick={handleSave} className="bg-primary">
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          )}
          <Button variant="outline" onClick={() => {}}>
            <Download className="h-4 w-4 mr-2" />
            Export Config
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="kms">KMS & Encryption</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Project Information
              </CardTitle>
              <CardDescription>Basic project details and configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input id="project-name" defaultValue="Axiom Core" onChange={() => setDirty(true)} />
                </div>
                <div>
                  <Label htmlFor="project-slug">Slug</Label>
                  <Input id="project-slug" defaultValue="axiom-core" onChange={() => setDirty(true)} />
                </div>
              </div>
              <div>
                <Label htmlFor="project-description">Description</Label>
                <Input id="project-description" defaultValue="Core secrets management for AI agents" onChange={() => setDirty(true)} />
              </div>
              <div>
                <Label htmlFor="encryption-algo">Encryption Algorithm</Label>
                <Select value="AES-256-GCM" onValueChange={() => setDirty(true)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AES-256-GCM">AES-256-GCM</SelectItem>
                    <SelectItem value="AES-256-CBC">AES-256-CBC (Legacy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Backup</Label>
                  <p className="text-sm text-zinc-500">Automatically backup encrypted secrets daily</p>
                </div>
                <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Audit Log Retention
              </CardTitle>
              <CardDescription>How long to keep audit logs before automatic cleanup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="retention-days">Retention Period (days)</Label>
                  <Input
                    id="retention-days"
                    type="number"
                    min="30"
                    max="365"
                    value={auditRetention}
                    onChange={(e) => { setAuditRetention(parseInt(e.target.value) || 90); setDirty(true); }}
                    className="w-32"
                  />
                </div>
                <div className="text-sm text-zinc-500">
                  Current: {auditRetention} days
                </div>
              </div>
              <Progress value={(auditRetention / 365) * 100} className="h-2" />
              <div className="flex items-center justify-between text-sm text-zinc-500">
                <span>30 days (minimum)</span>
                <span>365 days (maximum)</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KMS & Encryption Tab */}
        <TabsContent value="kms" className="space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Master Key Management
              </CardTitle>
              <CardDescription>Rotate the master encryption key. All secrets will be re-encrypted with the new key.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Current Master Key Fingerprint</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(masterKeyFingerprint, "fingerprint")}>
                        {copied === "fingerprint" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy fingerprint</TooltipContent>
                  </Tooltip>
                </div>
                <code className="font-mono text-sm break-all text-green-500">{masterKeyFingerprint}</code>
                <p className="text-xs text-zinc-500 mt-1">SHA-256 fingerprint of the current master key</p>
              </div>

              <AlertDialog open={confirmRotation} onOpenChange={setConfirmRotation}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" onClick={() => setConfirmRotation(true)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Rotate Master Key
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rotate Master Key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will generate a new master key and re-encrypt all {247} secrets across all environments.
                      The operation is zero-downtime but cannot be undone. Previous key fingerprint will be archived.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setConfirmRotation(false)}>Cancel</AlertDialogAction>
                    <AlertDialogAction onClick={handleRotation}>Rotate Key</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {showNewFingerprint && (
                <AlertDialog open={true} onOpenChange={() => setShowNewFingerprint(null)}>
                  <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Key Rotation Complete</AlertDialogTitle>
                      <AlertDialogDescription>
                        New master key generated. All secrets have been re-encrypted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 my-4">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-zinc-500">New Fingerprint</Label>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(showNewFingerprint!, "new-fingerprint")}>
                          {copied === "new-fingerprint" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <code className="font-mono text-sm break-all text-green-500">{showNewFingerprint}</code>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogAction onClick={() => setShowNewFingerprint(null)}>Done</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Encryption Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { name: "Algorithm", value: "AES-256-GCM", icon: Shield, status: "secure", color: "text-green-500" },
                  { name: "Key Version", value: "v3 (Current)", icon: Key, status: "current", color: "text-blue-500" },
                  { name: "Secrets Encrypted", value: "247/247", icon: Lock, status: "complete", color: "text-green-500" },
                ].map((item) => (
                  <div key={item.name} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">{item.name}</p>
                        <p className="font-medium">{item.value}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("mt-2", item.color.replace("text-", "bg-").replace("text-", "border-") + "/10")}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Policies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require MFA for Production</Label>
                  <p className="text-sm text-zinc-500">Enforce multi-factor authentication for production environment access</p>
                </div>
                <Switch checked={mfaEnabled} onCheckedChange={setMfaEnabled} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Agent Proxy Firewall</Label>
                  <p className="text-sm text-zinc-500">Restrict agent outbound connections to allowlisted domains only</p>
                </div>
                <Switch checked={firewallEnabled} onCheckedChange={setFirewallEnabled} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Network & Proxy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Allowed Proxy Domains</Label>
                <p className="text-sm text-zinc-500 mb-2">Domains that agents can connect to through the proxy</p>
                <div className="flex flex-wrap gap-2">
                  {["api.anthropic.com", "api.openai.com", "api.github.com", "hooks.slack.com", "api.stripe.com"].map((domain) => (
                    <Badge key={domain} variant="outline" className="text-xs">{domain}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Blocked Domains</Label>
                <p className="text-sm text-zinc-500 mb-2">Domains explicitly blocked for agent connections</p>
                <Badge variant="outline" className="text-xs">(none configured)</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Infrastructure Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { name: "Neon PostgreSQL", status: "healthy", icon: Database, color: "text-green-500", details: "Connected • 12ms latency" },
                  { name: "Redis Cache", status: "healthy", icon: Cpu, color: "text-green-500", details: "Connected • 3ms latency" },
                  { name: "Encryption Service", status: "healthy", icon: Shield, color: "text-green-500", details: "AES-256-GCM active" },
                  { name: "Audit Log Store", status: "healthy", icon: HardDrive, color: "text-green-500", details: "94% capacity • 90-day retention" },
                ].map((item) => (
                  <div key={item.name} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", item.color.replace("text-", "bg-") + "/10")}>
                        <item.icon className={cn("h-5 w-5", item.color)} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-zinc-500">{item.details}</p>
                      </div>
                    </div>
                    <Badge variant={
                      item.status === "healthy" ? "green" :
                      item.status === "degraded" ? "yellow" :
                      item.status === "down" ? "red" : "zinc"
                    }>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Webhook Integrations
              </CardTitle>
              <CardDescription>Configure webhooks for audit events, secret changes, and agent activity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {webhookTypes.map((webhook) => (
                <div key={webhook.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn("p-2 rounded-lg", webhook.color.replace("text-", "bg-") + "/10")}>
                        <webhook.icon className={cn("h-5 w-5", webhook.color)} />
                      </div>
                      <div>
                        <p className="font-medium">{webhook.name}</p>
                        <p className="text-sm text-zinc-500">Webhook URL for event notifications</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={`https://hooks.${webhook.id}.com/...`}
                        value={webhook.id === "slack" ? slackWebhook : webhook.id === "discord" ? discordWebhook : pagerdutyKey}
                        onChange={(e) => {
                          if (webhook.id === "slack") setSlackWebhook(e.target.value);
                          else if (webhook.id === "discord") setDiscordWebhook(e.target.value);
                          else setPagerdutyKey(e.target.value);
                          setDirty(true);
                        }}
                        className="w-80"
                      />
                      <Button variant="outline" size="sm">Test</Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Event Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  "SECRET_CREATED",
                  "SECRET_UPDATED",
                  "SECRET_DELETED",
                  "ENV_SYNC",
                  "AGENT_TOKEN_ISSUED",
                  "AGENT_KILLSWITCH_TRIGGERED",
                  "KEY_ROTATION",
                  "MFA_ENABLED",
                ].map((event) => (
                  <label key={event} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg cursor-pointer">
                    <input type="checkbox" className="rounded border-zinc-300" defaultChecked />
                    <span className="text-sm font-mono">{event}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Danger Zone */}
      <Card className="border-red-500/20 dark:border-red-900/20 bg-red-500/5 dark:bg-red-900/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible destructive actions. Proceed with extreme caution.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Reset Project to Seed State</p>
              <p className="text-sm text-zinc-500">Delete all secrets, agents, team members, and activity logs. Restore project to initial state.</p>
            </div>
            <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" onClick={() => setConfirmReset(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset Project
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will PERMANENTLY DELETE all secrets, agents, team members, audit logs, and settings.
                    This action CANNOT BE UNDONE. Type "RESET" to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4">
                  <Input placeholder='Type "RESET" to confirm' />
                </div>
                <AlertDialogFooter>
                  <AlertDialogAction onClick={() => setConfirmReset(false)}>Cancel</AlertDialogAction>
                  <AlertDialogAction onClick={() => setConfirmReset(false)}>Reset Project</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}