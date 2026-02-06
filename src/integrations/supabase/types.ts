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
      classifications: {
        Row: {
          category: Database["public"]["Enums"]["email_category"]
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          extracted_entities: Json | null
          id: string
          message_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["email_category"]
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          extracted_entities?: Json | null
          id?: string
          message_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["email_category"]
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          extracted_entities?: Json | null
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          id: string
          provider: string
          refresh_token_encrypted: string | null
          status: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          id?: string
          provider: string
          refresh_token_encrypted?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          id?: string
          provider?: string
          refresh_token_encrypted?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_watch_state: {
        Row: {
          expiration: string | null
          gmail_email: string | null
          history_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expiration?: string | null
          gmail_email?: string | null
          history_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expiration?: string | null
          gmail_email?: string | null
          history_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body_full: string | null
          body_snippet: string | null
          created_at: string
          from_email: string
          from_name: string | null
          id: string
          is_demo: boolean | null
          processed: boolean | null
          provider_message_id: string | null
          received_at: string
          subject: string
          user_id: string
        }
        Insert: {
          body_full?: string | null
          body_snippet?: string | null
          created_at?: string
          from_email: string
          from_name?: string | null
          id?: string
          is_demo?: boolean | null
          processed?: boolean | null
          provider_message_id?: string | null
          received_at?: string
          subject: string
          user_id: string
        }
        Update: {
          body_full?: string | null
          body_snippet?: string | null
          created_at?: string
          from_email?: string
          from_name?: string | null
          id?: string
          is_demo?: boolean | null
          processed?: boolean | null
          provider_message_id?: string | null
          received_at?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      outcomes: {
        Row: {
          created_at: string
          final_action: Database["public"]["Enums"]["proposed_action_type"]
          final_reply_text: string | null
          id: string
          message_id: string
          status: Database["public"]["Enums"]["action_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          final_action: Database["public"]["Enums"]["proposed_action_type"]
          final_reply_text?: string | null
          id?: string
          message_id: string
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          final_action?: Database["public"]["Enums"]["proposed_action_type"]
          final_reply_text?: string | null
          id?: string
          message_id?: string
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_add_ticket_events: boolean | null
          auto_archive_newsletters: boolean | null
          auto_suggest_slots: boolean | null
          avatar_url: string | null
          created_at: string
          demo_mode: boolean | null
          flag_invoices: boolean | null
          full_name: string | null
          id: string
          meeting_default_duration: number | null
          meeting_min_notice_hours: number | null
          reply_tone: Database["public"]["Enums"]["reply_tone"] | null
          signature: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          auto_add_ticket_events?: boolean | null
          auto_archive_newsletters?: boolean | null
          auto_suggest_slots?: boolean | null
          avatar_url?: string | null
          created_at?: string
          demo_mode?: boolean | null
          flag_invoices?: boolean | null
          full_name?: string | null
          id?: string
          meeting_default_duration?: number | null
          meeting_min_notice_hours?: number | null
          reply_tone?: Database["public"]["Enums"]["reply_tone"] | null
          signature?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          auto_add_ticket_events?: boolean | null
          auto_archive_newsletters?: boolean | null
          auto_suggest_slots?: boolean | null
          avatar_url?: string | null
          created_at?: string
          demo_mode?: boolean | null
          flag_invoices?: boolean | null
          full_name?: string | null
          id?: string
          meeting_default_duration?: number | null
          meeting_min_notice_hours?: number | null
          reply_tone?: Database["public"]["Enums"]["reply_tone"] | null
          signature?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          created_at: string
          id: string
          message_id: string
          proposed_action: Database["public"]["Enums"]["proposed_action_type"]
          suggested_reply: string | null
          suggested_time_slots: Json | null
          summary: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          proposed_action: Database["public"]["Enums"]["proposed_action_type"]
          suggested_reply?: string | null
          suggested_time_slots?: Json | null
          summary: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          proposed_action?: Database["public"]["Enums"]["proposed_action_type"]
          suggested_reply?: string | null
          suggested_time_slots?: Json | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
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
      action_status: "pending" | "sent" | "drafted" | "archived" | "declined"
      confidence_level: "low" | "medium" | "high"
      email_category:
        | "meeting_request"
        | "action_needed"
        | "fyi"
        | "newsletter"
        | "other"
      proposed_action_type:
        | "reply"
        | "draft"
        | "schedule"
        | "ask_question"
        | "archive"
        | "mark_done"
        | "decline"
      reply_tone: "neutral" | "friendly" | "formal"
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
      action_status: ["pending", "sent", "drafted", "archived", "declined"],
      confidence_level: ["low", "medium", "high"],
      email_category: [
        "meeting_request",
        "action_needed",
        "fyi",
        "newsletter",
        "other",
      ],
      proposed_action_type: [
        "reply",
        "draft",
        "schedule",
        "ask_question",
        "archive",
        "mark_done",
        "decline",
      ],
      reply_tone: ["neutral", "friendly", "formal"],
    },
  },
} as const
