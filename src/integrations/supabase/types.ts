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
      clients: {
        Row: {
          city: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          lead_id: string | null
          phone: string | null
          state: string | null
          status: string
          updated_at: string
          whatsapp: string | null
          workspace_id: string
        }
        Insert: {
          city?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          phone?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          workspace_id?: string
        }
        Update: {
          city?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          phone?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: string
          client_id: string | null
          created_at: string
          external_contact_id: string | null
          id: string
          last_message_at: string | null
          lead_id: string | null
          status: string
          unread_count: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string
          external_contact_id?: string | null
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string
          external_contact_id?: string | null
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          client_id: string | null
          commission_amount: number | null
          commission_currency: string
          created_at: string
          description: string | null
          expected_date: string | null
          id: string
          lead_id: string | null
          paid_date: string | null
          platform_amount: number | null
          platform_currency: string
          status: Database["public"]["Enums"]["financial_status"]
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          commission_amount?: number | null
          commission_currency?: string
          created_at?: string
          description?: string | null
          expected_date?: string | null
          id?: string
          lead_id?: string | null
          paid_date?: string | null
          platform_amount?: number | null
          platform_currency?: string
          status?: Database["public"]["Enums"]["financial_status"]
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          client_id?: string | null
          commission_amount?: number | null
          commission_currency?: string
          created_at?: string
          description?: string | null
          expected_date?: string | null
          id?: string
          lead_id?: string | null
          paid_date?: string | null
          platform_amount?: number | null
          platform_currency?: string
          status?: Database["public"]["Enums"]["financial_status"]
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      garimpos: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          niche: string | null
          original_file_name: string | null
          original_file_url: string | null
          research_date: string | null
          source: string | null
          state: string | null
          status: Database["public"]["Enums"]["garimpo_status"]
          total_leads: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          niche?: string | null
          original_file_name?: string | null
          original_file_url?: string | null
          research_date?: string | null
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["garimpo_status"]
          total_leads?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          niche?: string | null
          original_file_name?: string | null
          original_file_url?: string | null
          research_date?: string | null
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["garimpo_status"]
          total_leads?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garimpos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batch_rows: {
        Row: {
          created_at: string
          duplicate_action: string | null
          duplicate_matches: Json
          id: string
          import_batch_id: string
          parsed_data: Json
          raw_data: Json
          row_number: number
          selected_for_import: boolean
          status: string
          updated_at: string
          warnings: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          duplicate_action?: string | null
          duplicate_matches?: Json
          id?: string
          import_batch_id: string
          parsed_data?: Json
          raw_data?: Json
          row_number: number
          selected_for_import?: boolean
          status?: string
          updated_at?: string
          warnings?: Json
          workspace_id?: string
        }
        Update: {
          created_at?: string
          duplicate_action?: string | null
          duplicate_matches?: Json
          id?: string
          import_batch_id?: string
          parsed_data?: Json
          raw_data?: Json
          row_number?: number
          selected_for_import?: boolean
          status?: string
          updated_at?: string
          warnings?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batch_rows_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batch_rows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          duplicate_rows: number
          file_name: string | null
          file_type: string | null
          file_url: string | null
          garimpo_id: string | null
          id: string
          imported_rows: number
          invalid_rows: number
          status: Database["public"]["Enums"]["import_batch_status"]
          total_rows: number
          valid_rows: number
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          garimpo_id?: string | null
          id?: string
          imported_rows?: number
          invalid_rows?: number
          status?: Database["public"]["Enums"]["import_batch_status"]
          total_rows?: number
          valid_rows?: number
          workspace_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          garimpo_id?: string | null
          id?: string
          imported_rows?: number
          invalid_rows?: number
          status?: Database["public"]["Enums"]["import_batch_status"]
          total_rows?: number
          valid_rows?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_garimpo_id_fkey"
            columns: ["garimpo_id"]
            isOneToOne: false
            referencedRelation: "garimpos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          lead_id: string | null
          metadata: Json
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          user_id?: string | null
          workspace_id?: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          lead_id: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lead_id: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lead_id?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tag_links: {
        Row: {
          lead_id: string
          tag_id: string
        }
        Insert: {
          lead_id: string
          tag_id: string
        }
        Update: {
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tag_links_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "lead_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          archived_at: string | null
          archived_by: string | null
          assigned_to: string | null
          city: string | null
          commercial_observation: string | null
          company_name: string
          converted_at: string | null
          created_at: string
          digital_presence: string | null
          garimpo_id: string | null
          google_maps_url: string | null
          google_rating: number | null
          google_reviews: number | null
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          instagram_followers: number | null
          instagram_url: string | null
          last_contact_at: string | null
          neighborhood: string | null
          next_followup_at: string | null
          niche: string | null
          phone: string | null
          photo_quality: string | null
          position: number | null
          priority: Database["public"]["Enums"]["lead_priority"] | null
          raw_source_data: Json | null
          scheduling_type: string | null
          scheduling_url: string | null
          score: number | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          website_status: Database["public"]["Enums"]["website_status"]
          website_url: string | null
          whatsapp: string | null
          whatsapp_confirmed: boolean
          workspace_id: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_to?: string | null
          city?: string | null
          commercial_observation?: string | null
          company_name: string
          converted_at?: string | null
          created_at?: string
          digital_presence?: string | null
          garimpo_id?: string | null
          google_maps_url?: string | null
          google_rating?: number | null
          google_reviews?: number | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          instagram_followers?: number | null
          instagram_url?: string | null
          last_contact_at?: string | null
          neighborhood?: string | null
          next_followup_at?: string | null
          niche?: string | null
          phone?: string | null
          photo_quality?: string | null
          position?: number | null
          priority?: Database["public"]["Enums"]["lead_priority"] | null
          raw_source_data?: Json | null
          scheduling_type?: string | null
          scheduling_url?: string | null
          score?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          website_status?: Database["public"]["Enums"]["website_status"]
          website_url?: string | null
          whatsapp?: string | null
          whatsapp_confirmed?: boolean
          workspace_id?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_to?: string | null
          city?: string | null
          commercial_observation?: string | null
          company_name?: string
          converted_at?: string | null
          created_at?: string
          digital_presence?: string | null
          garimpo_id?: string | null
          google_maps_url?: string | null
          google_rating?: number | null
          google_reviews?: number | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          instagram_followers?: number | null
          instagram_url?: string | null
          last_contact_at?: string | null
          neighborhood?: string | null
          next_followup_at?: string | null
          niche?: string | null
          phone?: string | null
          photo_quality?: string | null
          position?: number | null
          priority?: Database["public"]["Enums"]["lead_priority"] | null
          raw_source_data?: Json | null
          scheduling_type?: string | null
          scheduling_url?: string | null
          score?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          website_status?: Database["public"]["Enums"]["website_status"]
          website_url?: string | null
          whatsapp?: string | null
          whatsapp_confirmed?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_garimpo_id_fkey"
            columns: ["garimpo_id"]
            isOneToOne: false
            referencedRelation: "garimpos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          stage: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          stage?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          stage?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          direction: string | null
          external_message_id: string | null
          id: string
          lead_id: string | null
          message_type: string | null
          read_at: string | null
          sender_type: string | null
          sender_user_id: string | null
          sent_at: string | null
          status: string | null
          workspace_id: string
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string | null
          external_message_id?: string | null
          id?: string
          lead_id?: string | null
          message_type?: string | null
          read_at?: string | null
          sender_type?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          status?: string | null
          workspace_id?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string | null
          external_message_id?: string | null
          id?: string
          lead_id?: string | null
          message_type?: string | null
          read_at?: string | null
          sender_type?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      site_projects: {
        Row: {
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          preview_url: string | null
          published_url: string | null
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          preview_url?: string | null
          published_url?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          preview_url?: string | null
          published_url?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          coexistence_enabled: boolean
          connected_at: string | null
          connection_status: string
          created_at: string
          disconnected_at: string | null
          id: string
          phone_number: string | null
          phone_number_id: string | null
          provider: string | null
          updated_at: string
          waba_id: string | null
          workspace_id: string
        }
        Insert: {
          coexistence_enabled?: boolean
          connected_at?: string | null
          connection_status?: string
          created_at?: string
          disconnected_at?: string | null
          id?: string
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string | null
          updated_at?: string
          waba_id?: string | null
          workspace_id?: string
        }
        Update: {
          coexistence_enabled?: boolean
          connected_at?: string | null
          connection_status?: string
          created_at?: string
          disconnected_at?: string | null
          id?: string
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string | null
          updated_at?: string
          waba_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_pending_invite: { Args: never; Returns: boolean }
      commit_import_batch: {
        Args: {
          _assigned_to?: string
          _batch_id: string
          _initial_status?: Database["public"]["Enums"]["lead_status"]
        }
        Returns: Json
      }
      convert_lead_to_client: { Args: { _lead_id: string }; Returns: string }
      current_workspace_id: { Args: never; Returns: string }
      find_lead_duplicates: {
        Args: {
          _city?: string
          _company?: string
          _exclude?: string
          _instagram?: string
          _maps?: string
          _phone?: string
          _website?: string
          _whatsapp?: string
        }
        Returns: {
          city: string
          company_name: string
          lead_id: string
          reasons: string[]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      norm_phone: { Args: { t: string }; Returns: string }
      norm_text: { Args: { t: string }; Returns: string }
      norm_url: { Args: { t: string }; Returns: string }
      signup_open: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operador"
      financial_status:
        | "pendente"
        | "confirmado"
        | "a_receber"
        | "recebido"
        | "cancelado"
      garimpo_status: "rascunho" | "processado" | "ativo" | "arquivado"
      import_batch_status:
        | "uploaded"
        | "processing"
        | "preview"
        | "ready"
        | "importing"
        | "completed"
        | "failed"
        | "cancelled"
      lead_priority: "A" | "B" | "C" | "D"
      lead_status:
        | "novo"
        | "validar"
        | "pronto_contato"
        | "abordagem_enviada"
        | "sem_resposta"
        | "respondeu"
        | "interessado"
        | "valor_apresentado"
        | "oferta_apresentada"
        | "link_enviado"
        | "convertido"
        | "recuperacao"
        | "perdido"
        | "nao_qualificado"
      project_status:
        | "aguardando"
        | "coleta_dados"
        | "producao"
        | "primeira_versao"
        | "revisao"
        | "aprovado"
        | "transferencia"
        | "publicado"
      website_status:
        | "nao_possui"
        | "site_fraco"
        | "site_razoavel"
        | "site_profissional"
        | "nao_confirmado"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "operador"],
      financial_status: [
        "pendente",
        "confirmado",
        "a_receber",
        "recebido",
        "cancelado",
      ],
      garimpo_status: ["rascunho", "processado", "ativo", "arquivado"],
      import_batch_status: [
        "uploaded",
        "processing",
        "preview",
        "ready",
        "importing",
        "completed",
        "failed",
        "cancelled",
      ],
      lead_priority: ["A", "B", "C", "D"],
      lead_status: [
        "novo",
        "validar",
        "pronto_contato",
        "abordagem_enviada",
        "sem_resposta",
        "respondeu",
        "interessado",
        "valor_apresentado",
        "oferta_apresentada",
        "link_enviado",
        "convertido",
        "recuperacao",
        "perdido",
        "nao_qualificado",
      ],
      project_status: [
        "aguardando",
        "coleta_dados",
        "producao",
        "primeira_versao",
        "revisao",
        "aprovado",
        "transferencia",
        "publicado",
      ],
      website_status: [
        "nao_possui",
        "site_fraco",
        "site_razoavel",
        "site_profissional",
        "nao_confirmado",
      ],
    },
  },
} as const
