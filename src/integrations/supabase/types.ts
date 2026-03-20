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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agenda_event_metadata: {
        Row: {
          created_at: string
          id: string
          priority: string
          project_id: string | null
          series_key: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority?: string
          project_id?: string | null
          series_key: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: string
          project_id?: string | null
          series_key?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_event_metadata_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_preferences: {
        Row: {
          priority_filter: string[]
          show_declined: boolean
          sort_mode: string
          status_filter: string
          tag_filter: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          priority_filter?: string[]
          show_declined?: boolean
          sort_mode?: string
          status_filter?: string
          tag_filter?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          priority_filter?: string[]
          show_declined?: boolean
          sort_mode?: string
          status_filter?: string
          tag_filter?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          alert_days_before: number
          amount: number
          category: string
          competency_date: string | null
          counterparty_name: string
          created_at: string
          currency: string
          description: string | null
          due_date: string
          id: string
          is_platform_cost: boolean
          notes: string | null
          paid_at: string | null
          project_id: string | null
          recurrence: string
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_days_before?: number
          amount?: number
          category: string
          competency_date?: string | null
          counterparty_name: string
          created_at?: string
          currency?: string
          description?: string | null
          due_date: string
          id?: string
          is_platform_cost?: boolean
          notes?: string | null
          paid_at?: string | null
          project_id?: string | null
          recurrence?: string
          status?: string
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_days_before?: number
          amount?: number
          category?: string
          competency_date?: string | null
          counterparty_name?: string
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string
          id?: string
          is_platform_cost?: boolean
          notes?: string | null
          paid_at?: string | null
          project_id?: string | null
          recurrence?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      google_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
          id: string
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          plan: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id: string
          name?: string | null
          plan?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          plan?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      skill_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      skill_documents: {
        Row: {
          category_id: string
          content_md: string
          created_at: string
          id: string
          last_downloaded_at: string | null
          project_id: string | null
          slug: string
          source_type: string
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          content_md: string
          created_at?: string
          id?: string
          last_downloaded_at?: string | null
          project_id?: string | null
          slug: string
          source_type: string
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          content_md?: string
          created_at?: string
          id?: string
          last_downloaded_at?: string | null
          project_id?: string | null
          slug?: string
          source_type?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      second_brain_links: {
        Row: {
          created_at: string
          id: string
          link_type: string
          source_note_id: string
          target_note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_type: string
          source_note_id: string
          target_note_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link_type?: string
          source_note_id?: string
          target_note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "second_brain_links_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "second_brain_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "second_brain_links_target_note_id_fkey"
            columns: ["target_note_id"]
            isOneToOne: false
            referencedRelation: "second_brain_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      second_brain_notes: {
        Row: {
          captured_at: string
          content_md: string
          created_at: string
          id: string
          project_id: string | null
          slug: string
          source_url: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          captured_at?: string
          content_md?: string
          created_at?: string
          id?: string
          project_id?: string | null
          slug: string
          source_url?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          captured_at?: string
          content_md?: string
          created_at?: string
          id?: string
          project_id?: string | null
          slug?: string
          source_url?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "second_brain_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client: string | null
          color: string | null
          created_at: string | null
          daily_agreed_hours: number | null
          daily_rate: number | null
          hourly_rate: number
          id: string
          monthly_agreed_amount: number | null
          monthly_agreed_hours: number | null
          name: string
          status: string | null
          updated_at: string | null
          user_id: string
          workdays: string[]
        }
        Insert: {
          client?: string | null
          color?: string | null
          created_at?: string | null
          daily_agreed_hours?: number | null
          daily_rate?: number | null
          hourly_rate?: number
          id?: string
          monthly_agreed_amount?: number | null
          monthly_agreed_hours?: number | null
          name: string
          status?: string | null
          updated_at?: string | null
          user_id: string
          workdays?: string[]
        }
        Update: {
          client?: string | null
          color?: string | null
          created_at?: string | null
          daily_agreed_hours?: number | null
          daily_rate?: number | null
          hourly_rate?: number
          id?: string
          monthly_agreed_amount?: number | null
          monthly_agreed_hours?: number | null
          name?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
          workdays?: string[]
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          position: number
          task_id: string
          title: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          position?: number
          task_id: string
          title: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          position?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          client: string | null
          column_index: number
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          importance: string
          position: number
          priority: string | null
          project_id: string | null
          skill_document_id: string | null
          title: string
          urgency: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client?: string | null
          column_index?: number
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          importance?: string
          position?: number
          priority?: string | null
          project_id?: string | null
          skill_document_id?: string | null
          title: string
          urgency?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client?: string | null
          column_index?: number
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          importance?: string
          position?: number
          priority?: string | null
          project_id?: string | null
          skill_document_id?: string | null
          title?: string
          urgency?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_skill_document_id_fkey"
            columns: ["skill_document_id"]
            isOneToOne: false
            referencedRelation: "skill_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      time_sessions: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          notes: string | null
          project_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          project_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_entries: {
        Row: {
          client: string | null
          created_at: string | null
          encrypted_password: string
          id: string
          iv: string
          notes: string | null
          project_id: string | null
          service: string | null
          updated_at: string | null
          url: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          client?: string | null
          created_at?: string | null
          encrypted_password: string
          id?: string
          iv: string
          notes?: string | null
          project_id?: string | null
          service?: string | null
          updated_at?: string | null
          url?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          client?: string | null
          created_at?: string | null
          encrypted_password?: string
          id?: string
          iv?: string
          notes?: string | null
          project_id?: string | null
          service?: string | null
          updated_at?: string | null
          url?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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

