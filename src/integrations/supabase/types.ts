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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bank_account_aliases: {
        Row: {
          id: string
          user_id: string
          source_bank_name: string
          source_account_last4: string
          target_bank_name: string
          target_account_last4: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_bank_name?: string
          source_account_last4?: string
          target_bank_name?: string
          target_account_last4?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_bank_name?: string
          source_account_last4?: string
          target_bank_name?: string
          target_account_last4?: string
          created_at?: string
        }
        Relationships: []
      }
      bank_account_nicknames: {
        Row: {
          id: string
          user_id: string
          bank_name: string
          account_last4: string
          nickname: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bank_name?: string
          account_last4?: string
          nickname: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bank_name?: string
          account_last4?: string
          nickname?: string
          created_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_system: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      categorization_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          merchant_normalized: string | null
          merchant_pattern: string
          priority: number
          user_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          merchant_normalized?: string | null
          merchant_pattern: string
          priority?: number
          user_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          merchant_normalized?: string | null
          merchant_pattern?: string
          priority?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorization_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          api_key: string | null
          created_at: string
          enable_review_mode: boolean
          full_name: string | null
          id: string
          monthly_budget: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          monthly_budget?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          monthly_budget?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      refund_links: {
        Row: {
          created_at: string
          id: string
          original_transaction_id: string
          refund_transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_transaction_id: string
          refund_transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_transaction_id?: string
          refund_transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_links_original_transaction_id_fkey"
            columns: ["original_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_links_refund_transaction_id_fkey"
            columns: ["refund_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_groups: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          id: string
          user_id: string
          title: string
          amount: number
          currency: string
          type: 'subscription' | 'emi' | 'lent' | 'borrowed' | 'custom'
          due_date: string
          is_recurring: boolean
          recurrence_interval: 'weekly' | 'monthly' | 'yearly' | null
          is_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          amount: number
          currency?: string
          type: 'subscription' | 'emi' | 'lent' | 'borrowed' | 'custom'
          due_date: string
          is_recurring?: boolean
          recurrence_interval?: 'weekly' | 'monthly' | 'yearly' | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          amount?: number
          currency?: string
          type?: 'subscription' | 'emi' | 'lent' | 'borrowed' | 'custom'
          due_date?: string
          is_recurring?: boolean
          recurrence_interval?: 'weekly' | 'monthly' | 'yearly' | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          account_last4: string | null
          amount: number
          bank_name: string | null
          category_id: string | null
          created_at: string
          direction: string
          group_id: string | null
          id: string
          is_expense: boolean
          is_income: boolean
          merchant: string | null
          merchant_normalized: string | null
          needs_review: boolean | null
          notes: string | null
          payment_method: string | null
          raw_sms: string | null
          transacted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_last4?: string | null
          amount: number
          bank_name?: string | null
          category_id?: string | null
          created_at?: string
          direction: string
          group_id?: string | null
          id?: string
          is_expense?: boolean
          is_income?: boolean
          merchant?: string | null
          merchant_normalized?: string | null
          notes?: string | null
          payment_method?: string | null
          raw_sms?: string | null
          transacted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_last4?: string | null
          amount?: number
          bank_name?: string | null
          category_id?: string | null
          created_at?: string
          direction?: string
          group_id?: string | null
          id?: string
          is_expense?: boolean
          is_income?: boolean
          merchant?: string | null
          merchant_normalized?: string | null
          notes?: string | null
          payment_method?: string | null
          raw_sms?: string | null
          transacted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "transaction_groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
