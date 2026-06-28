import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, Inbox, FilePlus2, Archive, Search, Users, LogOut, Bell, FileText } from "lucide-react";
import { type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listNotifications, markNotificationsRead } from "@/lib/processes.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inbox", label: "Caixa de Entrada", icon: Inbox },
  { to: "/processes/new", label: "Criar Processo", icon: FilePlus2 },
  { to: "/search", label: "Pesquisar", icon: Search },
  { to: "/archive", label: "Arquivo", icon: Archive },
  { to: "/admin/users", label: "Utilizadores", icon: Users },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchNotifs = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);

  const notifQ = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifs(),
    refetchInterval: 30_000,
  });
  const unread = (notifQ.data ?? []).filter((n) => !n.read).length;

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-sidebar-accent flex items-center justify-center">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Intellectus</div>
            <div className="text-xs opacity-70 leading-tight">Gestão de Processos</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between border-b bg-card px-4 md:px-6">
          <div className="md:hidden font-semibold">Intellectus</div>
          <div className="flex-1" />
          <DropdownMenu
            onOpenChange={(o) => {
              if (!o && unread > 0) {
                markRead().then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notificações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(notifQ.data ?? []).length === 0 && (
                <div className="px-3 py-6 text-sm text-muted-foreground text-center">Sem notificações</div>
              )}
              {(notifQ.data ?? []).slice(0, 10).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className={cn("flex flex-col items-start gap-0.5 py-2", !n.read && "bg-accent/50")}
                  onClick={() => n.process_id && navigate({ to: "/processes/$id", params: { id: n.process_id } })}
                >
                  <div className="text-sm">{n.message}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("pt-PT")}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
