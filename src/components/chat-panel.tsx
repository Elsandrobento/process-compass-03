import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Send } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { listComments, addComment } from "@/lib/processes.functions";

export function ChatPanel({ processId, currentUserId }: { processId: string; currentUserId: string | null }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const qc = useQueryClient();
  const getComments = useServerFn(listComments);
  const postComment = useServerFn(addComment);

  const q = useQuery({
    queryKey: ["comments", processId],
    queryFn: () => getComments({ data: processId }),
    enabled: open,
    refetchInterval: open ? 5000 : false, // Poll when open
  });

  const mut = useMutation({
    mutationFn: (msg: string) => postComment({ data: { process_id: processId, content: msg } }),
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["comments", processId] });
    },
    onError: (e) => {
      console.error(e);
      toast.error(e.message || "Erro ao enviar mensagem. Já correstes o script SQL?");
    }
  });

  const comments = q.data ?? [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative group">
          <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-foreground transition-colors" />
          Fórum / Chat
          {/* We could add an unread badge here if we tracked it */}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full border-l">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Discussão do Processo
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {q.isLoading && <div className="text-center text-sm text-muted-foreground mt-4">A carregar...</div>}
          {!q.isLoading && comments.length === 0 && (
            <div className="text-center text-sm text-muted-foreground mt-10">Nenhuma mensagem ainda.</div>
          )}
          {comments.map((c) => {
            const isMe = c.user_id === currentUserId;
            return (
              <div key={c.id} className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}>
                <span className="text-[10px] text-muted-foreground mb-1 px-1">
                  {isMe ? "Tu" : c.profile?.nome} · {new Date(c.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className={`px-4 py-2 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"}`}>
                  {c.content}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreve uma mensagem..."
              className="min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (content.trim() && !mut.isPending) mut.mutate(content.trim());
                }
              }}
            />
            <Button 
              size="icon" 
              className="h-[60px] w-[60px] shrink-0 rounded-xl"
              disabled={!content.trim() || mut.isPending}
              onClick={() => mut.mutate(content.trim())}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <div className="text-[10px] text-muted-foreground mt-2 text-center">
            Pressiona Enter para enviar
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
