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
      certificate_artifacts: {
        Row: {
          barangay_id: string
          certificate_id: string
          content_hash: string | null
          created_at: string
          generated_at: string | null
          generated_by: string | null
          id: string
          mime_type: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          barangay_id: string
          certificate_id: string
          content_hash?: string | null
          created_at?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          mime_type: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          barangay_id?: string
          certificate_id?: string
          content_hash?: string | null
          created_at?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          mime_type?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_artifacts_certificate_id_barangay_id_fkey"
            columns: ["certificate_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
      certificate_series: {
        Row: {
          barangay_id: string
          created_at: string
          format_is_placeholder: boolean
          id: string
          is_active: boolean
          next_sequence: number
          prefix: string
          sequence_width: number
          updated_at: string
          year: number
        }
        Insert: {
          barangay_id: string
          created_at?: string
          format_is_placeholder?: boolean
          id?: string
          is_active?: boolean
          next_sequence?: number
          prefix: string
          sequence_width?: number
          updated_at?: string
          year: number
        }
        Update: {
          barangay_id?: string
          created_at?: string
          format_is_placeholder?: boolean
          id?: string
          is_active?: boolean
          next_sequence?: number
          prefix?: string
          sequence_width?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificate_series_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          barangay_id: string
          body: string
          code: string
          content_is_placeholder: boolean
          created_at: string
          document_type_id: string
          id: string
          is_active: boolean
          name: string
          requires_wet_signature: boolean
          signatory_name: string | null
          signatory_title: string | null
          updated_at: string
        }
        Insert: {
          barangay_id: string
          body: string
          code: string
          content_is_placeholder?: boolean
          created_at?: string
          document_type_id: string
          id?: string
          is_active?: boolean
          name: string
          requires_wet_signature?: boolean
          signatory_name?: string | null
          signatory_title?: string | null
          updated_at?: string
        }
        Update: {
          barangay_id?: string
          body?: string
          code?: string
          content_is_placeholder?: boolean
          created_at?: string
          document_type_id?: string
          id?: string
          is_active?: boolean
          name?: string
          requires_wet_signature?: boolean
          signatory_name?: string | null
          signatory_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_templates_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_templates_document_type_id_barangay_id_fkey"
            columns: ["document_type_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
      certificate_voids: {
        Row: {
          barangay_id: string
          certificate_id: string
          id: string
          reason: string
          voided_at: string
          voided_by: string | null
        }
        Insert: {
          barangay_id: string
          certificate_id: string
          id?: string
          reason: string
          voided_at?: string
          voided_by?: string | null
        }
        Update: {
          barangay_id?: string
          certificate_id?: string
          id?: string
          reason?: string
          voided_at?: string
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_voids_certificate_id_barangay_id_fkey"
            columns: ["certificate_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
      certificates: {
        Row: {
          barangay_id: string
          created_at: string
          id: string
          issued_at: string
          issued_by: string | null
          person_id: string
          request_id: string
          serial_display: string
          serial_is_placeholder: boolean
          serial_sequence: number
          series_id: string
          status: Database["public"]["Enums"]["certificate_status"]
          template_id: string
          updated_at: string
          verification_token: string
        }
        Insert: {
          barangay_id: string
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          person_id: string
          request_id: string
          serial_display: string
          serial_is_placeholder?: boolean
          serial_sequence: number
          series_id: string
          status?: Database["public"]["Enums"]["certificate_status"]
          template_id: string
          updated_at?: string
          verification_token: string
        }
        Update: {
          barangay_id?: string
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          person_id?: string
          request_id?: string
          serial_display?: string
          serial_is_placeholder?: boolean
          serial_sequence?: number
          series_id?: string
          status?: Database["public"]["Enums"]["certificate_status"]
          template_id?: string
          updated_at?: string
          verification_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_person_id_barangay_id_fkey"
            columns: ["person_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "barangay_id"]
          },
          {
            foreignKeyName: "certificates_request_id_barangay_id_fkey"
            columns: ["request_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id", "barangay_id"]
          },
          {
            foreignKeyName: "certificates_series_id_barangay_id_fkey"
            columns: ["series_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "certificate_series"
            referencedColumns: ["id", "barangay_id"]
          },
          {
            foreignKeyName: "certificates_template_id_barangay_id_fkey"
            columns: ["template_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
      document_request_answers: {
        Row: {
          barangay_id: string
          created_at: string
          id: string
          request_id: string
          requirement_id: string
          updated_at: string
          value: string
        }
        Insert: {
          barangay_id: string
          created_at?: string
          id?: string
          request_id: string
          requirement_id: string
          updated_at?: string
          value: string
        }
        Update: {
          barangay_id?: string
          created_at?: string
          id?: string
          request_id?: string
          requirement_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_request_answers_request_id_barangay_id_fkey"
            columns: ["request_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id", "barangay_id"]
          },
          {
            foreignKeyName: "document_request_answers_requirement_id_barangay_id_fkey"
            columns: ["requirement_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "document_type_requirements"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
      document_request_evidence: {
        Row: {
          barangay_id: string
          content_hash: string | null
          created_at: string
          declared_size_bytes: number
          id: string
          mime_type: string
          request_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          barangay_id: string
          content_hash?: string | null
          created_at?: string
          declared_size_bytes: number
          id?: string
          mime_type: string
          request_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          barangay_id?: string
          content_hash?: string | null
          created_at?: string
          declared_size_bytes?: number
          id?: string
          mime_type?: string
          request_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_request_evidence_request_id_barangay_id_fkey"
            columns: ["request_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
      document_requests: {
        Row: {
          barangay_id: string
          created_at: string
          created_by: string | null
          creation_reason: string | null
          document_type_id: string
          id: string
          person_id: string
          purpose: string
          ready_at: string | null
          review_started_at: string | null
          source_channel: Database["public"]["Enums"]["request_source"]
          state: Database["public"]["Enums"]["document_request_state"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          barangay_id: string
          created_at?: string
          created_by?: string | null
          creation_reason?: string | null
          document_type_id: string
          id?: string
          person_id: string
          purpose: string
          ready_at?: string | null
          review_started_at?: string | null
          source_channel: Database["public"]["Enums"]["request_source"]
          state?: Database["public"]["Enums"]["document_request_state"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          barangay_id?: string
          created_at?: string
          created_by?: string | null
          creation_reason?: string | null
          document_type_id?: string
          id?: string
          person_id?: string
          purpose?: string
          ready_at?: string | null
          review_started_at?: string | null
          source_channel?: Database["public"]["Enums"]["request_source"]
          state?: Database["public"]["Enums"]["document_request_state"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_document_type_id_barangay_id_fkey"
            columns: ["document_type_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id", "barangay_id"]
          },
          {
            foreignKeyName: "document_requests_person_id_barangay_id_fkey"
            columns: ["person_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
      document_type_requirements: {
        Row: {
          barangay_id: string
          created_at: string
          document_type_id: string
          help_text: string | null
          id: string
          input_kind: Database["public"]["Enums"]["requirement_input_kind"]
          is_required: boolean
          key: string
          label: string
          options: Json
          sort_order: number
        }
        Insert: {
          barangay_id: string
          created_at?: string
          document_type_id: string
          help_text?: string | null
          id?: string
          input_kind?: Database["public"]["Enums"]["requirement_input_kind"]
          is_required?: boolean
          key: string
          label: string
          options?: Json
          sort_order?: number
        }
        Update: {
          barangay_id?: string
          created_at?: string
          document_type_id?: string
          help_text?: string | null
          id?: string
          input_kind?: Database["public"]["Enums"]["requirement_input_kind"]
          is_required?: boolean
          key?: string
          label?: string
          options?: Json
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_type_requirements_document_type_id_barangay_id_fkey"
            columns: ["document_type_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
      document_types: {
        Row: {
          barangay_id: string
          code: string
          created_at: string
          description: string | null
          fee_amount: number | null
          fee_currency: string
          id: string
          is_active: boolean
          name: string
          requires_supporting_evidence: boolean
          sla_days: number | null
          updated_at: string
          validity_days: number | null
          values_are_placeholder: boolean
        }
        Insert: {
          barangay_id: string
          code: string
          created_at?: string
          description?: string | null
          fee_amount?: number | null
          fee_currency?: string
          id?: string
          is_active?: boolean
          name: string
          requires_supporting_evidence?: boolean
          sla_days?: number | null
          updated_at?: string
          validity_days?: number | null
          values_are_placeholder?: boolean
        }
        Update: {
          barangay_id?: string
          code?: string
          created_at?: string
          description?: string | null
          fee_amount?: number | null
          fee_currency?: string
          id?: string
          is_active?: boolean
          name?: string
          requires_supporting_evidence?: boolean
          sla_days?: number | null
          updated_at?: string
          validity_days?: number | null
          values_are_placeholder?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "document_types_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
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
      outbox_events: {
        Row: {
          barangay_id: string
          correlation_id: string | null
          created_at: string
          dispatch_status: string
          dispatched_at: string | null
          event_type: string
          id: number
          payload: Json
        }
        Insert: {
          barangay_id: string
          correlation_id?: string | null
          created_at?: string
          dispatch_status?: string
          dispatched_at?: string | null
          event_type: string
          id?: never
          payload?: Json
        }
        Update: {
          barangay_id?: string
          correlation_id?: string | null
          created_at?: string
          dispatch_status?: string
          dispatched_at?: string | null
          event_type?: string
          id?: never
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "outbox_events_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
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
      person_accounts: {
        Row: {
          barangay_id: string
          linked_at: string
          linked_by: string | null
          person_id: string
          user_id: string
        }
        Insert: {
          barangay_id: string
          linked_at?: string
          linked_by?: string | null
          person_id: string
          user_id: string
        }
        Update: {
          barangay_id?: string
          linked_at?: string
          linked_by?: string | null
          person_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_accounts_person_id_barangay_id_fkey"
            columns: ["person_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "barangay_id"]
          },
          {
            foreignKeyName: "person_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      persons: {
        Row: {
          address_line: string | null
          barangay_id: string
          birthdate: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          creation_reason: string | null
          first_name: string
          id: string
          last_name: string
          middle_name: string | null
          residency_basis_explanation: string | null
          residency_basis_key: Database["public"]["Enums"]["residency_basis"]
          search_text: string
          source_channel: Database["public"]["Enums"]["person_source"]
          suffix: string | null
          superseded_at: string | null
          superseded_by: string | null
          superseded_reason: string | null
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          barangay_id: string
          birthdate?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          creation_reason?: string | null
          first_name: string
          id?: string
          last_name: string
          middle_name?: string | null
          residency_basis_explanation?: string | null
          residency_basis_key: Database["public"]["Enums"]["residency_basis"]
          search_text?: string
          source_channel: Database["public"]["Enums"]["person_source"]
          suffix?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
          superseded_reason?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          barangay_id?: string
          birthdate?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          creation_reason?: string | null
          first_name?: string
          id?: string
          last_name?: string
          middle_name?: string | null
          residency_basis_explanation?: string | null
          residency_basis_key?: Database["public"]["Enums"]["residency_basis"]
          search_text?: string
          source_channel?: Database["public"]["Enums"]["person_source"]
          suffix?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
          superseded_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "persons_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persons_residency_basis_key_fkey"
            columns: ["residency_basis_key"]
            isOneToOne: false
            referencedRelation: "residency_bases"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "persons_superseded_by_barangay_id_fkey"
            columns: ["superseded_by", "barangay_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
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
      residency_bases: {
        Row: {
          key: Database["public"]["Enums"]["residency_basis"]
          name: string
          requires_explanation: boolean
        }
        Insert: {
          key: Database["public"]["Enums"]["residency_basis"]
          name: string
          requires_explanation?: boolean
        }
        Update: {
          key?: Database["public"]["Enums"]["residency_basis"]
          name?: string
          requires_explanation?: boolean
        }
        Relationships: []
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
      verification_applications: {
        Row: {
          barangay_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          info_request_note: string | null
          person_id: string
          state: Database["public"]["Enums"]["verification_state"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          barangay_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          info_request_note?: string | null
          person_id: string
          state?: Database["public"]["Enums"]["verification_state"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          barangay_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          info_request_note?: string | null
          person_id?: string
          state?: Database["public"]["Enums"]["verification_state"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_applications_person_id_barangay_id_fkey"
            columns: ["person_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
      verification_evidence: {
        Row: {
          application_id: string
          barangay_id: string
          content_hash: string | null
          created_at: string
          declared_size_bytes: number
          id: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          mime_type: string
          size_bytes: number | null
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          application_id: string
          barangay_id: string
          content_hash?: string | null
          created_at?: string
          declared_size_bytes: number
          id?: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          mime_type: string
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          application_id?: string
          barangay_id?: string
          content_hash?: string | null
          created_at?: string
          declared_size_bytes?: number
          id?: string
          kind?: Database["public"]["Enums"]["evidence_kind"]
          mime_type?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_evidence_application_id_barangay_id_fkey"
            columns: ["application_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "verification_applications"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_document_type_requirement: {
        Args: {
          p_document_type_id: string
          p_help_text?: string
          p_input_kind?: Database["public"]["Enums"]["requirement_input_kind"]
          p_is_required?: boolean
          p_key: string
          p_label: string
          p_options?: Json
          p_sort_order?: number
        }
        Returns: string
      }
      add_evidence_metadata: {
        Args: {
          p_application_id: string
          p_declared_size_bytes: number
          p_kind: Database["public"]["Enums"]["evidence_kind"]
          p_mime_type: string
        }
        Returns: {
          evidence_id: string
          storage_path: string
        }[]
      }
      add_request_evidence_metadata: {
        Args: {
          p_declared_size_bytes: number
          p_mime_type: string
          p_request_id: string
        }
        Returns: {
          evidence_id: string
          storage_path: string
        }[]
      }
      allocate_certificate_serial: {
        Args: { p_series_id: string }
        Returns: {
          display: string
          is_placeholder: boolean
          sequence_number: number
        }[]
      }
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
      approve_verification: {
        Args: { p_application_id: string; p_correlation_id?: string }
        Returns: undefined
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
      barangay_is_public: { Args: { p_barangay_id: string }; Returns: boolean }
      caller_has_request_for_type: {
        Args: { p_document_type_id: string }
        Returns: boolean
      }
      caller_owns_application: {
        Args: { p_application_id: string }
        Returns: boolean
      }
      caller_owns_certificate: {
        Args: { p_certificate_id: string }
        Returns: boolean
      }
      caller_owns_person: { Args: { p_person_id: string }; Returns: boolean }
      caller_owns_request: { Args: { p_request_id: string }; Returns: boolean }
      caller_person_in: { Args: { p_barangay_id: string }; Returns: string }
      confirm_evidence_upload: {
        Args: { p_content_hash: string; p_evidence_id: string }
        Returns: undefined
      }
      confirm_request_evidence_upload: {
        Args: { p_content_hash: string; p_evidence_id: string }
        Returns: undefined
      }
      create_certificate_series: {
        Args: {
          p_barangay_id: string
          p_prefix: string
          p_sequence_width?: number
          p_year: number
        }
        Returns: string
      }
      create_certificate_template: {
        Args: {
          p_barangay_id: string
          p_body: string
          p_code: string
          p_document_type_id: string
          p_name: string
          p_signatory_name?: string
          p_signatory_title?: string
        }
        Returns: string
      }
      create_document_type: {
        Args: {
          p_barangay_id: string
          p_code: string
          p_description?: string
          p_fee_amount?: number
          p_name: string
          p_requires_supporting_evidence?: boolean
          p_sla_days?: number
          p_validity_days?: number
        }
        Returns: string
      }
      create_membership_by_email: {
        Args: {
          p_barangay_id: string
          p_correlation_id?: string
          p_email: string
        }
        Returns: string
      }
      create_own_person: {
        Args: {
          p_address_line?: string
          p_barangay_id: string
          p_birthdate?: string
          p_contact_phone?: string
          p_first_name: string
          p_last_name: string
          p_middle_name?: string
          p_residency_basis: Database["public"]["Enums"]["residency_basis"]
          p_residency_explanation?: string
          p_suffix?: string
        }
        Returns: string
      }
      create_own_request: {
        Args: {
          p_barangay_id: string
          p_document_type_id: string
          p_purpose: string
        }
        Returns: string
      }
      create_verification_application: {
        Args: { p_person_id: string }
        Returns: string
      }
      create_walk_in_person: {
        Args: {
          p_address_line?: string
          p_barangay_id: string
          p_birthdate?: string
          p_contact_phone?: string
          p_first_name: string
          p_last_name: string
          p_middle_name?: string
          p_reason: string
          p_residency_basis: Database["public"]["Enums"]["residency_basis"]
          p_residency_explanation?: string
          p_suffix?: string
        }
        Returns: string
      }
      create_walk_in_request: {
        Args: {
          p_barangay_id: string
          p_document_type_id: string
          p_person_id: string
          p_purpose: string
          p_reason: string
        }
        Returns: string
      }
      document_type_is_visible: {
        Args: { p_document_type_id: string }
        Returns: boolean
      }
      duplicate_candidates: {
        Args: {
          p_barangay_id: string
          p_birthdate?: string
          p_exclude_person?: string
          p_first_name: string
          p_last_name: string
        }
        Returns: {
          birthdate: string
          first_name: string
          has_account: boolean
          last_name: string
          name_similarity: number
          person_id: string
          same_birthdate: boolean
        }[]
      }
      enqueue_outbox: {
        Args: {
          p_barangay_id: string
          p_correlation_id?: string
          p_event_type: string
          p_payload: Json
        }
        Returns: number
      }
      evidence_object_readable: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      evidence_object_writable: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      format_certificate_serial: {
        Args: {
          p_prefix: string
          p_sequence: number
          p_width: number
          p_year: number
        }
        Returns: string
      }
      issue_certificate: {
        Args: {
          p_correlation_id?: string
          p_request_id: string
          p_template_id: string
        }
        Returns: string
      }
      link_person_account: {
        Args: { p_person_id: string; p_user_id: string }
        Returns: undefined
      }
      list_active_barangays: {
        Args: never
        Returns: {
          code: string
          id: string
          name: string
        }[]
      }
      list_public_barangays: {
        Args: never
        Returns: {
          code: string
          id: string
          name: string
        }[]
      }
      mark_request_ready: {
        Args: { p_correlation_id?: string; p_request_id: string }
        Returns: undefined
      }
      person_is_verified: { Args: { p_person_id: string }; Returns: boolean }
      person_search: {
        Args: { p_barangay_id: string; p_limit?: number; p_query: string }
        Returns: {
          birthdate: string
          first_name: string
          has_account: boolean
          last_name: string
          middle_name: string
          person_id: string
          rank: number
          residency_basis_key: Database["public"]["Enums"]["residency_basis"]
          source_channel: Database["public"]["Enums"]["person_source"]
          superseded: boolean
        }[]
      }
      register_certificate_artifact: {
        Args: { p_certificate_id: string }
        Returns: {
          artifact_id: string
          storage_path: string
        }[]
      }
      reject_verification: {
        Args: {
          p_application_id: string
          p_correlation_id?: string
          p_reason: string
        }
        Returns: undefined
      }
      remove_evidence: { Args: { p_evidence_id: string }; Returns: undefined }
      remove_request_evidence: {
        Args: { p_evidence_id: string }
        Returns: undefined
      }
      request_evidence_object_readable: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      request_evidence_object_writable: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      request_information: {
        Args: {
          p_application_id: string
          p_correlation_id?: string
          p_note: string
        }
        Returns: undefined
      }
      resubmit_verification: {
        Args: { p_application_id: string; p_correlation_id?: string }
        Returns: undefined
      }
      review_request: {
        Args: { p_correlation_id?: string; p_request_id: string }
        Returns: undefined
      }
      review_verification: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      set_request_answer: {
        Args: {
          p_request_id: string
          p_requirement_id: string
          p_value: string
        }
        Returns: string
      }
      submit_request: {
        Args: { p_correlation_id?: string; p_request_id: string }
        Returns: undefined
      }
      submit_verification: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      supersede_person: {
        Args: { p_loser_id: string; p_reason: string; p_survivor_id: string }
        Returns: undefined
      }
      unlink_person_account: {
        Args: { p_person_id: string; p_reason: string }
        Returns: undefined
      }
      void_certificate: {
        Args: {
          p_certificate_id: string
          p_correlation_id?: string
          p_reason: string
        }
        Returns: undefined
      }
    }
    Enums: {
      certificate_status: "issued" | "voided"
      document_request_state:
        | "draft"
        | "submitted"
        | "in_review"
        | "ready_for_issue"
      evidence_kind: "identity" | "residency" | "supporting"
      membership_status: "invited" | "active" | "disabled"
      person_source: "self" | "staff"
      request_source: "self" | "staff"
      requirement_input_kind:
        | "text"
        | "textarea"
        | "number"
        | "date"
        | "boolean"
        | "select"
      residency_basis:
        | "property_owner"
        | "renter"
        | "household_member"
        | "caretaker"
        | "informal_resident"
        | "other"
      role_scope: "platform" | "barangay"
      verification_state:
        | "draft"
        | "submitted"
        | "in_review"
        | "info_requested"
        | "resubmitted"
        | "approved"
        | "rejected"
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
      certificate_status: ["issued", "voided"],
      document_request_state: [
        "draft",
        "submitted",
        "in_review",
        "ready_for_issue",
      ],
      evidence_kind: ["identity", "residency", "supporting"],
      membership_status: ["invited", "active", "disabled"],
      person_source: ["self", "staff"],
      request_source: ["self", "staff"],
      requirement_input_kind: [
        "text",
        "textarea",
        "number",
        "date",
        "boolean",
        "select",
      ],
      residency_basis: [
        "property_owner",
        "renter",
        "household_member",
        "caretaker",
        "informal_resident",
        "other",
      ],
      role_scope: ["platform", "barangay"],
      verification_state: [
        "draft",
        "submitted",
        "in_review",
        "info_requested",
        "resubmitted",
        "approved",
        "rejected",
      ],
    },
  },
} as const
