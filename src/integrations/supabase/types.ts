export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          process_id: string
          size_bytes: number | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          process_id: string
          size_bytes?: number | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          process_id?: string
          size_bytes?: number | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          process_id: string | null
          read: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          process_id?: string | null
          read?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          process_id?: string | null
          read?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_steps: {
        Row: {
          action: Database["public"]["Enums"]["process_action"]
          comment: string | null
          created_at: string
          from_user: string | null
          id: string
          process_id: string
          to_user: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["process_action"]
          comment?: string | null
          created_at?: string
          from_user?: string | null
          id?: string
          process_id: string
          to_user?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["process_action"]
          comment?: string | null
          created_at?: string
          from_user?: string | null
          id?: string
          process_id?: string
          to_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_steps_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          created_at: string
          created_by: string
          current_step: Database["public"]["Enums"]["process_step_kind"]
          current_user_id: string | null
          department: string
          description: string | null
          id: string
          numero: string
          priority: Database["public"]["Enums"]["process_priority"]
          quarto_user_id: string | null
          status: Database["public"]["Enums"]["process_status"]
          title: string
          type: Database["public"]["Enums"]["process_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_step?: Database["public"]["Enums"]["process_step_kind"]
          current_user_id?: string | null
          department: string
          description?: string | null
          id?: string
          numero?: string
          priority?: Database["public"]["Enums"]["process_priority"]
          quarto_user_id?: string | null
          status?: Database["public"]["Enums"]["process_status"]
          title: string
          type: Database["public"]["Enums"]["process_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_step?: Database["public"]["Enums"]["process_step_kind"]
          current_user_id?: string | null
          department?: string
          description?: string | null
          id?: string
          numero?: string
          priority?: Database["public"]["Enums"]["process_priority"]
          quarto_user_id?: string | null
          status?: Database["public"]["Enums"]["process_status"]
          title?: string
          type?: Database["public"]["Enums"]["process_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          departamento: string | null
          email: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          departamento?: string | null
          email: string
          id: string
          nome: string
        }
        Update: {
          created_at?: string
          departamento?: string | null
          email?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_process_numero: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      participates_in_process: {
        Args: { _process_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "criador"
        | "validador"
        | "diretor"
        | "diretor_geral"
        | "presidente"
        | "leitura"
        | "adjunta"
      process_action:
        | "criado"
        | "encaminhado"
        | "favoravel"
        | "nao_favoravel"
        | "devolvido"
        | "arquivado"
      process_priority: "baixa" | "media" | "alta"
      process_status:
        | "pendente"
        | "em_analise"
        | "aprovado"
        | "rejeitado"
        | "devolvido"
        | "concluido"
        | "em_pagamento"
      process_step_kind:
        | "criador"
        | "chefe"
        | "diretor"
        | "diretor_geral"
        | "arquivo"
        | "quarto"
        | "adjunta"
        | "presidente"
        | "pagamento"
      process_type: "pagamento" | "patrimonio" | "rh" | "outros"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "criador",
        "validador",
        "diretor",
        "diretor_geral",
        "presidente",
        "leitura",
        "adjunta",
      ],
      process_action: [
        "criado",
        "encaminhado",
        "favoravel",
        "nao_favoravel",
        "devolvido",
        "arquivado",
      ],
      process_priority: ["baixa", "media", "alta"],
      process_status: [
        "pendente",
        "em_analise",
        "aprovado",
        "rejeitado",
        "devolvido",
        "concluido",
        "em_pagamento",
      ],
      process_step_kind: [
        "criador",
        "chefe",
        "diretor",
        "diretor_geral",
        "arquivo",
        "quarto",
        "adjunta",
        "presidente",
        "pagamento",
      ],
      process_type: ["pagamento", "patrimonio", "rh", "outros"],
    },
  },
} as const
