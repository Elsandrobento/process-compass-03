import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, FileText, CheckCircle2, Undo2, FilePlus2 } from "lucide-react";
import { dashboardCounts, listMyInbox } from "@/lib/processes.functions";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityDot } from "@/components/status-badge";
import { TYPE_LABEL } from "@/lib/process-labels";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Intellectus" }] }),
  component: Dashboard,
});

function Dashboard() {
  const counts = useServerFn(dashboardCounts);
  const inbox = useServerFn(listMyInbox);
  const countsQ = useQuery({ queryKey: ["dashboard-counts"], queryFn: () => counts() });
  const inboxQ = useQuery({ queryKey: ["inbox-preview"], queryFn: () => inbox() });

  const cards = [
    { label: "Pendentes comigo", value: countsQ.data?.pending ?? 0, icon: Inbox, color: "text-warning" },
    { label: "Criados por mim", value: countsQ.data?.created ?? 0, icon: FileText, color: "text-primary" },
    { label: "Concluídos", value: countsQ.data?.done ?? 0, icon: CheckCircle2, color: "text-success" },
    { label: "Devolvidos", value: countsQ.data?.returned ?? 0, icon: Undo2, color: "text-info" },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral dos seus processos.</p>
        </div>
        <Button asChild>
          <Link to="/processes/new">
            <FilePlus2 className="h-4 w-4 mr-2" /> Novo processo
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{c.label}</div>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className="text-3xl font-semibold mt-2">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-medium">Pendentes comigo</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/inbox">Ver tudo</Link>
          </Button>
        </div>
        <div>
          {(inboxQ.data ?? []).length === 0 && (
            <div className="px-5 py-10 text-sm text-muted-foreground text-center">Sem processos pendentes.</div>
          )}
          {(inboxQ.data ?? []).slice(0, 5).map((p) => (
            <Link
              key={p.id}
              to="/processes/$id"
              params={{ id: p.id }}
              className="flex items-center justify-between px-5 py-3 border-b last:border-b-0 hover:bg-muted/40"
            >
              <div className="flex items-center gap-3 min-w-0">
                <PriorityDot priority={p.priority} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.numero} · {TYPE_LABEL[p.type]} · {p.department}
                  </div>
                </div>
              </div>
              <StatusBadge status={p.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
