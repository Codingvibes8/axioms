"use client";

import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Eye,
  EyeOff,
  Copy,
  RotateCcw,
  Clock,
  Trash2,
  Settings,
  ChevronDown,
  ChevronUp,
  Key,
  Database,
  Globe,
  Lock,
  Zap,
  Server,
  Layers,
  Box,
  FileText,
  Check,
  X,
  Loader2,
  Shield,
  FlaskConical,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";

const categories = [
  "API Key",
  "Database",
  "OAuth",
  "AI / LLM",
  "Cloud",
  "Infra",
  "General",
];

const environments = [
  { value: "development", label: "Development" },
  { value: "staging", label: "Staging" },
  { value: "production", label: "Production" },
];

const mockSecrets = [
  { id: "1", key: "OPENAI_API_KEY", value: "sk-proj-abc123...", environment: "production", category: "AI / LLM", version: 3, updatedAt: "2024-01-15", tags: ["llm", "openai"] },
  { id: "2", key: "DATABASE_URL", value: "postgres://prod...", environment: "production", category: "Database", version: 5, updatedAt: "2024-01-14", tags: ["postgres", "primary"] },
  { id: "3", key: "STRIPE_SECRET_KEY", value: "sk_live_abc...", environment: "production", category: "API Key", version: 2, updatedAt: "2024-01-10", tags: ["payments"] },
  { id: "4", key: "REDIS_URL", value: "redis://staging...", environment: "staging", category: "Database", version: 1, updatedAt: "2024-01-12", tags: ["cache"] },
  { id: "5", key: "AWS_ACCESS_KEY_ID", value: "AKIA...", environment: "production", category: "Cloud", version: 1, updatedAt: "2024-01-08", tags: ["aws", "s3"] },
  { id: "6", key: "GITHUB_TOKEN", value: "ghp_abc...", environment: "development", category: "API Key", version: 4, updatedAt: "2024-01-16", tags: ["ci", "github"] },
  { id: "7", key: "SENTRY_DSN", value: "https://abc@sentry.io/123", environment: "production", category: "Infra", version: 1, updatedAt: "2024-01-05", tags: ["monitoring"] },
  { id: "8", key: "SLACK_WEBHOOK_URL", value: "https://hooks.slack.com/...", environment: "staging", category: "Infra", version: 1, updatedAt: "2024-01-03", tags: ["notifications"] },
];

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "API Key": Key,
  "Database": Database,
  "OAuth": Globe,
  "AI / LLM": Zap,
  "Cloud": Server,
  "Infra": Layers,
  "General": Box,
};

