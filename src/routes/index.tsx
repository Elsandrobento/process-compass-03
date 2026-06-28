import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ShieldCheck, GitBranch, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intellectus — Gestão de Processos Administrativos" },
      {
        name: "description",
        content: "Plataforma interna para criar, encaminhar e arquivar processos administrativos da Intellectus.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 px-6 flex items-center justify-between border-b">
        <div className="flex items-center gap-2 font-semibold">
          <div className="h-8 w-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
            <FileText className="h-4 w-4" />
          </div>
          Intellectus
        </div>
        <Button asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="flex-1 max-w-5xl mx-auto px-6 py-16 md:py-24 w-full">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Plataforma interna
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
            Gestão digital de processos administrativos
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Criar, encaminhar e aprovar processos com rastreabilidade total. Sem papel, sem perdas, com histórico
            imutável.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Aceder à plataforma</Link>
            </Button>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-4">
          {[
            { icon: GitBranch, title: "Fluxo institucional", text: "Criador → Chefe → Diretor → Diretor Geral → Arquivo." },
            { icon: ShieldCheck, title: "Rastreabilidade total", text: "Cada parecer fica registado e não pode ser alterado." },
            { icon: Clock, title: "Sem atrasos", text: "Notificações imediatas para o próximo responsável." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-5">
              <f.icon className="h-5 w-5 text-primary mb-3" />
              <div className="font-medium">{f.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{f.text}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © Intellectus — Uso interno
      </footer>
    </div>
  );
}
