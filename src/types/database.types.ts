// GENERATED FILE — do not edit by hand.
// Regenerate with: pnpm types:gen   (requires a running local stack: pnpm db:start)
// Drift is checked in CI with: pnpm types:check

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          barangay_id: string | null
          correlation_id: string | null
          id: number
          metadata: Json
          metadata_hash: string | null
          occurred_at: string
          outcome: string
          source: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          barangay_id?: string | null
          correlation_id?: string | null
          id?: never
          metadata?: Json
          metadata_hash?: string | null
          occurred_at?: string
          outcome?: string
          source?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          barangay_id?: string | null
          correlation_id?: string | null
          id?: never
          metadata?: Json
          metadata_hash?: string | null
          occurred_at?: string
          outcome?: string
          source?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      barangays: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      membership_roles: {
        Row: {
          barangay_id: string
          granted_at: string
          granted_by: string | null
          membership_id: string
          role_key: string
          role_scope: Database["public"]["Enums"]["role_scope"]
        }
        Insert: {
          barangay_id: string
          granted_at?: string
          granted_by?: string | null
          membership_id: string
          role_key: string
          role_scope?: Database["public"]["Enums"]["role_scope"]
        }
        Update: {
          barangay_id?: string
          granted_at?: string
          granted_by?: string | null
          membership_id?: string
          role_key?: string
          role_scope?: Database["public"]["Enums"]["role_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "membership_roles_membership_id_barangay_id_fkey"
            columns: ["membership_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "barangay_id"]
          },
          {
            foreignKeyName: "membership_roles_role_key_role_scope_fkey"
            columns: ["role_key", "role_scope"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key", "scope"]
          },
        ]
      }
      memberships: {
        Row: {
          barangay_id: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          barangay_id: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          barangay_id?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string
          key: string
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Insert: {
          description?: string
          key: string
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Update: {
          description?: string
          key?: string
          scope?: Database["public"]["Enums"]["role_scope"]
        }
        Relationships: []
      }
      platform_role_assignments: {
        Row: {
          granted_at: string
          granted_by: string | null
          role_key: string
          role_scope: Database["public"]["Enums"]["role_scope"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role_key: string
          role_scope?: Database["public"]["Enums"]["role_scope"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role_key?: string
          role_scope?: Database["public"]["Enums"]["role_scope"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_role_assignments_role_key_role_scope_fkey"
            columns: ["role_key", "role_scope"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key", "scope"]
          },
          {
            foreignKeyName: "platform_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_key: string
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Insert: {
          permission_key: string
          role_key: string
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Update: {
          permission_key?: string
          role_key?: string
          scope?: Database["public"]["Enums"]["role_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_scope_fkey"
            columns: ["permission_key", "scope"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key", "scope"]
          },
          {
            foreignKeyName: "role_permissions_role_key_scope_fkey"
            columns: ["role_key", "scope"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key", "scope"]
          },
        ]
      }
      roles: {
        Row: {
          description: string
          key: string
          name: string
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Insert: {
          description?: string
          key: string
          name: string
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Update: {
          description?: string
          key?: string
          name?: string
          scope?: Database["public"]["Enums"]["role_scope"]
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_audit_entry: {
        Args: {
          p_action: string
          p_barangay_id?: string
          p_correlation_id?: string
          p_metadata?: Json
          p_outcome?: string
          p_source?: string
          p_target_id?: string
          p_target_type: string
        }
        Returns: number
      }
      auth_can_read_profile: { Args: { p_user_id: string }; Returns: boolean }
      auth_context: { Args: never; Returns: Json }
      auth_has_permission: {
        Args: { p_barangay_id: string; p_permission: string }
        Returns: boolean
      }
      auth_has_platform_permission: {
        Args: { p_permission: string }
        Returns: boolean
      }
      auth_is_active_member: {
        Args: { p_barangay_id: string }
        Returns: boolean
      }
      auth_is_platform_admin: { Args: never; Returns: boolean }
      create_membership_by_email: {
        Args: {
          p_barangay_id: string
          p_correlation_id?: string
          p_email: string
        }
        Returns: string
      }
    }
    Enums: {
      membership_status: "invited" | "active" | "disabled"
      role_scope: "platform" | "barangay"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      membership_status: ["invited", "active", "disabled"],
      role_scope: ["platform", "barangay"],
    },
  },
} as const
