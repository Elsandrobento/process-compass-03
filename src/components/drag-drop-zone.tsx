import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, X, File, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createUploadUrl } from "@/lib/processes.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UploadedFile = {
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

interface DragDropZoneProps {
  onUploadComplete: (files: UploadedFile[]) => void;
  className?: string;
}

export function DragDropZone({ onUploadComplete, className }: DragDropZoneProps) {
  const [files, setFiles] = useState<{ file: File; id: string; status: "uploading" | "done" | "error"; uploadedData?: UploadedFile }[]>([]);
  const getUploadUrl = useServerFn(createUploadUrl);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.map((f) => ({
        file: f,
        id: Math.random().toString(36).substring(7),
        status: "uploading" as const,
      }));
      
      setFiles((prev) => [...prev, ...newFiles]);

      newFiles.forEach(async (nf) => {
        try {
          // Get presigned URL
          const { path, token, url } = await getUploadUrl({ data: { file_name: nf.file.name } });
          
          // Upload directly to Supabase storage
          const res = await fetch(url, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": nf.file.type || "application/octet-stream",
            },
            body: nf.file,
          });

          if (!res.ok) throw new Error("Upload falhou");

          const uploadedData: UploadedFile = {
            file_path: path,
            file_name: nf.file.name,
            mime_type: nf.file.type,
            size_bytes: nf.file.size,
          };

          setFiles((prev) =>
            prev.map((p) => (p.id === nf.id ? { ...p, status: "done", uploadedData } : p))
          );
        } catch (err) {
          console.error(err);
          setFiles((prev) => prev.map((p) => (p.id === nf.id ? { ...p, status: "error" } : p)));
          toast.error(`Erro a enviar ${nf.file.name}`);
        }
      });
    },
    [getUploadUrl]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // Update parent when files change
  React.useEffect(() => {
    const doneFiles = files.filter(f => f.status === "done" && f.uploadedData).map(f => f.uploadedData!);
    onUploadComplete(doneFiles);
  }, [files, onUploadComplete]);

  const removeFile = (id: string) => setFiles(files.filter((f) => f.id !== id));

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <input {...getInputProps()} />
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <UploadCloud className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium">Arrasta ficheiros para aqui ou clica para procurar</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, Excel, Word ou Imagens (máx. 50MB)</p>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded bg-muted flex flex-shrink-0 items-center justify-center">
                  {f.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <File className="h-4 w-4 text-primary" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{f.file.name}</p>
                  <p className="text-xs text-muted-foreground">{(f.file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {f.status === "error" && <span className="text-xs text-destructive font-medium">Erro</span>}
                {f.status === "done" && <span className="text-xs text-success font-medium">Concluído</span>}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeFile(f.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
