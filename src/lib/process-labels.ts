export const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  devolvido: "Devolvido",
  concluido: "Concluído",
  em_pagamento: "Em pagamento",
  aguarda_assinatura: "Aguarda Assinatura",
};

export const TYPE_LABEL: Record<string, string> = {
  pagamento: "Pagamento",
  patrimonio: "Património",
  rh: "Recursos Humanos",
  outros: "Outros",
};

export const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const STEP_LABEL: Record<string, string> = {
  criador: "Criador",
  quarto: "4º Parecer (Departamento envolvido)",
  adjunta: "Adjunta do Director Geral",
  diretor_geral: "Director Geral",
  presidente: "Presidente do Conselho",
  pagamento: "Secção de Pagamento",
  assinatura_carta: "Assinatura da Carta (Banco)",
  // legacy
  chefe: "Chefe de Departamento",
  diretor: "Diretor",
  arquivo: "Arquivo",
};

export const ACTION_LABEL: Record<string, string> = {
  criado: "Processo criado",
  encaminhado: "Encaminhado",
  favoravel: "Parecer favorável",
  nao_favoravel: "Parecer não favorável",
  devolvido: "Devolvido para correcção",
  reenviado: "Reenviado pelo criador",
  arquivado: "Arquivado",
  concluido: "Aprovado pelo Presidente — enviado para pagamento",
  rejeitado: "Processo rejeitado pelo Presidente",
  carta_assinada: "Carta assinada — processo concluído",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  criador: "Criador",
  validador: "Validador",
  diretor: "Diretor",
  adjunta: "Adjunta",
  diretor_geral: "Director Geral",
  presidente: "Presidente",
  leitura: "Leitura",
};

export function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "rejeitado") return "destructive";
  if (s === "concluido" || s === "aprovado" || s === "em_pagamento") return "default";
  if (s === "devolvido") return "outline";
  return "secondary";
}

export function statusColor(s: string): string {
  switch (s) {
    case "pendente":
    case "em_analise":
      return "bg-warning/15 text-warning-foreground border-warning/40";
    case "aprovado":
    case "concluido":
      return "bg-success/15 text-success border-success/40";
    case "em_pagamento":
      return "bg-primary/15 text-primary border-primary/40";
    case "aguarda_assinatura":
      return "bg-purple-500/15 text-purple-600 border-purple-400/40";
    case "rejeitado":
      return "bg-destructive/15 text-destructive border-destructive/40";
    case "devolvido":
      return "bg-info/15 text-info border-info/40";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
