import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyInbox, listCreatedByMe } from "@/lib/processes.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, PriorityDot } from "@/components/status-badge";
import { TYPE_LABEL } from "@/lib/process-labels";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Caixa de Entrada — Intellectus" }] }),
  component: InboxPage,
});

function ProcessList({ rows }: { rows: ReadonlyArray<{ id: string; numero: string; title: string; type: string; department: string; priority: string; status: string; updated_at: string }> | undefined }) {
  if (!rows || rows.length === 0) {
    return <div className="px-5 py-10 text-sm text-muted-foreground text-center border rounded-lg bg-card">Sem processos.</div>;
  }
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {rows.map((p) => (
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
                {p.numero} · {TYPE_LABEL[p.type] ?? p.type} · {p.department}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {new Date(p.updated_at).toLocaleDateString("pt-PT")}
            </span>
            <StatusBadge status={p.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function InboxPage() {
  const inbox = useServerFn(listMyInbox);
  const created = useServerFn(listCreatedByMe);
  const inboxQ = useQuery({ queryKey: ["inbox"], queryFn: () => inbox() });
  const createdQ = useQuery({ queryKey: ["created-by-me"], queryFn: () => created() });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Caixa de Entrada</h1>
        <p className="text-sm text-muted-foreground mt-1">Processos onde é responsável ou que criou.</p>
      </div>
      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes comigo ({inboxQ.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="criados">Criados por mim ({createdQ.data?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes" className="mt-4">
          <ProcessList rows={inboxQ.data ?? undefined} />
        </TabsContent>
        <TabsContent value="criados" className="mt-4">
          <ProcessList rows={createdQ.data ?? undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
