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
      clientes: {
        Row: {
          created_at: string
          documento: string | null
          endereco: string | null
          id: string
          nome: string
          obs: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          documento?: string | null
          endereco?: string | null
          id?: string
          nome: string
          obs?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          documento?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          obs?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contas: {
        Row: {
          ativa: boolean
          banco: string | null
          created_at: string
          id: string
          nome: string
          numero_conta: string | null
          pix_key: string | null
          qr_path: string | null
          telefone_responsavel: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          banco?: string | null
          created_at?: string
          id?: string
          nome: string
          numero_conta?: string | null
          pix_key?: string | null
          qr_path?: string | null
          telefone_responsavel?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          banco?: string | null
          created_at?: string
          id?: string
          nome?: string
          numero_conta?: string | null
          pix_key?: string | null
          qr_path?: string | null
          telefone_responsavel?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      despesas: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          data_pagamento: string | null
          id: string
          motorista_id: string | null
          obs: string | null
          pago: boolean
          responsavel: string | null
          servico_id: string | null
          tipo: string
          updated_at: string
          valor: number
          via: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string
          data_pagamento?: string | null
          id?: string
          motorista_id?: string | null
          obs?: string | null
          pago?: boolean
          responsavel?: string | null
          servico_id?: string | null
          tipo: string
          updated_at?: string
          valor?: number
          via?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          data_pagamento?: string | null
          id?: string
          motorista_id?: string | null
          obs?: string | null
          pago?: boolean
          responsavel?: string | null
          servico_id?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      motoristas: {
        Row: {
          ativo: boolean
          categoria: string | null
          cnh: string | null
          comissao_pct: number
          comissao_valor: number
          created_at: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          cnh?: string | null
          comissao_pct?: number
          comissao_valor?: number
          created_at?: string
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          cnh?: string | null
          comissao_pct?: number
          comissao_valor?: number
          created_at?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nome: string
          pode_abrir_chamado: boolean
          receber_notificacoes: boolean
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome?: string
          pode_abrir_chamado?: boolean
          receber_notificacoes?: boolean
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          pode_abrir_chamado?: boolean
          receber_notificacoes?: boolean
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      servico_sequencias: {
        Row: {
          ano: number
          ultimo: number
        }
        Insert: {
          ano: number
          ultimo?: number
        }
        Update: {
          ano?: number
          ultimo?: number
        }
        Relationships: []
      }
      servicos: {
        Row: {
          cliente: string
          comissao_pct: number
          comissao_valor: number
          conta_id: string | null
          created_at: string
          created_by: string | null
          data: string
          destino: string | null
          id: string
          km: number
          motorista_id: string | null
          numero: string | null
          obs: string | null
          origem: string | null
          pagamento: string | null
          placa: string | null
          status: string
          telefone: string | null
          tipo: string
          updated_at: string
          valor: number
          veiculo_ano: string | null
          veiculo_id: string | null
          veiculo_modelo: string | null
          via: string
        }
        Insert: {
          cliente: string
          comissao_pct?: number
          comissao_valor?: number
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          destino?: string | null
          id?: string
          km?: number
          motorista_id?: string | null
          numero?: string | null
          obs?: string | null
          origem?: string | null
          pagamento?: string | null
          placa?: string | null
          status?: string
          telefone?: string | null
          tipo: string
          updated_at?: string
          valor?: number
          veiculo_ano?: string | null
          veiculo_id?: string | null
          veiculo_modelo?: string | null
          via?: string
        }
        Update: {
          cliente?: string
          comissao_pct?: number
          comissao_valor?: number
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          destino?: string | null
          id?: string
          km?: number
          motorista_id?: string | null
          numero?: string | null
          obs?: string | null
          origem?: string | null
          pagamento?: string | null
          placa?: string | null
          status?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
          veiculo_ano?: string | null
          veiculo_id?: string | null
          veiculo_modelo?: string | null
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          consumo_medio: number
          cor: string | null
          created_at: string
          id: string
          km: number
          marca: string | null
          modelo: string
          placa: string
          proxima_manutencao_km: number
          updated_at: string
        }
        Insert: {
          consumo_medio?: number
          cor?: string | null
          created_at?: string
          id?: string
          km?: number
          marca?: string | null
          modelo: string
          placa: string
          proxima_manutencao_km?: number
          updated_at?: string
        }
        Update: {
          consumo_medio?: number
          cor?: string | null
          created_at?: string
          id?: string
          km?: number
          marca?: string | null
          modelo?: string
          placa?: string
          proxima_manutencao_km?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gerar_numero_servico: { Args: { p_ano?: number }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operador" | "financeiro"
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
      app_role: ["admin", "operador", "financeiro"],
    },
  },
} as const
