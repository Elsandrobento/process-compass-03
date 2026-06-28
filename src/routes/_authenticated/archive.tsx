import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listArchive } from "@/lib/processes.functions";
import { StatusBadge } from "@/components/status-badge";
import { TYPE_LABEL } from "@/lib/process-labels";

export const Route = createFileRoute("/_authenticated/archive")({
  head: () => ({ meta: [{ title: "Arquivo — Intellectus" }] }),
  component: ArchivePage,
});

function ArchivePage() {
  const fn = useServerFn(listArchive);
  const q = useQuery({ queryKey: ["archive"], queryFn: () => fn() });
  const rows = q.data ?? [];
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Arquivo</h1>
        <p className="text-sm text-muted-foreground mt-1">Processos concluídos e encerrados (apenas leitura).</p>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-sm text-muted-foreground text-center border rounded-lg bg-card">
          Sem processos arquivados.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          {rows.map((p) => (
            <Link
              key={p.id}
              to="/processes/$id"
              params={{ id: p.id }}
              className="flex items-center justify-between px-5 py-3 border-b last:border-b-0 hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{p.title}</div>
                <div className="text-xs text-muted-foreground">
                  {p.numero} · {TYPE_LABEL[p.type] ?? p.type} · {p.department}
                </div>
              </div>
              <StatusBadge status={p.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
