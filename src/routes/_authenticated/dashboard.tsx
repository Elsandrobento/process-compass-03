import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useEffect, useRef, useState } from "react";
import {
  Inbox,
  FileText,
  CheckCircle2,
  Undo2,
  FilePlus2,
  ArrowRight,
  TrendingUp,
  Clock,
} from "lucide-react";
import { dashboardCounts, listMyInbox, listCreatedByMe } from "@/lib/processes.functions";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityDot } from "@/components/status-badge";
import { TYPE_LABEL, STEP_LABEL } from "@/lib/process-labels";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Intellectus" }] }),
  component: Dashboard,
});

/** Animated counter that counts from 0 to `target` */
function AnimatedCount({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setDisplay(0); return; }
    const duration = 700;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target]);

  return <span>{display}</span>;
}

type CardConfig = {
  label: string;
  value: number;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  barColor: string;
  maxHint: number;
};

function StatCard({ card, index }: { card: CardConfig; index: number }) {
  const pct = card.maxHint > 0 ? Math.min((card.value / card.maxHint) * 100, 100) : 0;
  const stagger = `stagger-${Math.min(index + 1, 8)}`;

  return (
    <div
      className={`animate-scale-in ${stagger} relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm
        transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 group cursor-default`}
    >
      {/* Subtle gradient overlay on hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${card.gradient}`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${card.iconBg} transition-transform duration-300 group-hover:scale-110`}>
            <card.icon className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="animate-count-up text-4xl font-bold tracking-tight mb-3">
          <AnimatedCount target={card.value} />
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full animate-bar-grow ${card.barColor}`}
            style={{ "--bar-w": `${pct}%` } as React.CSSProperties}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {card.value === 0 ? "Nenhum" : card.value === 1 ? "1 processo" : `${card.value} processos`}
        </p>
      </div>
    </div>
  );
}

function Dashboard() {
  const countsFn = useServerFn(dashboardCounts);
  const inboxFn = useServerFn(listMyInbox);
  const createdFn = useServerFn(listCreatedByMe);

  const countsQ = useQuery({ queryKey: ["dashboard-counts"], queryFn: () => countsFn() });
  const inboxQ  = useQuery({ queryKey: ["inbox-preview"],   queryFn: () => inboxFn() });
  const createdQ = useQuery({ queryKey: ["created-by-me"],  queryFn: () => createdFn() });

  const counts = countsQ.data;
  const maxVal = Math.max(counts?.pending ?? 0, counts?.created ?? 0, counts?.done ?? 0, counts?.returned ?? 0, 1);

  const cards: CardConfig[] = [
    {
      label: "Pendentes comigo",
      value: counts?.pending ?? 0,
      icon: Inbox,
      gradient: "bg-gradient-to-br from-warning/8 to-transparent",
      iconBg: "bg-warning/15 text-warning",
      barColor: "bg-warning",
      maxHint: maxVal,
    },
    {
      label: "Criados por mim",
      value: counts?.created ?? 0,
      icon: FileText,
      gradient: "bg-gradient-to-br from-primary/8 to-transparent",
      iconBg: "bg-primary/15 text-primary",
      barColor: "bg-primary",
      maxHint: maxVal,
    },
    {
      label: "Concluídos / Em curso",
      value: counts?.done ?? 0,
      icon: CheckCircle2,
      gradient: "bg-gradient-to-br from-success/8 to-transparent",
      iconBg: "bg-success/15 text-success",
      barColor: "bg-success",
      maxHint: maxVal,
    },
    {
      label: "Devolvidos",
      value: counts?.returned ?? 0,
      icon: Undo2,
      gradient: "bg-gradient-to-br from-info/8 to-transparent",
      iconBg: "bg-info/15 text-info",
      barColor: "bg-info",
      maxHint: maxVal,
    },
  ];

  const inboxItems   = (inboxQ.data  ?? []).slice(0, 5);
  const recentItems  = (createdQ.data ?? []).slice(0, 4);

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="animate-slide-up flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral dos seus processos em tempo real.</p>
        </div>
        <Button asChild className="shadow-sm">
          <Link to="/processes/new">
            <FilePlus2 className="h-4 w-4 mr-2" /> Novo processo
          </Link>
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {cards.map((c, i) => (
          <StatCard key={c.label} card={c} index={i} />
        ))}
      </div>

      {/* Two-column bottom */}
      <div className="grid md:grid-cols-5 gap-6">
        {/* Pending inbox — 3 cols */}
        <div className="md:col-span-3 animate-slide-up stagger-4">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-warning/5 to-transparent">
              <h2 className="font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning animate-pulse-soft" />
                Pendentes comigo
              </h2>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link to="/inbox">Ver tudo <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
            <div>
              {inboxItems.length === 0 && (
                <div className="px-5 py-12 text-sm text-muted-foreground text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success opacity-50" />
                  Sem processos pendentes — tudo em dia!
                </div>
              )}
              {inboxItems.map((p, i) => {
                const stagger = `stagger-${Math.min(i + 1, 8)}`;
                return (
                  <Link
                    key={p.id}
                    to="/processes/$id"
                    params={{ id: p.id }}
                    className={`animate-slide-up ${stagger} flex items-center justify-between px-5 py-3.5
                      border-b last:border-b-0 hover:bg-muted/50 transition-colors duration-150 group`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PriorityDot priority={p.priority} />
                      <div className="min-w-0">
                        <div className="font-medium truncate text-sm group-hover:text-primary transition-colors flex items-center gap-2">
                          {p.title}
                          {p.priority === 'alta' && (new Date().getTime() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60) > 48 && (
                            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" title="SLA Expirado (> 48h)"></span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.numero} · {TYPE_LABEL[p.type]} · {STEP_LABEL[p.current_step] ?? p.current_step}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={p.status} />
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent processes — 2 cols */}
        <div className="md:col-span-2 animate-slide-up stagger-5">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden h-full">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
              <h2 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Criados recentemente
              </h2>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link to="/inbox">Ver tudo <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
            <div>
              {recentItems.length === 0 && (
                <div className="px-5 py-12 text-sm text-muted-foreground text-center">
                  Nenhum processo criado ainda.
                </div>
              )}
              {recentItems.map((p, i) => {
                const stagger = `stagger-${Math.min(i + 1, 8)}`;
                return (
                  <Link
                    key={p.id}
                    to="/processes/$id"
                    params={{ id: p.id }}
                    className={`animate-slide-up ${stagger} flex items-center justify-between px-5 py-3.5
                      border-b last:border-b-0 hover:bg-muted/50 transition-colors duration-150 group`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate text-sm group-hover:text-primary transition-colors">{p.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(p.created_at).toLocaleDateString("pt-PT")}
                      </div>
                    </div>
                    <StatusBadge status={p.status} className="ml-2 shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
