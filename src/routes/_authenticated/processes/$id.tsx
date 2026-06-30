import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Undo2, Download, FileText, ArrowRight } from "lucide-react";
import { getProcessDetail, submitDecision, listUsers } from "@/lib/processes.functions";
import { StatusBadge } from "@/components/status-badge";
import { TYPE_LABEL, PRIORITY_LABEL, STEP_LABEL, ACTION_LABEL } from "@/lib/process-labels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/processes/$id")({
  head: () => ({ meta: [{ title: "Processo — Intellectus" }] }),
  component: ProcessDetail,
});

function ProcessDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const detailFn = useServerFn(getProcessDetail);
  const decideFn = useServerFn(submitDecision);
  const usersFn = useServerFn(listUsers);

  const q = useQuery({ queryKey: ["process", id], queryFn: () => detailFn({ data: { id } }) });
  const usersQ = useQuery({ queryKey: ["users"], queryFn: () => usersFn() });

  const [comment, setComment] = useState("");
  const [nextUser, setNextUser] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const decide = useMutation({
    mutationFn: (action: "favoravel" | "nao_favoravel" | "devolver" | "reenviar") =>
      decideFn({
        data: {
          process_id: id,
          action,
          comment: comment || undefined,
          next_user_id: action === "favoravel" || action === "reenviar" || action === "nao_favoravel" ? nextUser || undefined : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Decisão registada");
      setComment("");
      setNextUser("");
      qc.invalidateQueries({ queryKey: ["process", id] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="text-sm text-muted-foreground">A carregar...</div>;
  if (q.isError || !q.data) return <div className="text-sm text-destructive">Erro ao carregar processo.</div>;

  const { process, steps, attachments, profiles, signedUrls } = q.data;
  const isResponsible = currentUserId === process.current_user_id;
  const isClosed =
    process.status === "concluido" || process.status === "rejeitado";
  const isPresident = process.current_step === "presidente";
  const isPagamento = process.current_step === "pagamento";
  const isAssinatura = process.current_step === "assinatura_carta";
  const isCreatorResubmit = process.status === "devolvido" && process.current_step === "criador";
  const requiresNextUser = !isPresident && !isCreatorResubmit && !isAssinatura;


  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground font-medium">{process.numero}</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{process.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
            <span>{TYPE_LABEL[process.type]}</span>·<span>{process.department}</span>·
            <span>Prioridade {PRIORITY_LABEL[process.priority]}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={process.status} />
          <Button variant="ghost" onClick={() => navigate({ to: "/inbox" })}>Voltar</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Descrição">
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">
              {process.description || <span className="text-muted-foreground">Sem descrição.</span>}
            </p>
          </Section>

          <Section title="Informações">
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <DT>Criado por</DT>
              <DD>{profiles[process.created_by]?.nome ?? "—"}</DD>
              <DT>Responsável atual</DT>
              <DD>
                {process.current_user_id
                  ? profiles[process.current_user_id]?.nome ?? "—"
                  : <span className="text-muted-foreground">—</span>}
              </DD>
              <DT>Passo atual</DT>
              <DD>{STEP_LABEL[process.current_step]}</DD>
              <DT>Criado em</DT>
              <DD>{new Date(process.created_at).toLocaleString("pt-PT")}</DD>
            </dl>
          </Section>

          {isResponsible && !isClosed && (
            <Section title={isCreatorResubmit ? "Reenviar processo" : "Tomar decisão"}>
              <div className="space-y-3">
                {isCreatorResubmit && (
                  <div className="text-sm bg-info/10 border border-info/30 text-info rounded px-3 py-2">
                    Este processo foi devolvido para correcção. Faça as alterações necessárias e reenvie para continuar o fluxo.
                  </div>
                )}
                <Textarea
                  placeholder={
                    isCreatorResubmit
                      ? "Comentário sobre as correcções (opcional)"
                      : "Comentário (obrigatório para parecer não favorável ou devolução)"
                  }
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                {requiresNextUser && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Próximo responsável:
                    </div>
                    <Select value={nextUser} onValueChange={setNextUser}>
                      <SelectTrigger><SelectValue placeholder="Selecionar próximo responsável" /></SelectTrigger>
                      <SelectContent>
                        {(usersQ.data ?? []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome} {u.departamento ? `· ${u.departamento}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {isCreatorResubmit ? (
                    <Button
                      onClick={() => decide.mutate("reenviar")}
                      disabled={decide.isPending || !nextUser}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <ArrowRight className="h-4 w-4 mr-2" /> Reenviar para Adjunta
                    </Button>
                  ) : isAssinatura ? (
                    <Button
                      onClick={() => decide.mutate("favoravel")}
                      disabled={decide.isPending}
                      className="bg-success text-success-foreground hover:bg-success/90"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Assinar Carta e Concluir Processo
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => decide.mutate("favoravel")}
                        disabled={decide.isPending || (requiresNextUser && !nextUser)}
                        className="bg-success text-success-foreground hover:bg-success/90"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {isPresident
                          ? "Aprovar — enviar para pagamento"
                          : isPagamento
                          ? "Confirmar Pagamento → Assinatura de Carta"
                          : "Favorável"}
                      </Button>
                      {!isPagamento && (
                        <>
                          <Button
                            onClick={() => decide.mutate("nao_favoravel")}
                            disabled={
                              decide.isPending ||
                              comment.trim().length < 3 ||
                              (requiresNextUser && !nextUser)
                            }
                            variant="destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            {isPresident ? "Rejeitar processo" : "Não favorável (continua)"}
                          </Button>
                          <Button
                            onClick={() => decide.mutate("devolver")}
                            disabled={decide.isPending || comment.trim().length < 3}
                            variant="outline"
                          >
                            <Undo2 className="h-4 w-4 mr-2" /> Devolver ao criador
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Section>
          )}

        </div>

        <div className="space-y-6">
          <Section title={`Anexos (${attachments.length})`}>
            {attachments.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem anexos.</div>
            ) : (
              <ul className="space-y-2">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{a.file_name}</span>
                    </div>
                    {signedUrls[a.id] && (
                      <a
                        href={signedUrls[a.id]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Histórico">
            <ol className="space-y-4">
              {steps.map((s, i) => (
                <li key={s.id} className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary" />
                  {i < steps.length - 1 && <span className="absolute left-[3px] top-4 bottom-[-1rem] w-px bg-border" />}
                  <div className="text-sm font-medium">{ACTION_LABEL[s.action] ?? s.action}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {profiles[s.from_user ?? ""]?.nome ?? "Sistema"}
                    {s.to_user && (
                      <>
                        {" "}<ArrowRight className="inline h-3 w-3" /> {profiles[s.to_user]?.nome ?? "—"}
                      </>
                    )}
                  </div>
                  {s.comment && <div className="text-sm mt-1 bg-muted/40 rounded px-2 py-1">{s.comment}</div>}
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(s.created_at).toLocaleString("pt-PT")}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3 border-b font-medium text-sm">{title}</div>
      <div className="p-5">{children}</div>
    </section>
  );
}
function DT({ children }: { children: React.ReactNode }) {
  return <dt className="text-muted-foreground">{children}</dt>;
}
function DD({ children }: { children: React.ReactNode }) {
  return <dd className="font-medium">{children}</dd>;
}
