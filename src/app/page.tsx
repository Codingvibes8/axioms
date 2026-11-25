"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConsolePreview } from "@/components/landing/console-preview";
import {
  Shield,
  Key,
  GitCompare,
  Bot,
  Users,
  Activity,
  Settings,
  Zap,
  Globe,
  Lock,
  Terminal,
  ArrowRight,
  Check,
  Copy,
  CheckCircle,
  ExternalLink,
  GitBranch,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Shield,
    title: "Zero-Trust Architecture",
    description: "End-to-end encryption with AES-256-GCM. Secrets never leave your infrastructure unencrypted. Master key rotation without downtime.",
  },
  {
    icon: Key,
    title: "Secrets Vault",
    description: "Version-controlled secrets with rollback, categories, tags, and ephemeral TTL. Bulk import/export .env files. Per-environment isolation.",
  },
  {
    icon: GitCompare,
    title: "Environment Diff & Sync",
    description: "Visual diff between dev/staging/prod. One-click sync missing secrets. Bulk fix mismatches with confirmation. Audit trail on every sync.",
  },
  {
    icon: Bot,
    title: "AI Agent Harness",
    description: "Ephemeral tokens with TTL countdown, quota enforcement, killswitch, and live proxy simulator. Per-agent secret allowlists.",
  },
  {
    icon: Users,
    title: "Team & RBAC",
    description: "Role-based access (Owner/Admin/Developer/Viewer/Agent). Environment-scoped permissions. Service accounts with scoped tokens.",
  },
  {
    icon: Activity,
    title: "Activity Audit Log",
    description: "Append-only event stream with filtering, CSV/JSON export. 30-365 day retention. Webhook integrations for SIEM.",
  },
];

const pricingTiers = [
  {
    name: "Developer",
    price: "$0",
    period: "/month",
    description: "For individual developers and small projects",
    features: [
      "1 project, 3 environments",
      "50 secrets per environment",
      "3 AI agent harnesses",
      "7-day audit retention",
      "Community support",
    ],
    cta: "Start Free",
    variant: "outline" as const,
  },
  {
    name: "Team",
    price: "$29",
    period: "/month",
    description: "For growing teams with collaboration needs",
    features: [
      "10 projects, unlimited environments",
      "500 secrets per environment",
      "20 AI agent harnesses",
      "90-day audit retention",
      "SSO (SAML/OIDC)",
      "Priority support",
    ],
    cta: "Get Started",
    variant: "default" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For organizations with compliance requirements",
    features: [
      "Unlimited projects & secrets",
      "Unlimited AI agents",
      "365-day audit retention",
      "Custom KMS integration",
      "Dedicated support & SLA",
      "On-premise deployment option",
    ],
    cta: "Contact Sales",
    variant: "outline" as const,
  },
];

