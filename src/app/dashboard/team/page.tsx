"use client";

import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  Plus,
  UserPlus,
  UserMinus,
  Shield,
  Key,
  Settings,
  Mail,
  Lock,
  Unlock,
  Crown,
  User,
  Eye,
  EyeOff,
  Copy,
  Check,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const roles = [
  { value: "owner", label: "Owner", description: "Full access to everything" },
  { value: "admin", label: "Admin", description: "Manage secrets, agents, team" },
  { value: "developer", label: "Developer", description: "Read/write secrets, invoke agents" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
  { value: "agent", label: "Agent", description: "Service account for automation" },
];

const environments = [
  { value: "development", label: "Development" },
  { value: "staging", label: "Staging" },
  { value: "production", label: "Production" },
];

const mockMembers = [
  { id: "1", name: "Alex Chen", email: "alex@company.com", role: "owner", allowedEnvs: ["development", "staging", "production"], avatar: null, lastActive: "2 min ago", isCurrentUser: true },
  { id: "2", name: "Sarah Johnson", email: "sarah@company.com", role: "admin", allowedEnvs: ["development", "staging", "production"], avatar: null, lastActive: "1 hour ago", isCurrentUser: false },
  { id: "3", name: "Mike Rodriguez", email: "mike@company.com", role: "developer", allowedEnvs: ["development", "staging"], avatar: null, lastActive: "3 hours ago", isCurrentUser: false },
  { id: "4", name: "Emma Wilson", email: "emma@company.com", role: "developer", allowedEnvs: ["development"], avatar: null, lastActive: "1 day ago", isCurrentUser: false },
  { id: "5", name: "David Kim", email: "david@company.com", role: "viewer", allowedEnvs: ["development"], avatar: null, lastActive: "2 days ago", isCurrentUser: false },
  { id: "6", name: "ci-bot", email: "ci-bot@company.com", role: "agent", allowedEnvs: ["staging", "production"], avatar: null, lastActive: "5 min ago", isCurrentUser: false },
];

const mockServiceAccounts = [
  { id: "svc-1", name: "GitHub Actions", tokenPrefix: "axm_svc_gha", lastFour: "8f2a", createdAt: "2024-01-10", isActive: true },
  { id: "svc-2", name: "Vercel Deploy", tokenPrefix: "axm_svc_ver", lastFour: "3b9e", createdAt: "2024-01-12", isActive: true },
  { id: "svc-3", name: "Data Pipeline", tokenPrefix: "axm_svc_dat", lastFour: "a1c4", createdAt: "2024-01-15", isActive: false },
];

export default function TeamPage() {
  const [showInviteDialog, setShowInviteDialog] = React.useState(false);
  const [showTokenDialog, setShowTokenDialog] = React.useState(false);
  const [newToken, setNewToken] = React.useState("");
  const [copied, setCopied] = React.useState<string | null>(null);
  const [removeId, setRemoveId] = React.useState<string | null>(null);
  const [roleUpdate, setRoleUpdate] = React.useState<{ memberId: string; newRole: string } | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const getRoleBadge = (role: string) => {
    const variantMap: Record<string, "purple" | "blue" | "green" | "zinc" | "orange"> = {
      owner: "purple",
      admin: "blue",
      developer: "green",
      viewer: "zinc",
      agent: "orange",
    };
    return (
      <Badge variant={variantMap[role] || "zinc"} className="gap-1">
        {role === "owner" && <Crown className="h-3 w-3" />}
        {role === "admin" && <Shield className="h-3 w-3" />}
        {role === "developer" && <User className="h-3 w-3" />}
        {role === "viewer" && <Eye className="h-3 w-3" />}
        {role === "agent" && <Key className="h-3 w-3" />}
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const isLastOwner = (memberId: string) => {
    const owners = mockMembers.filter(m => m.role === "owner");
    return owners.length === 1 && owners[0].id === memberId;
  };

  const canDemote = (member: typeof mockMembers[0], newRole: string) => {
    if (member.role === "owner" && newRole !== "owner") {
      return !isLastOwner(member.id);
    }
    return true;
  };

  const canRemove = (member: typeof mockMembers[0]) => {
    if (member.isCurrentUser) return false;
    if (member.role === "owner") return !isLastOwner(member.id);
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Team & RBAC
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage team members, roles, permissions, and service accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="invite-name">Name</Label>
                      <Input id="invite-name" placeholder="John Doe" />
                    </div>
                    <div>
                      <Label htmlFor="invite-email">Email</Label>
                      <Input id="invite-email" type="email" placeholder="john@company.com" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="invite-role">Role</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Allowed Environments</Label>
                    <div className="flex flex-wrap gap-2">
                      {environments.map((env) => (
                        <label key={env.value} className="inline-flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="rounded border-zinc-300" defaultChecked={env.value === "development"} />
                          <span className="text-sm">{env.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                  <Button onClick={() => setShowInviteDialog(false)}>Send Invitation</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Button>
          <Button variant="outline" asChild>
            <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Key className="h-4 w-4 mr-2" />
                  Create Service Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Service Account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="svc-name">Name</Label>
                    <Input id="svc-name" placeholder="GitHub Actions" />
                  </div>
                  <div>
                    <Label htmlFor="svc-env">Environment Access</Label>
                    <div className="flex flex-wrap gap-2">
                      {environments.map((env) => (
                        <label key={env.value} className="inline-flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="rounded border-zinc-300" defaultChecked />
                          <span className="text-sm">{env.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowTokenDialog(false)}>Cancel</Button>
                  <Button onClick={() => {
                    const token = `axm_svc_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 10)}`;
                    setNewToken(token);
                    setShowTokenDialog(false);
                    setShowTokenDialog(true);
                  }}>
                    Generate Token
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { name: "Total Members", value: "6", icon: Users, color: "text-blue-500" },
          { name: "Owners", value: "1", icon: Crown, color: "text-purple-500" },
          { name: "Service Accounts", value: "3", icon: Key, color: "text-orange-500" },
          { name: "Pending Invites", value: "0", icon: Mail, color: "text-gray-500" },
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

      {/* Team Members */}
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Environments</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={member.avatar || undefined} />
                          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name} {member.isCurrentUser && <span className="text-xs text-zinc-500 ml-1">(You)</span>}</p>
                          <p className="text-sm text-zinc-500">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={member.role} onValueChange={(value) => {
                        if (canDemote(member, value)) {
                          setRoleUpdate({ memberId: member.id, newRole: value });
                        }
                      }} disabled={!canDemote(member, "developer")}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.value} value={r.value} disabled={member.role === "owner" && r.value !== "owner" && isLastOwner(member.id)}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.allowedEnvs.map((env) => (
                          <Badge key={env} variant="outline" className="text-xs">{env}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">{member.lastActive}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {member.role === "agent" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => { /* generate token */ }}>
                                <Key className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Generate token</TooltipContent>
                          </Tooltip>
                        )}
                        {canRemove(member) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-500/10" onClick={() => setRemoveId(member.id)}>
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove member</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Service Accounts */}
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Service Accounts
          </CardTitle>
          <p className="text-sm text-zinc-500">Tokens: axm_svc_...</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockServiceAccounts.map((svc) => (
              <div key={svc.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{svc.name}</p>
                    <p className="text-sm text-zinc-500">Created {svc.createdAt} • {svc.isActive ? "Active" : "Inactive"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(`${svc.tokenPrefix}_****${svc.lastFour}`, svc.id)}>
                        {copied === svc.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy token prefix</TooltipContent>
                  </Tooltip>
                  <Button variant="ghost" size="icon" onClick={() => { setShowTokenDialog(true); }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Permission Matrix */}
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permission</TableHead>
                  {roles.map((r) => (
                    <TableHead key={r.value} className="text-center">
                      <Badge variant="outline" className="text-xs">{r.label}</Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { category: "Project", permissions: ["project:read", "project:write", "project:delete", "project:settings"] },
                  { category: "Secrets", permissions: ["secret:read", "secret:write", "secret:delete", "secret:rotate", "secret:rollback"] },
                  { category: "Agents", permissions: ["agent:read", "agent:write", "agent:delete", "agent:invoke", "agent:manage_secrets"] },
                  { category: "Environment", permissions: ["environment:manage", "environment:deploy"] },
                  { category: "Audit", permissions: ["audit:read", "audit:export"] },
                  { category: "Team", permissions: ["team:manage", "team:invite"] },
                ].map((cat) => (
                  <React.Fragment key={cat.category}>
                    <TableRow>
                      <TableCell className="font-medium text-zinc-500">{cat.category}</TableCell>
                      {roles.map((r) => (
                        <TableCell key={r.value} className="text-center">
                          {cat.permissions.some(p => {
                            const perms = {
                              "project:read": ["owner", "admin", "developer", "viewer"],
                              "project:write": ["owner", "admin", "developer"],
                              "project:delete": ["owner"],
                              "project:settings": ["owner", "admin"],
                              "secret:read": ["owner", "admin", "developer", "viewer"],
                              "secret:write": ["owner", "admin", "developer"],
                              "secret:delete": ["owner", "admin"],
                              "secret:rotate": ["owner", "admin", "developer"],
                              "secret:rollback": ["owner", "admin"],
                              "agent:read": ["owner", "admin", "developer", "viewer"],
                              "agent:write": ["owner", "admin", "developer"],
                              "agent:delete": ["owner", "admin"],
                              "agent:invoke": ["owner", "admin", "developer", "agent"],
                              "agent:manage_secrets": ["owner", "admin"],
                              "environment:manage": ["owner", "admin"],
                              "environment:deploy": ["owner", "admin", "developer"],
                              "audit:read": ["owner", "admin"],
                              "audit:export": ["owner", "admin"],
                              "team:manage": ["owner", "admin"],
                              "team:invite": ["owner", "admin"],
                            };
                            return perms[p as keyof typeof perms]?.includes(r.value);
                          }) ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-zinc-400 mx-auto" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke their access to the project. They will no longer be able to view or manage secrets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRemoveId(null)}>Cancel</AlertDialogAction>
            <AlertDialogAction onClick={() => setRemoveId(null)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Change Confirmation */}
      <AlertDialog open={!!roleUpdate} onOpenChange={() => setRoleUpdate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Role?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing a member's role will immediately update their permissions. This may affect their access to secrets and agents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRoleUpdate(null)}>Cancel</AlertDialogAction>
            <AlertDialogAction onClick={() => setRoleUpdate(null)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Service Account Token */}
      {newToken && (
        <AlertDialog open={true} onOpenChange={() => { setNewToken(""); setShowTokenDialog(false); }}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Service Account Created</AlertDialogTitle>
              <AlertDialogDescription>
                Your service account token will only be shown once. Copy and store it securely.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 my-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-zinc-500">Token</Label>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(newToken, "new-svc-token")}>
                  {copied === "new-svc-token" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <code className="font-mono text-sm break-all">{newToken}</code>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => { setNewToken(""); setShowTokenDialog(false); }}>I've copied it</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}