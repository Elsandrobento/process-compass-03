import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listAllUsersWithRoles, setUserRole } from "@/lib/processes.functions";
import { ROLE_LABEL } from "@/lib/process-labels";
import { Checkbox } from "@/components/ui/checkbox";

const ROLES = ["admin", "criador", "validador", "diretor", "diretor_geral", "presidente", "leitura"] as const;

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Utilizadores — Intellectus" }] }),
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const fn = useServerFn(listAllUsersWithRoles);
  const setFn = useServerFn(setUserRole);
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => fn() });
  const m = useMutation({
    mutationFn: (v: { user_id: string; role: (typeof ROLES)[number]; grant: boolean }) => setFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isError) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Utilizadores</h1>
        <p className="text-sm text-destructive mt-4">{(q.error as Error).message}</p>
      </div>
    );
  }

  const profiles = q.data?.profiles ?? [];
  const roles = q.data?.roles ?? [];
  const has = (uid: string, role: string) => roles.some((r) => r.user_id === uid && r.role === role);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Utilizadores e papéis</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerir permissões da plataforma.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Utilizador</th>
              {ROLES.map((r) => (
                <th key={r} className="text-center px-3 py-3 font-medium whitespace-nowrap">
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                </td>
                {ROLES.map((r) => {
                  const checked = has(p.id, r);
                  return (
                    <td key={r} className="text-center px-3 py-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          m.mutate({ user_id: p.id, role: r, grant: !!v })
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
