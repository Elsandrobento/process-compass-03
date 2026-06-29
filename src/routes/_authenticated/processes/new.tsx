import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";
import { createProcess, listUsers, createUploadUrl } from "@/lib/processes.functions";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/processes/new")({
  head: () => ({ meta: [{ title: "Criar processo — Intellectus" }] }),
  component: NewProcessPage,
});

type UploadedFile = { file_path: string; file_name: string; mime_type?: string; size_bytes?: number };

function NewProcessPage() {
  const navigate = useNavigate();
  const usersFn = useServerFn(listUsers);
  const createFn = useServerFn(createProcess);
  const uploadFn = useServerFn(createUploadUrl);
  const usersQ = useQuery({ queryKey: ["users"], queryFn: () => usersFn() });

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"pagamento" | "patrimonio" | "rh" | "outros">("pagamento");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"baixa" | "media" | "alta">("media");
  const [recipient, setRecipient] = useState("");
  const [hasQuarto, setHasQuarto] = useState(false);
  const [quartoUser, setQuartoUser] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const initialRecipient = hasQuarto && quartoUser ? quartoUser : recipient;
      return createFn({
        data: {
          title,
          type,
          department,
          description,
          priority,
          recipient_id: initialRecipient,
          quarto_user_id: hasQuarto && quartoUser ? quartoUser : undefined,
          attachments: files,
        },
      });
    },
    onSuccess: (proc) => {
      toast.success(`Processo ${proc.numero} criado`);
      navigate({ to: "/processes/$id", params: { id: proc.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  async function handleFiles(list: FileList | null) {
    if (!list) return;
    setUploading(true);
    try {
      for (const f of Array.from(list)) {
        const signed = await uploadFn({ data: { file_name: f.name } });
        const { error } = await supabase.storage
          .from("process-attachments")
          .uploadToSignedUrl(signed.path, signed.token, f);
        if (error) {
          toast.error(`Falha ao enviar ${f.name}: ${error.message}`);
          continue;
        }
        setFiles((prev) => [...prev, { file_path: signed.path, file_name: f.name, mime_type: f.type, size_bytes: f.size }]);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Criar processo</h1>
        <p className="text-sm text-muted-foreground mt-1">Preencha os dados e envie para o destinatário inicial.</p>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-6">
        <div>
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Pagamento de fornecedor X" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagamento">Pagamento</SelectItem>
                <SelectItem value="patrimonio">Património</SelectItem>
                <SelectItem value="rh">Recursos Humanos</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Departamento</Label>
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ex.: Financeiro" />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </div>
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={hasQuarto}
              onChange={(e) => setHasQuarto(e.target.checked)}
            />
            <span>
              <span className="font-medium">Incluir 4º parecer (departamento envolvido)</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Se marcado, o processo é encaminhado primeiro para este utilizador, antes da Adjunta.
              </span>
            </span>
          </label>
          {hasQuarto && (
            <div>
              <Label>Responsável pelo 4º parecer</Label>
              <Select value={quartoUser} onValueChange={setQuartoUser}>
                <SelectTrigger><SelectValue placeholder="Selecionar utilizador do departamento envolvido" /></SelectTrigger>
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
        </div>

        <div>
          <Label>{hasQuarto ? "Adjunta do Director Geral (próximo após o 4º parecer)" : "Adjunta do Director Geral (destinatário inicial)"}</Label>
          <Select value={recipient} onValueChange={setRecipient}>
            <SelectTrigger><SelectValue placeholder="Selecionar a Adjunta" /></SelectTrigger>
            <SelectContent>
              {(usersQ.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome} {u.departamento ? `· ${u.departamento}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Fluxo: Criador → {hasQuarto ? "4º Parecer → " : ""}Adjunta → Director Geral → Presidente → Pagamento.
          </p>
        </div>


        <div>
          <Label>Anexos</Label>
          <div className="mt-1 rounded-md border border-dashed p-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Paperclip className="h-4 w-4" />
              <span>{uploading ? "A enviar..." : "Clique para anexar ficheiros"}</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={uploading}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1">
                {files.map((f, i) => (
                  <li key={f.file_path} className="flex items-center justify-between text-sm bg-muted/40 px-2 py-1 rounded">
                    <span className="truncate">{f.file_name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>Cancelar</Button>
          <Button
            disabled={create.isPending || !title || !department || !recipient}
            onClick={() => create.mutate()}
          >
            Criar processo
          </Button>
        </div>
      </div>
    </div>
  );
}