export default function SecretsPage() {
  const [activeTab, setActiveTab] = React.useState("table");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [selectedEnvironment, setSelectedEnvironment] = React.useState<string>("all");
  const [showValues, setShowValues] = React.useState<Record<string, boolean>>({});
  const [copied, setCopied] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [importText, setImportText] = React.useState("");

  const filteredSecrets = mockSecrets.filter((secret) => {
    const matchesSearch = secret.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      secret.value.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || secret.category === selectedCategory;
    const matchesEnv = selectedEnvironment === "all" || secret.environment === selectedEnvironment;
    return matchesSearch && matchesCategory && matchesEnv;
  });

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const getCategoryIcon = (category: string) => {
    const Icon = categoryIcons[category] || Box;
    return <Icon className="h-3.5 w-3.5" />;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Key className="h-8 w-8 text-primary" />
            Secrets Vault
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage secrets across environments with version control, rollback, and audit trail
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Import
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Bulk Import Secrets</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="import-env">Environment</Label>
                    <Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select environment" />
                      </SelectTrigger>
                      <SelectContent>
                        {environments.map((env) => (
                          <SelectItem key={env.value} value={env.value}>{env.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="import-text">Paste .env content</Label>
                    <textarea
                      id="import-text"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      className="w-full min-h-[200px] p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-zinc-50 dark:bg-zinc-800 font-mono text-sm"
                      placeholder="# Example .env format
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgres://...
STRIPE_SECRET_KEY=sk_live_..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancel</Button>
                  <Button onClick={() => { /* handle import */ setIsImportOpen(false); }}>Import Secrets</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export .env
          </Button>
          <Button asChild>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Secret
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Secret</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="secret-key">Key</Label>
                      <Input id="secret-key" placeholder="API_KEY" />
                    </div>
                    <div>
                      <Label htmlFor="secret-env">Environment</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                        <SelectContent>
                          {environments.map((env) => (
                            <SelectItem key={env.value} value={env.value}>{env.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="secret-value">Value</Label>
                    <Input id="secret-value" type="password" placeholder="Enter secret value" />
                  </div>
                  <div>
                    <Label htmlFor="secret-category">Category</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="secret-description">Description (optional)</Label>
                    <Input id="secret-description" placeholder="Description..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {}}>Cancel</Button>
                  <Button onClick={() => {}}>Create Secret</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { name: "Total Secrets", value: "247", icon: Key, color: "text-blue-500" },
          { name: "Production", value: "89", icon: Shield, color: "text-red-500" },
          { name: "Staging", value: "78", icon: FlaskConical, color: "text-yellow-500" },
          { name: "Development", value: "80", icon: Code, color: "text-green-500" },
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

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search secrets by key, value, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
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
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="cards">Card View</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <div className="overflow-x-auto mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Secret</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSecrets.map((secret) => (
                  <TableRow key={secret.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-primary/10 rounded text-primary">
                          {getCategoryIcon(secret.category)}
                        </div>
                        <div>
                          <p className="font-mono font-medium">{secret.key}</p>
                          <p className="text-xs text-zinc-500">v{secret.version} • {secret.tags.join(", ")}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getEnvBadge(secret.environment)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{secret.category}</Badge>
                    </TableCell>
                    <TableCell><span className="font-mono text-sm">v{secret.version}</span></TableCell>
                    <TableCell className="text-zinc-500 text-sm">{secret.updatedAt}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(secret.value, secret.id)}>
                              {copied === secret.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy value</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setShowValues({ ...showValues, [secret.id]: !showValues[secret.id] })}>
                              {showValues[secret.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{showValues[secret.id] ? "Hide" : "Reveal"}</TooltipContent>
                        </Tooltip>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {}}>View history</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>Rollback version</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {}}>Rotate value</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>Sync to environment</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(secret.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="cards">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
            {filteredSecrets.map((secret) => (
              <Card key={secret.id} className="border-zinc-200 dark:border-zinc-700">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        {getCategoryIcon(secret.category)}
                      </div>
                      <div>
                        <p className="font-mono font-medium text-sm">{secret.key}</p>
                        <p className="text-xs text-zinc-500 flex items-center gap-2">
                          <span>v{secret.version}</span>
                          {getEnvBadge(secret.environment)}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {}}>View history</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {}}>Rollback version</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {}}>Rotate value</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {}}>Sync to environment</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(secret.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-xs text-zinc-500">Value</Label>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(secret.value, secret.id)}>
                        {copied === secret.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowValues({ ...showValues, [secret.id]: !showValues[secret.id] })}>
                        {showValues[secret.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="font-mono text-sm bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg break-all">
                      {showValues[secret.id] ? secret.value : "••••••••••••••••"}
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500">
                      <span>{secret.tags.map(t => `#${t}`).join(" ")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Empty state */}
      {filteredSecrets.length === 0 && (
        <Card className="border-zinc-200 dark:border-zinc-700 py-12 text-center">
          <CardContent>
            <FileText className="h-12 w-12 mx-auto text-zinc-400 mb-4" />
            <h3 className="text-lg font-medium">No secrets found</h3>
            <p className="text-zinc-500 mt-1">Get started by adding your first secret</p>
            <Button className="mt-4" asChild>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Secret
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create New Secret</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="secret-key">Key</Label>
                        <Input id="secret-key" placeholder="API_KEY" />
                      </div>
                      <div>
                        <Label htmlFor="secret-env">Environment</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select environment" />
                          </SelectTrigger>
                          <SelectContent>
                            {environments.map((env) => (
                              <SelectItem key={env.value} value={env.value}>{env.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="secret-value">Value</Label>
                      <Input id="secret-value" type="password" placeholder="Enter secret value" />
                    </div>
                    <div>
                      <Label htmlFor="secret-category">Category</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="secret-description">Description (optional)</Label>
                      <Input id="secret-description" placeholder="Description..." />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button>Create Secret</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Secret?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The secret and all its versions will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDeleteId(null)}>Cancel</AlertDialogAction>
            <AlertDialogAction onClick={() => setDeleteId(null)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}