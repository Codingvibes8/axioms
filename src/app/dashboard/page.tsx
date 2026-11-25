"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Key,
  GitCompare,
  Bot,
  Users,
  Activity,
  Settings,
  Plus,
  TrendingUp,
  Clock,
  Shield,
  Zap,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  { name: "Total Secrets", value: "247", change: "+12%", icon: Key, color: "text-blue-500", bg: "bg-blue-500/10" },
  { name: "Environments", value: "3", change: "0%", icon: GitCompare, color: "text-green-500", bg: "bg-green-500/10" },
  { name: "Active Agents", value: "3", change: "+1", icon: Bot, color: "text-purple-500", bg: "bg-purple-500/10" },
  { name: "Team Members", value: "8", change: "+2", icon: Users, color: "text-orange-500", bg: "bg-orange-500/10" },
];

const quickActions = [
  { name: "Add Secret", href: "/dashboard/secrets?action=create", icon: Plus, description: "Create a new secret" },
  { name: "Sync Environments", href: "/dashboard/diff", icon: Zap, description: "Sync dev → staging" },
  { name: "Create Agent", href: "/dashboard/agents?action=create", icon: Bot, description: "Spin up AI agent" },
  { name: "Invite Member", href: "/dashboard/team?action=invite", icon: Users, description: "Add team member" },
];

const recentActivity = [
  { action: "Secret created", resource: "OPENAI_API_KEY", environment: "production", time: "2 min ago", type: "create" },
  { action: "Environment synced", resource: "dev → staging", environment: "staging", time: "15 min ago", type: "sync" },
  { action: "Agent invoked", resource: "code-review-bot", environment: "development", time: "1 hour ago", type: "agent" },
  { action: "Member invited", resource: "sarah@company.com", environment: "production", time: "3 hours ago", type: "team" },
  { action: "Key rotated", resource: "Master key v3", environment: "production", time: "1 day ago", type: "security" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Overview of your projects, secrets, and AI agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/secrets?action=create">
              <Plus className="h-4 w-4 mr-2" />
              Add Secret
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/agents?action=create">
              <Bot className="h-4 w-4 mr-2" />
              Create Agent
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="border-zinc-200 dark:border-zinc-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{stat.name}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={cn("p-3 rounded-xl", stat.bg)}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <TrendingUp className={cn("h-4 w-4", stat.change.startsWith("+") ? "text-green-500" : "text-zinc-400")} />
                <span className={cn("text-sm font-medium", stat.change.startsWith("+") ? "text-green-500" : "text-zinc-500")}>
                  {stat.change}
                </span>
                <span className="text-sm text-zinc-500">vs last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions + Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.name}
                    variant="outline"
                    className="h-auto p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    asChild
                  >
                    <Link href={action.href}>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary mt-0.5">
                          <action.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{action.name}</p>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">{action.description}</p>
                        </div>
                      </div>
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/activity">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      activity.type === "create" && "bg-green-500/10 text-green-500",
                      activity.type === "sync" && "bg-blue-500/10 text-blue-500",
                      activity.type === "agent" && "bg-purple-500/10 text-purple-500",
                      activity.type === "team" && "bg-orange-500/10 text-orange-500",
                      activity.type === "security" && "bg-red-500/10 text-red-500"
                    )}>
                      {activity.type === "create" && <Key className="h-4 w-4" />}
                      {activity.type === "sync" && <GitCompare className="h-4 w-4" />}
                      {activity.type === "agent" && <Bot className="h-4 w-4" />}
                      {activity.type === "team" && <Users className="h-4 w-4" />}
                      {activity.type === "security" && <Shield className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.action}</p>
                      <p className="text-xs text-zinc-500 truncate">{activity.resource}</p>
                    </div>
                    <span className="text-xs text-zinc-500 whitespace-nowrap">{activity.time}</span>
                    <span className={cn(
                      "px-2 py-0.5 text-xs rounded-full",
                      activity.environment === "production" && "bg-red-500/10 text-red-500",
                      activity.environment === "staging" && "bg-yellow-500/10 text-yellow-500",
                      activity.environment === "development" && "bg-green-500/10 text-green-500"
                    )}>
                      {activity.environment}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar widgets */}
        <div className="space-y-6">
          {/* Project Health */}
          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Project Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Secrets Encrypted</span>
                  <span className="font-medium text-green-500">100%</span>
                </div>
                <Progress value={100} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>MFA Enabled</span>
                  <span className="font-medium text-green-500">Active</span>
                </div>
                <Progress value={100} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Audit Coverage</span>
                  <span className="font-medium text-blue-500">94%</span>
                </div>
                <Progress value={94} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Key Rotation</span>
                  <span className="font-medium text-green-500">Auto (v3)</span>
                </div>
                <Progress value={100} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Environment Status */}
          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Environments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Development", secrets: 89, status: "healthy", color: "text-green-500" },
                { name: "Staging", secrets: 87, status: "sync_needed", color: "text-yellow-500" },
                { name: "Production", secrets: 71, status: "healthy", color: "text-blue-500" },
              ].map((env) => (
                <div key={env.name} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-2.5 w-2.5 rounded-full", env.color.replace("text-", "bg-"))} />
                    <div>
                      <p className="font-medium text-sm">{env.name}</p>
                      <p className="text-xs text-zinc-500">{env.secrets} secrets</p>
                    </div>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 text-xs rounded-full",
                    env.status === "healthy" && "bg-green-500/10 text-green-500",
                    env.status === "sync_needed" && "bg-yellow-500/10 text-yellow-500"
                  )}>
                    {env.status === "healthy" ? "Synced" : "Sync needed"}
                  </span>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-2" size="sm" asChild>
                <Link href="/dashboard/diff">View Diff & Sync</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Agent Status */}
          <Card className="border-zinc-200 dark:border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Agents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "code-review-bot", status: "active", ttl: "42m", quota: "26%" },
                { name: "ci-pipeline-agent", status: "active", ttl: "18m", quota: "67%" },
                { name: "data-extractor", status: "sandboxed", ttl: "5m", quota: "12%" },
              ].map((agent) => (
                <div key={agent.name} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      agent.status === "active" && "bg-green-500",
                      agent.status === "sandboxed" && "bg-yellow-500",
                      agent.status === "revoked" && "bg-red-500"
                    )} />
                    <div>
                      <p className="font-medium text-sm font-mono">{agent.name}</p>
                      <p className="text-xs text-zinc-500">TTL: {agent.ttl} • Quota: {agent.quota}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 text-xs rounded-full",
                    agent.status === "active" && "bg-green-500/10 text-green-500",
                    agent.status === "sandboxed" && "bg-yellow-500/10 text-yellow-500",
                    agent.status === "revoked" && "bg-red-500/10 text-red-500"
                  )}>
                    {agent.status}
                  </span>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-2" size="sm" asChild>
                <Link href="/dashboard/agents">Manage Agents</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}