export default function LandingPage() {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText("npx axiom init --project axiom-core");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-zinc-900 dark:text-white">
              <span className="text-primary">Axiom</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                Features
              </Link>
              <Link href="#pricing" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                Pricing
              </Link>
              <Link href="#docs" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                Docs
              </Link>
              <Button variant="ghost" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="h-3.5 w-3.5" />
            <span>Now with AI Agent Harness & Zero-Trust KMS</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Secrets Management
            <br />
            <span className="text-primary">Built for AI Agents</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 mb-10">
            The only secrets manager with built-in AI agent harness, environment diff sync,
            and zero-trust encryption. Stop copying .env files. Start shipping.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button size="lg" asChild>
              <Link href="/dashboard">
                Open Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#docs">
                Read Documentation
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* CLI Snippet */}
          <div className="mx-auto max-w-2xl">
            <div className="relative bg-zinc-900 rounded-xl border border-zinc-800 p-4 font-mono text-sm text-zinc-100">
              <div className="flex items-center justify-between mb-3 text-zinc-500">
                <span>terminal</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-400 hover:text-white"
                      onClick={handleCopy}
                    >
                      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{copied ? "Copied!" : "Copy to clipboard"}</TooltipContent>
                </Tooltip>
              </div>
              <code className="text-green-400">npx axiom init --project axiom-core</code>
            </div>
          </div>
        </div>
      </section>

      {/* Console Preview */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <ConsolePreview />
      </section>

      {/* Zero Trust Diagram */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Zero-Trust Architecture
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Every secret encrypted at rest and in transit. Master key rotation without
            exposing plaintext. Audit trail on every operation.
          </p>
        </div>

        <div className="relative">
          {/* Diagram */}
          <div className="relative aspect-square max-w-3xl mx-auto">
            <svg className="w-full h-full text-zinc-300 dark:text-zinc-700" viewBox="0 0 400 400">
              {/* Center: KMS */}
              <circle cx="200" cy="200" r="60" fill="url(#kmsGradient)" />
              <text x="200" y="195" textAnchor="middle" className="text-xs font-bold fill-white">KMS</text>
              <text x="200" y="212" textAnchor="middle" className="text-[10px] fill-white/80">AES-256-GCM</text>

              {/* Orbiting nodes */}
              <g>
                {[
                  { angle: -90, label: "Secrets Vault", icon: Key },
                  { angle: -30, label: "Env Diff Sync", icon: GitCompare },
                  { angle: 30, label: "AI Agents", icon: Bot },
                  { angle: 90, label: "Team & RBAC", icon: Users },
                  { angle: 150, label: "Activity Audit", icon: Activity },
                  { angle: 210, label: "Settings/KMS", icon: Settings },
                ].map((node, i) => {
                  const rad = (node.angle * Math.PI) / 180;
                  const x = 200 + 140 * Math.cos(rad);
                  const y = 200 + 140 * Math.sin(rad);
                  return (
                    <g key={i}>
                      <line
                        x1={200 + 60 * Math.cos(rad)}
                        y1={200 + 60 * Math.sin(rad)}
                        x2={200 + 110 * Math.cos(rad)}
                        y2={200 + 110 * Math.sin(rad)}
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                        opacity="0.5"
                      />
                      <circle cx={x} cy={y} r="35" fill="white" stroke="currentColor" strokeWidth="1" className="dark:fill-zinc-800" />
                      <text x={x} y={y - 8} textAnchor="middle" className="text-xs font-medium fill-current">{node.label}</text>
                    </g>
                  );
                })}
              </g>

              <defs>
                <radialGradient id="kmsGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1e40af" />
                </radialGradient>
              </defs>
            </svg>
          </div>

          {/* Feature cards around diagram */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            {features.map((feature, i) => (
              <Card key={feature.title} className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">{feature.title}</h3>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-zinc-100 dark:bg-zinc-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything You Need to Ship Securely
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              Six integrated workspaces. One unified platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary mb-4 inline-block">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Start free. Scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.name}
              className={cn(
                "relative",
                tier.popular && "border-primary shadow-lg shadow-primary/10"
              )}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  Most Popular
                </div>
              )}
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg">{tier.name}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">{tier.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-zinc-600 dark:text-zinc-400">{tier.period}</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={tier.variant}
                  className="w-full"
                  asChild
                >
                  <Link href="/dashboard">{tier.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="font-bold text-xl text-zinc-900 dark:text-white">
                <span className="text-primary">Axiom</span>
              </Link>
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-xs">
                Secrets management built for the AI era. Zero-trust encryption, agent harnesses, and environment sync.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li><Link href="#features" className="hover:text-primary">Features</Link></li>
                <li><Link href="#pricing" className="hover:text-primary">Pricing</Link></li>
                <li><Link href="#docs" className="hover:text-primary">Documentation</Link></li>
                <li><Link href="/dashboard" className="hover:text-primary">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li><Link href="#" className="hover:text-primary">About</Link></li>
                <li><Link href="#" className="hover:text-primary">Blog</Link></li>
                <li><Link href="#" className="hover:text-primary">Careers</Link></li>
                <li><Link href="#" className="hover:text-primary">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li><Link href="#" className="hover:text-primary">Privacy</Link></li>
                <li><Link href="#" className="hover:text-primary">Terms</Link></li>
                <li><Link href="#" className="hover:text-primary">Security</Link></li>
                <li><Link href="#" className="hover:text-primary">Cookies</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              © 2024 Axiom. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-primary">
                <GitBranch className="h-5 w-5" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-primary">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </TooltipProvider>
  );
}