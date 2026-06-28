import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search as SearchIcon } from "lucide-react";
import { searchProcesses } from "@/lib/processes.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { TYPE_LABEL } from "@/lib/process-labels";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Pesquisar — Intellectus" }] }),
  component: SearchPage,
});

function SearchPage() {
  const fn = useServerFn(searchProcesses);
  const [q, setQ] = useState("");
  const m = useMutation({ mutationFn: (query: string) => fn({ data: { q: query } }) });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pesquisar</h1>
        <p className="text-sm text-muted-foreground mt-1">Pesquise por título, número ou departamento.</p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(q);
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: PROC-2026-00001 ou pagamento" />
        <Button type="submit" disabled={m.isPending}>
          <SearchIcon className="h-4 w-4 mr-2" /> Procurar
        </Button>
      </form>
      <div className="rounded-lg border bg-card overflow-hidden">
        {(m.data ?? []).length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground text-center">Sem resultados.</div>
        ) : (
          (m.data ?? []).map((p) => (
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
          ))
        )}
      </div>
    </div>
  );
}
