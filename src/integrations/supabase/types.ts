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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      asset_component_events: {
        Row: {
          asset_id: string
          company_id: string
          component: string
          created_at: string
          created_by: string
          details: string
          event_date: string
          event_type: string
          id: string
          warranty_until: string | null
        }
        Insert: {
          asset_id: string
          company_id?: string
          component: string
          created_at?: string
          created_by?: string
          details?: string
          event_date?: string
          event_type: string
          id?: string
          warranty_until?: string | null
        }
        Update: {
          asset_id?: string
          company_id?: string
          component?: string
          created_at?: string
          created_by?: string
          details?: string
          event_date?: string
          event_type?: string
          id?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_component_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_component_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_category: string
          client_id: string
          company_id: string
          custom_attributes: Json
          id: string
          location_details: string | null
          reference_number: string
          serial_number: string | null
          site_id: string | null
        }
        Insert: {
          asset_category: string
          client_id: string
          company_id: string
          custom_attributes?: Json
          id?: string
          location_details?: string | null
          reference_number: string
          serial_number?: string | null
          site_id?: string | null
        }
        Update: {
          asset_category?: string
          client_id?: string
          company_id?: string
          custom_attributes?: Json
          id?: string
          location_details?: string | null
          reference_number?: string
          serial_number?: string | null
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reads: {
        Row: {
          last_read_at: string
          thread_key: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          thread_key: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          thread_key?: string
          user_id?: string
        }
        Relationships: []
      }
      checklist_templates: {
        Row: {
          company_id: string
          created_at: string
          equipment_category: string
          id: string
          items: Json
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          equipment_category: string
          id?: string
          items?: Json
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          equipment_category?: string
          id?: string
          items?: Json
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          all_sites: boolean
          client_id: string
          company_id: string
          delivery_preferences: Json | null
          email: string | null
          first_name: string
          has_whatsapp: boolean
          id: string
          is_primary_contact: boolean
          last_name: string | null
          phone: string | null
          receives_job_sheets: boolean
          role_title: string | null
          site_id: string | null
          site_ids: string[]
        }
        Insert: {
          all_sites?: boolean
          client_id: string
          company_id: string
          delivery_preferences?: Json | null
          email?: string | null
          first_name: string
          has_whatsapp?: boolean
          id?: string
          is_primary_contact?: boolean
          last_name?: string | null
          phone?: string | null
          receives_job_sheets?: boolean
          role_title?: string | null
          site_id?: string | null
          site_ids?: string[]
        }
        Update: {
          all_sites?: boolean
          client_id?: string
          company_id?: string
          delivery_preferences?: Json | null
          email?: string | null
          first_name?: string
          has_whatsapp?: boolean
          id?: string
          is_primary_contact?: boolean
          last_name?: string | null
          phone?: string | null
          receives_job_sheets?: boolean
          role_title?: string | null
          site_id?: string | null
          site_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_audit: {
        Row: {
          action: string
          actor_id: string
          client_id: string
          company_id: string
          contact_id: string | null
          created_at: string
          id: string
        }
        Insert: {
          action: string
          actor_id: string
          client_id: string
          company_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          client_id?: string
          company_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      client_portal_invites: {
        Row: {
          access_role: string
          all_sites: boolean
          client_id: string
          company_id: string
          contact_id: string
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          revoked_at: string | null
          site_ids: string[]
          token_hash: string
          used_at: string | null
        }
        Insert: {
          access_role?: string
          all_sites?: boolean
          client_id: string
          company_id: string
          contact_id: string
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          site_ids?: string[]
          token_hash: string
          used_at?: string | null
        }
        Update: {
          access_role?: string
          all_sites?: boolean
          client_id?: string
          company_id?: string
          contact_id?: string
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          site_ids?: string[]
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_invites_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_memberships: {
        Row: {
          access_role: string
          all_sites: boolean
          client_id: string
          company_id: string
          contact_id: string
          created_at: string
          id: string
          revoked_at: string | null
          site_ids: string[]
          user_id: string
        }
        Insert: {
          access_role?: string
          all_sites?: boolean
          client_id: string
          company_id: string
          contact_id: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          site_ids?: string[]
          user_id: string
        }
        Update: {
          access_role?: string
          all_sites?: boolean
          client_id?: string
          company_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          site_ids?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_memberships_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_memberships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_report_photos: {
        Row: {
          kind: string
          photo_path: string
          report_id: string
        }
        Insert: {
          kind?: string
          photo_path: string
          report_id: string
        }
        Update: {
          kind?: string
          photo_path?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_report_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "client_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reports: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          revoked_at: string | null
          sheet_id: string
          snapshot: Json
          token_hash: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          sheet_id: string
          snapshot: Json
          token_hash: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          sheet_id?: string
          snapshot?: Json
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_address: string | null
          company_id: string
          created_at: string
          id: string
          labor_rates: Json | null
          location: string | null
          name: string
          preapprove_departure: boolean
          property_name: string | null
          street_name: string | null
          waive_transport: boolean
        }
        Insert: {
          billing_address?: string | null
          company_id: string
          created_at?: string
          id?: string
          labor_rates?: Json | null
          location?: string | null
          name: string
          preapprove_departure?: boolean
          property_name?: string | null
          street_name?: string | null
          waive_transport?: boolean
        }
        Update: {
          billing_address?: string | null
          company_id?: string
          created_at?: string
          id?: string
          labor_rates?: Json | null
          location?: string | null
          name?: string
          preapprove_departure?: boolean
          property_name?: string | null
          street_name?: string | null
          waive_transport?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          audience: string[]
          category: string
          company_id: string
          created_at: string
          file_path: string
          file_size: number
          id: string
          name: string
          notes: string | null
          uploaded_by: string | null
        }
        Insert: {
          audience?: string[]
          category: string
          company_id: string
          created_at?: string
          file_path: string
          file_size?: number
          id?: string
          name: string
          notes?: string | null
          uploaded_by?: string | null
        }
        Update: {
          audience?: string[]
          category?: string
          company_id?: string
          created_at?: string
          file_path?: string
          file_size?: number
          id?: string
          name?: string
          notes?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invites: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_price_list_items: {
        Row: {
          archived_at: string | null
          category: string
          code: string | null
          company_id: string
          cost_price: number
          created_at: string
          description: string | null
          id: string
          installation_method: string | null
          is_tally: boolean
          name: string
          sort_order: number
          subcategory: string
          trade: string
          unit: string
          unit_rate: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          archived_at?: string | null
          category?: string
          code?: string | null
          company_id?: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          installation_method?: string | null
          is_tally?: boolean
          name: string
          sort_order?: number
          subcategory?: string
          trade?: string
          unit?: string
          unit_rate?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          archived_at?: string | null
          category?: string
          code?: string | null
          company_id?: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          installation_method?: string | null
          is_tally?: boolean
          name?: string
          sort_order?: number
          subcategory?: string
          trade?: string
          unit?: string
          unit_rate?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_price_list_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          after_hours_rate: number
          app_title: string
          break_enabled: boolean
          break_minutes: number
          breaks_per_shift: number
          company_address: string | null
          company_email: string | null
          company_id: string
          currency: string
          default_country_code: string
          default_rates: Json
          emergency_phone: string | null
          equipment_categories: string[]
          equipment_label: string
          estimate_config: Json
          holiday_rate: number
          idle_timeout_minutes: number
          industry: string | null
          integrations: Json
          location_ping_seconds: number
          logo_data: string | null
          note_presets: Json
          office_address: Json
          office_phone: string | null
          payroll_mode: string
          pdf_template: Json
          pe_number: string | null
          public_holidays: string[]
          renewal_notice_days: number
          saturday_rate: number
          standby_order: string[]
          standby_per_shift: number
          standby_rotation_days: number
          standby_start: string
          sunday_rate: number
          technical_structure: Json
          terms: Json
          theme: Json
          trades: string[]
          updated_at: string
          vat_number: string
          website: string | null
          whatsapp_phone: string | null
          work_days: number[]
          work_end: string
          work_start: string
        }
        Insert: {
          after_hours_rate?: number
          app_title?: string
          break_enabled?: boolean
          break_minutes?: number
          breaks_per_shift?: number
          company_address?: string | null
          company_email?: string | null
          company_id: string
          currency?: string
          default_country_code?: string
          default_rates?: Json
          emergency_phone?: string | null
          equipment_categories?: string[]
          equipment_label?: string
          estimate_config?: Json
          holiday_rate?: number
          idle_timeout_minutes?: number
          industry?: string | null
          integrations?: Json
          location_ping_seconds?: number
          logo_data?: string | null
          note_presets?: Json
          office_address?: Json
          office_phone?: string | null
          payroll_mode?: string
          pdf_template?: Json
          pe_number?: string | null
          public_holidays?: string[]
          renewal_notice_days?: number
          saturday_rate?: number
          standby_order?: string[]
          standby_per_shift?: number
          standby_rotation_days?: number
          standby_start?: string
          sunday_rate?: number
          technical_structure?: Json
          terms?: Json
          theme?: Json
          trades?: string[]
          updated_at?: string
          vat_number?: string
          website?: string | null
          whatsapp_phone?: string | null
          work_days?: number[]
          work_end?: string
          work_start?: string
        }
        Update: {
          after_hours_rate?: number
          app_title?: string
          break_enabled?: boolean
          break_minutes?: number
          breaks_per_shift?: number
          company_address?: string | null
          company_email?: string | null
          company_id?: string
          currency?: string
          default_country_code?: string
          default_rates?: Json
          emergency_phone?: string | null
          equipment_categories?: string[]
          equipment_label?: string
          estimate_config?: Json
          holiday_rate?: number
          idle_timeout_minutes?: number
          industry?: string | null
          integrations?: Json
          location_ping_seconds?: number
          logo_data?: string | null
          note_presets?: Json
          office_address?: Json
          office_phone?: string | null
          payroll_mode?: string
          pdf_template?: Json
          pe_number?: string | null
          public_holidays?: string[]
          renewal_notice_days?: number
          saturday_rate?: number
          standby_order?: string[]
          standby_per_shift?: number
          standby_rotation_days?: number
          standby_start?: string
          sunday_rate?: number
          technical_structure?: Json
          terms?: Json
          theme?: Json
          trades?: string[]
          updated_at?: string
          vat_number?: string
          website?: string | null
          whatsapp_phone?: string | null
          work_days?: number[]
          work_end?: string
          work_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_skills: {
        Row: {
          archived: boolean
          category: string
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          archived?: boolean
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          archived?: boolean
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_skills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_types: {
        Row: {
          annual_price: number
          base_document_id: string | null
          checklist_document_id: string | null
          company_id: string
          contract_category: string | null
          created_at: string
          equipment_category: string
          id: string
          labour_discount_pct: number
          lifecycle: string
          name: string
          parts_discount_pct: number
          tier: string | null
          visits_per_year: number
        }
        Insert: {
          annual_price?: number
          base_document_id?: string | null
          checklist_document_id?: string | null
          company_id: string
          contract_category?: string | null
          created_at?: string
          equipment_category?: string
          id?: string
          labour_discount_pct?: number
          lifecycle?: string
          name: string
          parts_discount_pct?: number
          tier?: string | null
          visits_per_year?: number
        }
        Update: {
          annual_price?: number
          base_document_id?: string | null
          checklist_document_id?: string | null
          company_id?: string
          contract_category?: string | null
          created_at?: string
          equipment_category?: string
          id?: string
          labour_discount_pct?: number
          lifecycle?: string
          name?: string
          parts_discount_pct?: number
          tier?: string | null
          visits_per_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_types_base_document_id_fkey"
            columns: ["base_document_id"]
            isOneToOne: false
            referencedRelation: "document_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_types_checklist_document_id_fkey"
            columns: ["checklist_document_id"]
            isOneToOne: false
            referencedRelation: "document_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          company_id: string
          field_label: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          options_list: Json
          target_entity: Database["public"]["Enums"]["custom_field_target"]
        }
        Insert: {
          company_id: string
          field_label: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          options_list?: Json
          target_entity: Database["public"]["Enums"]["custom_field_target"]
        }
        Update: {
          company_id?: string
          field_label?: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          options_list?: Json
          target_entity?: Database["public"]["Enums"]["custom_field_target"]
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_work_reports: {
        Row: {
          break_minutes: number
          company_id: string
          correction_original: Json | null
          created_at: string
          id: string
          ot15_hours: number
          ot20_hours: number
          overtime_rules: Json | null
          report_date: string
          rows: Json
          shift_end: string
          shift_id: string | null
          shift_start: string
          standard_hours: number
          superseded_by: string | null
          user_id: string
          vehicle_reg: string | null
          worked_hours: number
        }
        Insert: {
          break_minutes?: number
          company_id: string
          correction_original?: Json | null
          created_at?: string
          id?: string
          ot15_hours?: number
          ot20_hours?: number
          overtime_rules?: Json | null
          report_date: string
          rows?: Json
          shift_end: string
          shift_id?: string | null
          shift_start: string
          standard_hours?: number
          superseded_by?: string | null
          user_id: string
          vehicle_reg?: string | null
          worked_hours?: number
        }
        Update: {
          break_minutes?: number
          company_id?: string
          correction_original?: Json | null
          created_at?: string
          id?: string
          ot15_hours?: number
          ot20_hours?: number
          overtime_rules?: Json | null
          report_date?: string
          rows?: Json
          shift_end?: string
          shift_id?: string | null
          shift_start?: string
          standard_hours?: number
          superseded_by?: string | null
          user_id?: string
          vehicle_reg?: string | null
          worked_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_work_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_work_reports_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_work_reports_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "daily_work_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_work_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_attachments: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          id: string
          master_id: string
          site_id: string | null
          snapshot: Json
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          master_id: string
          site_id?: string | null
          snapshot?: Json
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          master_id?: string
          site_id?: string | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_attachments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_attachments_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "document_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_attachments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      document_masters: {
        Row: {
          audience: string[]
          body: string
          cloned_from: string | null
          company_id: string
          created_at: string
          created_by: string
          id: string
          items: string[]
          kind: string
          name: string
          revision: number
          sections: Json
          source_document_id: string | null
          state: string
          trade: string
          updated_at: string
        }
        Insert: {
          audience?: string[]
          body?: string
          cloned_from?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          id?: string
          items?: string[]
          kind?: string
          name: string
          revision?: number
          sections?: Json
          source_document_id?: string | null
          state?: string
          trade?: string
          updated_at?: string
        }
        Update: {
          audience?: string[]
          body?: string
          cloned_from?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          items?: string[]
          kind?: string
          name?: string
          revision?: number
          sections?: Json
          source_document_id?: string | null
          state?: string
          trade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_masters_cloned_from_fkey"
            columns: ["cloned_from"]
            isOneToOne: false
            referencedRelation: "document_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_masters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_masters_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "company_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payroll_settings: {
        Row: {
          company_id: string
          entitlement_year: number
          hourly_rate: number
          id: string
          notes: string | null
          payroll_config: Json
          sick_full_hours: number
          sick_half_hours: number
          tax_reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          entitlement_year?: number
          hourly_rate?: number
          id?: string
          notes?: string | null
          payroll_config?: Json
          sick_full_hours?: number
          sick_half_hours?: number
          tax_reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          entitlement_year?: number
          hourly_rate?: number
          id?: string
          notes?: string | null
          payroll_config?: Json
          sick_full_hours?: number
          sick_half_hours?: number
          tax_reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payroll_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_problem_reports: {
        Row: {
          asset_id: string
          company_id: string
          created_at: string | null
          first_name: string
          id: string
          last_name: string
          position: string
          problem: string
          status: string
        }
        Insert: {
          asset_id: string
          company_id: string
          created_at?: string | null
          first_name: string
          id?: string
          last_name: string
          position: string
          problem: string
          status?: string
        }
        Update: {
          asset_id?: string
          company_id?: string
          created_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          position?: string
          problem?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_problem_reports_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_problem_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_report_links: {
        Row: {
          asset_id: string
          company_id: string
          created_at: string | null
          id: string
          last_report_at: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          asset_id: string
          company_id?: string
          created_at?: string | null
          id?: string
          last_report_at?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          asset_id?: string
          company_id?: string
          created_at?: string | null
          id?: string
          last_report_at?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_report_links_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_report_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          proposed_by: string
          status: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          name: string
          proposed_by?: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          proposed_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_receipts: {
        Row: {
          category_id: string | null
          company_id: string
          created_at: string
          file_path: string
          id: string
          page_count: number
          uploaded_by: string
        }
        Insert: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          file_path: string
          id?: string
          page_count?: number
          uploaded_by?: string
        }
        Update: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          file_path?: string
          id?: string
          page_count?: number
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fault_library: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          fault: string
          id: string
          remedy: string
          trade: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          fault: string
          id?: string
          remedy?: string
          trade?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          fault?: string
          id?: string
          remedy?: string
          trade?: string
        }
        Relationships: [
          {
            foreignKeyName: "fault_library_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_location_points: {
        Row: {
          accuracy: number
          company_id: string
          id: string
          latitude: number
          longitude: number
          plate: string | null
          recorded_at: string
          shift_id: string
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy: number
          company_id: string
          id?: string
          latitude: number
          longitude: number
          plate?: string | null
          recorded_at?: string
          shift_id: string
          speed?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number
          company_id?: string
          id?: string
          latitude?: number
          longitude?: number
          plate?: string | null
          recorded_at?: string
          shift_id?: string
          speed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_location_points_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_location_points_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicles: {
        Row: {
          assigned_user_id: string | null
          company_id: string
          fuel_price_per_litre: number
          fuel_type: string
          id: string
          litres_per_100km: number
          make_model: string | null
          plate: string
        }
        Insert: {
          assigned_user_id?: string | null
          company_id: string
          fuel_price_per_litre?: number
          fuel_type?: string
          id?: string
          litres_per_100km?: number
          make_model?: string | null
          plate: string
        }
        Update: {
          assigned_user_id?: string | null
          company_id?: string
          fuel_price_per_litre?: number
          fuel_type?: string
          id?: string
          litres_per_100km?: number
          make_model?: string | null
          plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicles_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          attachments: Json
          company_id: string
          contact_card: Json | null
          created_at: string
          id: string
          job_sheet_id: string | null
          message_text: string
          receiver_id: string | null
          sender_id: string
        }
        Insert: {
          attachments?: Json
          company_id: string
          contact_card?: Json | null
          created_at?: string
          id?: string
          job_sheet_id?: string | null
          message_text: string
          receiver_id?: string | null
          sender_id: string
        }
        Update: {
          attachments?: Json
          company_id?: string
          contact_card?: Json | null
          created_at?: string
          id?: string
          job_sheet_id?: string | null
          message_text?: string
          receiver_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_job_sheet_id_fkey"
            columns: ["job_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_work_logs: {
        Row: {
          activity: string
          company_id: string
          created_at: string
          id: string
          location: string | null
          log_date: string
          notes: string | null
          time_in: string
          time_out: string
          user_id: string
        }
        Insert: {
          activity: string
          company_id: string
          created_at?: string
          id?: string
          location?: string | null
          log_date?: string
          notes?: string | null
          time_in: string
          time_out: string
          user_id: string
        }
        Update: {
          activity?: string
          company_id?: string
          created_at?: string
          id?: string
          location?: string | null
          log_date?: string
          notes?: string | null
          time_in?: string
          time_out?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_work_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_work_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          company_id: string
          current_stock: number
          id: string
          min_stock_level: number
          part_name: string
          requires_approval: boolean
          sku: string | null
        }
        Insert: {
          company_id: string
          current_stock?: number
          id?: string
          min_stock_level?: number
          part_name: string
          requires_approval?: boolean
          sku?: string | null
        }
        Update: {
          company_id?: string
          current_stock?: number
          id?: string
          min_stock_level?: number
          part_name?: string
          requires_approval?: boolean
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_crew: {
        Row: {
          added_by: string | null
          claimed: boolean
          company_id: string
          created_at: string
          job_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          claimed?: boolean
          company_id?: string
          created_at?: string
          job_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          claimed?: boolean
          company_id?: string
          created_at?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_crew_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_crew_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_crew_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sheets: {
        Row: {
          asset_id: string | null
          asset_type: string
          asset_type_other: string | null
          assigned_technician_id: string | null
          billing_data: Json | null
          billing_reviewed_at: string | null
          billing_reviewed_by: string | null
          billing_source: string | null
          billing_status: string
          checklist_snapshot: string[]
          checklist_values: Json
          client_full_name: string | null
          client_id: string
          client_id_card_no: string | null
          client_notices: Json
          company_id: string
          created_at: string
          custom_values: Json
          departure_decided_at: string | null
          departure_decided_by: string | null
          departure_note: string | null
          departure_reply: string | null
          departure_requested_at: string | null
          departure_status: string
          estimate_id: string | null
          id: string
          internal_comments_admin_only: string | null
          is_installation: boolean
          is_maintenance: boolean
          is_overtime: boolean
          is_tech_assistance: boolean
          job_id: string | null
          job_type_other: string | null
          jobsheet_number: string
          lift_model: string | null
          maintenance_agreement_type: string | null
          notes: string | null
          overtime_rate: number | null
          pending_job_id: string | null
          pending_status: string
          pending_works_future_jobs: string | null
          photo_paths: Json
          repairs_performed: string | null
          reported_fault: string | null
          requires_admin_approval: boolean
          return_fee_hours: number
          return_fee_waived: boolean
          safety_snapshot: string[]
          serial_number: string | null
          signature_data: string | null
          site_id: string | null
          special_notes: string | null
          special_notes_in_email: boolean
          special_notes_in_pdf: boolean
          status: Database["public"]["Enums"]["job_status"]
          technician_name: string | null
          travel_start_time: string | null
          updated_at: string
          visit_outcome: string
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          asset_id?: string | null
          asset_type?: string
          asset_type_other?: string | null
          assigned_technician_id?: string | null
          billing_data?: Json | null
          billing_reviewed_at?: string | null
          billing_reviewed_by?: string | null
          billing_source?: string | null
          billing_status?: string
          checklist_snapshot?: string[]
          checklist_values?: Json
          client_full_name?: string | null
          client_id: string
          client_id_card_no?: string | null
          client_notices?: Json
          company_id: string
          created_at?: string
          custom_values?: Json
          departure_decided_at?: string | null
          departure_decided_by?: string | null
          departure_note?: string | null
          departure_reply?: string | null
          departure_requested_at?: string | null
          departure_status?: string
          estimate_id?: string | null
          id?: string
          internal_comments_admin_only?: string | null
          is_installation?: boolean
          is_maintenance?: boolean
          is_overtime?: boolean
          is_tech_assistance?: boolean
          job_id?: string | null
          job_type_other?: string | null
          jobsheet_number?: string
          lift_model?: string | null
          maintenance_agreement_type?: string | null
          notes?: string | null
          overtime_rate?: number | null
          pending_job_id?: string | null
          pending_status?: string
          pending_works_future_jobs?: string | null
          photo_paths?: Json
          repairs_performed?: string | null
          reported_fault?: string | null
          requires_admin_approval?: boolean
          return_fee_hours?: number
          return_fee_waived?: boolean
          safety_snapshot?: string[]
          serial_number?: string | null
          signature_data?: string | null
          site_id?: string | null
          special_notes?: string | null
          special_notes_in_email?: boolean
          special_notes_in_pdf?: boolean
          status?: Database["public"]["Enums"]["job_status"]
          technician_name?: string | null
          travel_start_time?: string | null
          updated_at?: string
          visit_outcome?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          asset_id?: string | null
          asset_type?: string
          asset_type_other?: string | null
          assigned_technician_id?: string | null
          billing_data?: Json | null
          billing_reviewed_at?: string | null
          billing_reviewed_by?: string | null
          billing_source?: string | null
          billing_status?: string
          checklist_snapshot?: string[]
          checklist_values?: Json
          client_full_name?: string | null
          client_id?: string
          client_id_card_no?: string | null
          client_notices?: Json
          company_id?: string
          created_at?: string
          custom_values?: Json
          departure_decided_at?: string | null
          departure_decided_by?: string | null
          departure_note?: string | null
          departure_reply?: string | null
          departure_requested_at?: string | null
          departure_status?: string
          estimate_id?: string | null
          id?: string
          internal_comments_admin_only?: string | null
          is_installation?: boolean
          is_maintenance?: boolean
          is_overtime?: boolean
          is_tech_assistance?: boolean
          job_id?: string | null
          job_type_other?: string | null
          jobsheet_number?: string
          lift_model?: string | null
          maintenance_agreement_type?: string | null
          notes?: string | null
          overtime_rate?: number | null
          pending_job_id?: string | null
          pending_status?: string
          pending_works_future_jobs?: string | null
          photo_paths?: Json
          repairs_performed?: string | null
          reported_fault?: string | null
          requires_admin_approval?: boolean
          return_fee_hours?: number
          return_fee_waived?: boolean
          safety_snapshot?: string[]
          serial_number?: string | null
          signature_data?: string | null
          site_id?: string | null
          special_notes?: string | null
          special_notes_in_email?: boolean
          special_notes_in_pdf?: boolean
          status?: Database["public"]["Enums"]["job_status"]
          technician_name?: string | null
          travel_start_time?: string | null
          updated_at?: string
          visit_outcome?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_sheets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_departure_decided_by_fkey"
            columns: ["departure_decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "lift_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_pending_job_id_fkey"
            columns: ["pending_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      job_skills: {
        Row: {
          company_id: string
          job_id: string
          mandatory: boolean
          skill_id: string
        }
        Insert: {
          company_id?: string
          job_id: string
          mandatory?: boolean
          skill_id: string
        }
        Update: {
          company_id?: string
          job_id?: string
          mandatory?: boolean
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_skills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_skills_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "company_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          acknowledged_at: string | null
          asset_id: string | null
          assigned_technician_id: string | null
          client_id: string
          company_id: string
          created_at: string
          handover_action: string | null
          handover_at: string | null
          handover_note: string | null
          id: string
          job_number: number
          open_to_claim: boolean
          ppm_deadline: string | null
          ppm_due_date: string | null
          ppm_plan_id: string | null
          priority: string
          problem_summary: string | null
          required_team_size: number
          scheduled_date: string
          secondary_technician_id: string | null
          site_id: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          asset_id?: string | null
          assigned_technician_id?: string | null
          client_id: string
          company_id: string
          created_at?: string
          handover_action?: string | null
          handover_at?: string | null
          handover_note?: string | null
          id?: string
          job_number?: number
          open_to_claim?: boolean
          ppm_deadline?: string | null
          ppm_due_date?: string | null
          ppm_plan_id?: string | null
          priority?: string
          problem_summary?: string | null
          required_team_size?: number
          scheduled_date?: string
          secondary_technician_id?: string | null
          site_id?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          asset_id?: string | null
          assigned_technician_id?: string | null
          client_id?: string
          company_id?: string
          created_at?: string
          handover_action?: string | null
          handover_at?: string | null
          handover_note?: string | null
          id?: string
          job_number?: number
          open_to_claim?: boolean
          ppm_deadline?: string | null
          ppm_due_date?: string | null
          ppm_plan_id?: string | null
          priority?: string
          problem_summary?: string | null
          required_team_size?: number
          scheduled_date?: string
          secondary_technician_id?: string | null
          site_id?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_ppm_plan_id_fkey"
            columns: ["ppm_plan_id"]
            isOneToOne: false
            referencedRelation: "ppm_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_secondary_technician_id_fkey"
            columns: ["secondary_technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      jobsheet_internal_notes: {
        Row: {
          author_id: string
          body: string
          company_id: string
          created_at: string
          id: string
          jobsheet_id: string
        }
        Insert: {
          author_id?: string
          body: string
          company_id?: string
          created_at?: string
          id?: string
          jobsheet_id: string
        }
        Update: {
          author_id?: string
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          jobsheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobsheet_internal_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobsheet_internal_notes_jobsheet_id_fkey"
            columns: ["jobsheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      jobsheet_parts: {
        Row: {
          company_id: string
          id: string
          jobsheet_id: string
          log_sort_order: number | null
          part_description: string
          quantity: number
          sort_order: number
          time_acquiring_parts_hours: number
          unit: string | null
        }
        Insert: {
          company_id: string
          id?: string
          jobsheet_id: string
          log_sort_order?: number | null
          part_description: string
          quantity?: number
          sort_order?: number
          time_acquiring_parts_hours?: number
          unit?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          jobsheet_id?: string
          log_sort_order?: number | null
          part_description?: string
          quantity?: number
          sort_order?: number
          time_acquiring_parts_hours?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobsheet_parts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobsheet_parts_jobsheet_id_fkey"
            columns: ["jobsheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      jobsheet_receipts: {
        Row: {
          company_id: string
          created_at: string
          expense_id: string | null
          file_path: string
          id: string
          jobsheet_id: string
          page_count: number
          uploaded_by: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expense_id?: string | null
          file_path: string
          id?: string
          jobsheet_id: string
          page_count?: number
          uploaded_by?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expense_id?: string | null
          file_path?: string
          id?: string
          jobsheet_id?: string
          page_count?: number
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobsheet_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobsheet_receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expense_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobsheet_receipts_jobsheet_id_fkey"
            columns: ["jobsheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      jobsheet_time_logs: {
        Row: {
          company_id: string
          daily_total_hours: number
          daily_work_description: string | null
          id: string
          jobsheet_id: string
          latitude_in: number | null
          latitude_out: number | null
          log_date: string
          longitude_in: number | null
          longitude_out: number | null
          sort_order: number
          technician_count: number
          technician_initials: string[]
          time_in: string | null
          time_out: string | null
          traveling_time_hours: number
        }
        Insert: {
          company_id: string
          daily_total_hours?: number
          daily_work_description?: string | null
          id?: string
          jobsheet_id: string
          latitude_in?: number | null
          latitude_out?: number | null
          log_date?: string
          longitude_in?: number | null
          longitude_out?: number | null
          sort_order?: number
          technician_count?: number
          technician_initials?: string[]
          time_in?: string | null
          time_out?: string | null
          traveling_time_hours?: number
        }
        Update: {
          company_id?: string
          daily_total_hours?: number
          daily_work_description?: string | null
          id?: string
          jobsheet_id?: string
          latitude_in?: number | null
          latitude_out?: number | null
          log_date?: string
          longitude_in?: number | null
          longitude_out?: number | null
          sort_order?: number
          technician_count?: number
          technician_initials?: string[]
          time_in?: string | null
          time_out?: string | null
          traveling_time_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "jobsheet_time_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobsheet_time_logs_jobsheet_id_fkey"
            columns: ["jobsheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_blackouts: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          end_date: string
          id: string
          reason: string
          roles: Database["public"]["Enums"]["app_role"][]
          start_date: string
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          end_date: string
          id?: string
          reason: string
          roles?: Database["public"]["Enums"]["app_role"][]
          start_date: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string
          id?: string
          reason?: string
          roles?: Database["public"]["Enums"]["app_role"][]
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_blackouts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          company_id: string
          consulted_supervisor_id: string | null
          created_at: string
          end_date: string
          exception_reason: string | null
          id: string
          leave_type: string
          medical_certificate_path: string | null
          optional_notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          supervisor_response: string | null
          total_hours: number
          user_id: string
          work_handling_note: string | null
        }
        Insert: {
          company_id: string
          consulted_supervisor_id?: string | null
          created_at?: string
          end_date: string
          exception_reason?: string | null
          id?: string
          leave_type?: string
          medical_certificate_path?: string | null
          optional_notes?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          supervisor_response?: string | null
          total_hours?: number
          user_id: string
          work_handling_note?: string | null
        }
        Update: {
          company_id?: string
          consulted_supervisor_id?: string | null
          created_at?: string
          end_date?: string
          exception_reason?: string | null
          id?: string
          leave_type?: string
          medical_certificate_path?: string | null
          optional_notes?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          supervisor_response?: string | null
          total_hours?: number
          user_id?: string
          work_handling_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lift_estimates: {
        Row: {
          client_id: string | null
          client_price: number | null
          company_id: string
          created_at: string
          created_by: string
          events: Json
          fixed_labor: boolean
          id: string
          last_reminder_at: string | null
          photos: string[]
          quoted_amount: number | null
          reminders_paused: boolean
          reminders_sent: number
          rfq: Json
          sent_at: string | null
          site_id: string | null
          sketch: string | null
          specs: string | null
          status: string
          supplier_email: string | null
          supplier_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_price?: number | null
          company_id: string
          created_at?: string
          created_by?: string
          events?: Json
          fixed_labor?: boolean
          id?: string
          last_reminder_at?: string | null
          photos?: string[]
          quoted_amount?: number | null
          reminders_paused?: boolean
          reminders_sent?: number
          rfq?: Json
          sent_at?: string | null
          site_id?: string | null
          sketch?: string | null
          specs?: string | null
          status?: string
          supplier_email?: string | null
          supplier_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_price?: number | null
          company_id?: string
          created_at?: string
          created_by?: string
          events?: Json
          fixed_labor?: boolean
          id?: string
          last_reminder_at?: string | null
          photos?: string[]
          quoted_amount?: number | null
          reminders_paused?: boolean
          reminders_sent?: number
          rfq?: Json
          sent_at?: string | null
          site_id?: string | null
          sketch?: string | null
          specs?: string | null
          status?: string
          supplier_email?: string | null
          supplier_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lift_estimates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lift_estimates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lift_estimates_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      lookup_options: {
        Row: {
          category: string
          company_id: string | null
          created_by_user_id: string | null
          id: string
          industry_type: string | null
          is_approved: boolean
          is_global: boolean
          label_value: string
          usage_count: number
        }
        Insert: {
          category: string
          company_id?: string | null
          created_by_user_id?: string | null
          id?: string
          industry_type?: string | null
          is_approved?: boolean
          is_global?: boolean
          label_value: string
          usage_count?: number
        }
        Update: {
          category?: string
          company_id?: string | null
          created_by_user_id?: string | null
          id?: string
          industry_type?: string | null
          is_approved?: boolean
          is_global?: boolean
          label_value?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "lookup_options_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lookup_options_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_agreements: {
        Row: {
          annual_price: number
          client_id: string
          company_id: string
          contract_type_id: string | null
          created_at: string
          end_date: string
          id: string
          notes: string | null
          price_confirmed_at: string | null
          renewal_sent_at: string | null
          renewal_signature: string | null
          renewal_signed_at: string | null
          renewal_signed_by: string | null
          site_id: string | null
          start_date: string
          status: string
          terms_snapshot: Json
        }
        Insert: {
          annual_price?: number
          client_id: string
          company_id: string
          contract_type_id?: string | null
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          price_confirmed_at?: string | null
          renewal_sent_at?: string | null
          renewal_signature?: string | null
          renewal_signed_at?: string | null
          renewal_signed_by?: string | null
          site_id?: string | null
          start_date: string
          status?: string
          terms_snapshot?: Json
        }
        Update: {
          annual_price?: number
          client_id?: string
          company_id?: string
          contract_type_id?: string | null
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          price_confirmed_at?: string | null
          renewal_sent_at?: string | null
          renewal_signature?: string | null
          renewal_signed_at?: string | null
          renewal_signed_by?: string | null
          site_id?: string | null
          start_date?: string
          status?: string
          terms_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_agreements_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "contract_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_agreements_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      member_access_events: {
        Row: {
          action: string
          actor_id: string
          company_id: string
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          action: string
          actor_id: string
          company_id: string
          created_at?: string
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          company_id?: string
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_access_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      member_skills: {
        Row: {
          assigned_by: string | null
          company_id: string
          created_at: string
          skill_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          company_id?: string
          created_at?: string
          skill_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          company_id?: string
          created_at?: string
          skill_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_skills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "company_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_logs: {
        Row: {
          call_type: string
          company_id: string
          created_at: string
          id: string
          job_sheet_id: string | null
          log_date: string
          notes: string | null
          travel_hours: number
          user_id: string
          work_hours: number
        }
        Insert: {
          call_type: string
          company_id: string
          created_at?: string
          id?: string
          job_sheet_id?: string | null
          log_date?: string
          notes?: string | null
          travel_hours?: number
          user_id: string
          work_hours?: number
        }
        Update: {
          call_type?: string
          company_id?: string
          created_at?: string
          id?: string
          job_sheet_id?: string | null
          log_date?: string
          notes?: string | null
          travel_hours?: number
          user_id?: string
          work_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "overtime_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_logs_job_sheet_id_fkey"
            columns: ["job_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_payslips: {
        Row: {
          company_id: string
          created_by: string
          gross_eur: number
          id: string
          issued_at: string
          net_eur: number
          period_end: string
          period_start: string
          snapshot: Json
          user_id: string
        }
        Insert: {
          company_id: string
          created_by?: string
          gross_eur?: number
          id?: string
          issued_at?: string
          net_eur?: number
          period_end: string
          period_start: string
          snapshot?: Json
          user_id: string
        }
        Update: {
          company_id?: string
          created_by?: string
          gross_eur?: number
          id?: string
          issued_at?: string
          net_eur?: number
          period_end?: string
          period_start?: string
          snapshot?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_payslips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payslips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_policies: {
        Row: {
          company_id: string
          country: string
          created_at: string
          effective_from: string
          id: string
          sick_full_hours: number
          sick_half_hours: number
          standby_weekly_eur: number
        }
        Insert: {
          company_id: string
          country?: string
          created_at?: string
          effective_from?: string
          id?: string
          sick_full_hours?: number
          sick_half_hours?: number
          standby_weekly_eur?: number
        }
        Update: {
          company_id?: string
          country?: string
          created_at?: string
          effective_from?: string
          id?: string
          sick_full_hours?: number
          sick_half_hours?: number
          standby_weekly_eur?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_roster_versions: {
        Row: {
          captured_at: string
          company_id: string
          effective_from: string
          id: string
          per_shift: number
          roster_start: string
          rotation_days: number
          technician_order: string[]
        }
        Insert: {
          captured_at?: string
          company_id: string
          effective_from: string
          id?: string
          per_shift: number
          roster_start: string
          rotation_days: number
          technician_order: string[]
        }
        Update: {
          captured_at?: string
          company_id?: string
          effective_from?: string
          id?: string
          per_shift?: number
          roster_start?: string
          rotation_days?: number
          technician_order?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "payroll_roster_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_statutory_years: {
        Row: {
          company_id: string
          config: Json
          id: string
          tax_year: number
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json
          id?: string
          tax_year: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json
          id?: string
          tax_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_statutory_years_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_work_actions: {
        Row: {
          action: string
          assigned_to: string | null
          company_id: string
          note: string
          sheet_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action?: string
          assigned_to?: string | null
          company_id?: string
          note?: string
          sheet_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string
          assigned_to?: string | null
          company_id?: string
          note?: string
          sheet_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_work_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_work_actions_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: true
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_audit: {
        Row: {
          action: string
          actor_id: string | null
          after_value: Json | null
          before_value: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      platform_catalog: {
        Row: {
          billing_basis: string
          branding_required: boolean
          created_at: string
          id: string
          included_seats: number
          kind: string
          modules: string[]
          monthly_price: number
          name: string
          product_id: string
          quarterly_price: number
          referral_reward: number
          sort_order: number
          state: string
          storage_gb: number
          yearly_price: number
        }
        Insert: {
          billing_basis?: string
          branding_required?: boolean
          created_at?: string
          id?: string
          included_seats?: number
          kind?: string
          modules?: string[]
          monthly_price?: number
          name: string
          product_id: string
          quarterly_price?: number
          referral_reward?: number
          sort_order?: number
          state?: string
          storage_gb?: number
          yearly_price?: number
        }
        Update: {
          billing_basis?: string
          branding_required?: boolean
          created_at?: string
          id?: string
          included_seats?: number
          kind?: string
          modules?: string[]
          monthly_price?: number
          name?: string
          product_id?: string
          quarterly_price?: number
          referral_reward?: number
          sort_order?: number
          state?: string
          storage_gb?: number
          yearly_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_catalog_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "platform_products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_company_controls: {
        Row: {
          company_id: string
          id: string
          internal_notes: string
          is_test: boolean
          location_city: string
          location_country: string
          updated_at: string
        }
        Insert: {
          company_id: string
          id?: string
          internal_notes?: string
          is_test?: boolean
          location_city?: string
          location_country?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          id?: string
          internal_notes?: string
          is_test?: boolean
          location_city?: string
          location_country?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_company_controls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_conversions: {
        Row: {
          created_at: string
          id: string
          notes: string
          referral_id: string
          reward_amount: number
          state: string
          subscription_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          referral_id: string
          reward_amount?: number
          state?: string
          subscription_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          referral_id?: string
          reward_amount?: number
          state?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_conversions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "platform_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_conversions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "platform_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_engagement_actions: {
        Row: {
          action_key: string
          body: string
          created_at: string
          created_by: string
          id: string
          status: string
          subject: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          action_key: string
          body: string
          created_at?: string
          created_by: string
          id?: string
          status?: string
          subject: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          action_key?: string
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          status?: string
          subject?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_engagement_actions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "platform_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          owner_notes: string
          rating: number | null
          status: string
          submitted_by: string
          subscription_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          message: string
          owner_notes?: string
          rating?: number | null
          status?: string
          submitted_by: string
          subscription_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          owner_notes?: string
          rating?: number | null
          status?: string
          submitted_by?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_feedback_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "platform_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_invoice_reminders: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          stage: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          stage: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_invoice_reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "platform_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_invoices: {
        Row: {
          collection: string
          company_id: string | null
          created_at: string
          currency: string
          discount: number
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          kind: string
          lines: Json
          notes: string | null
          paid_at: string | null
          payment_error: string | null
          payment_ref: string | null
          period_end: string
          period_start: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          subscription_id: string
          subtotal: number
          total: number
          vat: number
          vat_rate: number
        }
        Insert: {
          collection?: string
          company_id?: string | null
          created_at?: string
          currency?: string
          discount?: number
          due_date: string
          id?: string
          invoice_number?: string
          issue_date?: string
          kind?: string
          lines?: Json
          notes?: string | null
          paid_at?: string | null
          payment_error?: string | null
          payment_ref?: string | null
          period_end: string
          period_start: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          subscription_id: string
          subtotal?: number
          total?: number
          vat?: number
          vat_rate?: number
        }
        Update: {
          collection?: string
          company_id?: string | null
          created_at?: string
          currency?: string
          discount?: number
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          kind?: string
          lines?: Json
          notes?: string | null
          paid_at?: string | null
          payment_error?: string | null
          payment_ref?: string | null
          period_end?: string
          period_start?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          subscription_id?: string
          subtotal?: number
          total?: number
          vat?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "platform_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_ledger: {
        Row: {
          amount: number
          category: string
          created_at: string
          entry_date: string
          id: string
          kind: string
          notes: string
          product_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          entry_date?: string
          id?: string
          kind: string
          notes?: string
          product_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          entry_date?: string
          id?: string
          kind?: string
          notes?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "platform_products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_legal_profiles: {
        Row: {
          billing_email: string
          country: string
          founder_name: string
          id: string
          legal_name: string
          privacy_email: string
          product_id: string
          registered_address: string
          registration_number: string
          sales_email: string
          support_email: string
          updated_at: string
          vat_number: string
        }
        Insert: {
          billing_email?: string
          country?: string
          founder_name?: string
          id?: string
          legal_name?: string
          privacy_email?: string
          product_id: string
          registered_address?: string
          registration_number?: string
          sales_email?: string
          support_email?: string
          updated_at?: string
          vat_number?: string
        }
        Update: {
          billing_email?: string
          country?: string
          founder_name?: string
          id?: string
          legal_name?: string
          privacy_email?: string
          product_id?: string
          registered_address?: string
          registration_number?: string
          sales_email?: string
          support_email?: string
          updated_at?: string
          vat_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_legal_profiles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "platform_products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_outreach_templates: {
        Row: {
          body: string
          id: string
          product_id: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          body: string
          id?: string
          product_id: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          product_id?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_outreach_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "platform_products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          ends_at: string
          id: string
          module: string
          reason: string
          starts_at: string
          subscription_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          ends_at?: string
          id?: string
          module: string
          reason?: string
          starts_at?: string
          subscription_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          ends_at?: string
          id?: string
          module?: string
          reason?: string
          starts_at?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_overrides_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "platform_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_payment_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
        }
        Relationships: []
      }
      platform_products: {
        Row: {
          active: boolean
          app_url: string
          created_at: string
          currency: string
          id: string
          modules: string[]
          name: string
          slug: string
          trial_days: number
        }
        Insert: {
          active?: boolean
          app_url?: string
          created_at?: string
          currency?: string
          id?: string
          modules?: string[]
          name: string
          slug: string
          trial_days?: number
        }
        Update: {
          active?: boolean
          app_url?: string
          created_at?: string
          currency?: string
          id?: string
          modules?: string[]
          name?: string
          slug?: string
          trial_days?: number
        }
        Relationships: []
      }
      platform_referrals: {
        Row: {
          code: string
          company_id: string | null
          created_at: string
          id: string
          kind: string
          owner_id: string
          product_id: string
          reward_amount: number
          reward_type: string
          state: string
        }
        Insert: {
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          product_id: string
          reward_amount?: number
          reward_type?: string
          state?: string
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          product_id?: string
          reward_amount?: number
          reward_type?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_referrals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_referrals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "platform_products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_subscriptions: {
        Row: {
          agreed_price: number
          auto_charge: boolean
          auto_issue: boolean
          cadence: string
          company_id: string | null
          created_at: string
          external_tenant_id: string | null
          id: string
          pack_ids: string[]
          pending_change: Json | null
          plan_id: string | null
          product_id: string
          seats: number
          status: string
          stripe_customer_id: string | null
          tenant_name: string
          trial_ends_at: string
        }
        Insert: {
          agreed_price?: number
          auto_charge?: boolean
          auto_issue?: boolean
          cadence?: string
          company_id?: string | null
          created_at?: string
          external_tenant_id?: string | null
          id?: string
          pack_ids?: string[]
          pending_change?: Json | null
          plan_id?: string | null
          product_id: string
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          tenant_name?: string
          trial_ends_at?: string
        }
        Update: {
          agreed_price?: number
          auto_charge?: boolean
          auto_issue?: boolean
          cadence?: string
          company_id?: string | null
          created_at?: string
          external_tenant_id?: string | null
          id?: string
          pack_ids?: string[]
          pending_change?: Json | null
          plan_id?: string | null
          product_id?: string
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          tenant_name?: string
          trial_ends_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "platform_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "platform_products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_usage_daily: {
        Row: {
          day: string
          event_count: number
          feature: string
          subscription_id: string
        }
        Insert: {
          day?: string
          event_count?: number
          feature: string
          subscription_id: string
        }
        Update: {
          day?: string
          event_count?: number
          feature?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_usage_daily_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "platform_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_usage_totals: {
        Row: {
          first_sign_in: string | null
          last_seen: string | null
          subscription_id: string
          work_count: number
        }
        Insert: {
          first_sign_in?: string | null
          last_seen?: string | null
          subscription_id: string
          work_count?: number
        }
        Update: {
          first_sign_in?: string | null
          last_seen?: string | null
          subscription_id?: string
          work_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_usage_totals_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "platform_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      ppm_plans: {
        Row: {
          active: boolean
          agreement_id: string
          asset_id: string
          assigned_technician_id: string | null
          company_id: string
          created_at: string
          first_due_date: string
          grace_days: number
          id: string
          interval_months: number
        }
        Insert: {
          active?: boolean
          agreement_id: string
          asset_id: string
          assigned_technician_id?: string | null
          company_id?: string
          created_at?: string
          first_due_date: string
          grace_days?: number
          id?: string
          interval_months?: number
        }
        Update: {
          active?: boolean
          agreement_id?: string
          asset_id?: string
          assigned_technician_id?: string | null
          company_id?: string
          created_at?: string
          first_due_date?: string
          grace_days?: number
          id?: string
          interval_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "ppm_plans_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "maintenance_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppm_plans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppm_plans_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppm_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_approvals: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          decided_at: string | null
          decision: string | null
          expires_at: string
          id: string
          proposal_id: string
          revoked_at: string | null
          signer_comment: string | null
          signer_name: string | null
          snapshot: Json
          token_hash: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          decided_at?: string | null
          decision?: string | null
          expires_at?: string
          id?: string
          proposal_id: string
          revoked_at?: string | null
          signer_comment?: string | null
          signer_name?: string | null
          snapshot: Json
          token_hash: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          decided_at?: string | null
          decision?: string | null
          expires_at?: string
          id?: string
          proposal_id?: string
          revoked_at?: string | null
          signer_comment?: string | null
          signer_name?: string | null
          snapshot?: Json
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_approvals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_approvals_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          lines: Json
          reference: string
          site_id: string | null
          spec: Json
          status: string
          terms: Json
          title: string
          trade: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lines?: Json
          reference?: string
          site_id?: string | null
          spec?: Json
          status?: string
          terms?: Json
          title?: string
          trade?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lines?: Json
          reference?: string
          site_id?: string | null
          spec?: Json
          status?: string
          terms?: Json
          title?: string
          trade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qs_surveys: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          lines: Json
          notes: string
          proposal_id: string | null
          review: Json
          signed_off_at: string | null
          signed_off_by: string | null
          site_label: string
          status: string
          submitted_at: string | null
          title: string
          trade: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lines?: Json
          notes?: string
          proposal_id?: string | null
          review?: Json
          signed_off_at?: string | null
          signed_off_by?: string | null
          site_label?: string
          status?: string
          submitted_at?: string | null
          title?: string
          trade?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lines?: Json
          notes?: string
          proposal_id?: string | null
          review?: Json
          signed_off_at?: string | null
          signed_off_by?: string | null
          site_label?: string
          status?: string
          submitted_at?: string | null
          title?: string
          trade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qs_surveys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_surveys_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          company_id: string
          enabled: boolean
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          company_id: string
          enabled: boolean
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          company_id?: string
          enabled?: boolean
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_templates: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          items: string[]
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          items?: string[]
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          items?: string[]
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          auto_close_note: string | null
          auto_closed: boolean
          company_id: string
          created_at: string
          dwr_held: boolean
          ended_at: string | null
          id: string
          shift_type: string
          started_at: string
          user_id: string
          vehicle_reg: string | null
        }
        Insert: {
          auto_close_note?: string | null
          auto_closed?: boolean
          company_id: string
          created_at?: string
          dwr_held?: boolean
          ended_at?: string | null
          id?: string
          shift_type?: string
          started_at?: string
          user_id: string
          vehicle_reg?: string | null
        }
        Update: {
          auto_close_note?: string | null
          auto_closed?: boolean
          company_id?: string
          created_at?: string
          dwr_held?: boolean
          ended_at?: string | null
          id?: string
          shift_type?: string
          started_at?: string
          user_id?: string
          vehicle_reg?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      signing_batches: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          created_by: string
          delivery_error: string | null
          id: string
          month: string
          recipients: string[]
          sent_at: string | null
          sheet_ids: string[]
          signed_ids: string[]
          status: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          created_by: string
          delivery_error?: string | null
          id?: string
          month: string
          recipients?: string[]
          sent_at?: string | null
          sheet_ids: string[]
          signed_ids?: string[]
          status?: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          delivery_error?: string | null
          id?: string
          month?: string
          recipients?: string[]
          sent_at?: string | null
          sheet_ids?: string[]
          signed_ids?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "signing_batches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signing_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signing_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          client_id: string
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      standby_roster_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string
          config: Json
          id: string
          track: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id: string
          config: Json
          id?: string
          track: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          config?: Json
          id?: string
          track?: string
        }
        Relationships: []
      }
      standby_swaps: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          end_date: string | null
          id: string
          manager_approved: boolean
          note: string | null
          requester_id: string
          responded_at: string | null
          status: string
          swap_date: string
          target_id: string
          track: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          manager_approved?: boolean
          note?: string | null
          requester_id: string
          responded_at?: string | null
          status?: string
          swap_date: string
          target_id: string
          track?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          manager_approved?: boolean
          note?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: string
          swap_date?: string
          target_id?: string
          track?: string
        }
        Relationships: [
          {
            foreignKeyName: "standby_swaps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standby_swaps_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standby_swaps_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_rosters: {
        Row: {
          company_id: string
          member_order: string[]
          per_shift: number
          rotation_days: number
          start_date: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          member_order?: string[]
          per_shift?: number
          rotation_days?: number
          start_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          member_order?: string[]
          per_shift?: number
          rotation_days?: number
          start_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_rosters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      team_role_changes: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          company_id: string
          id: string
          member_id: string
          new_role: Database["public"]["Enums"]["app_role"]
          old_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          company_id: string
          id?: string
          member_id: string
          new_role: Database["public"]["Enums"]["app_role"]
          old_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          company_id?: string
          id?: string
          member_id?: string
          new_role?: Database["public"]["Enums"]["app_role"]
          old_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      technical_documents: {
        Row: {
          asset_id: string | null
          classification: Json
          company_id: string
          content_tags: string[]
          created_at: string
          file_path: string
          id: string
          keywords: string
          notes: string
          page_count: number
          pages: Json
          restricted: boolean
          site_id: string | null
          status: string
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          asset_id?: string | null
          classification?: Json
          company_id: string
          content_tags?: string[]
          created_at?: string
          file_path: string
          id?: string
          keywords?: string
          notes?: string
          page_count?: number
          pages?: Json
          restricted?: boolean
          site_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Update: {
          asset_id?: string | null
          classification?: Json
          company_id?: string
          content_tags?: string[]
          created_at?: string
          file_path?: string
          id?: string
          keywords?: string
          notes?: string
          page_count?: number
          pages?: Json
          restricted?: boolean
          site_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_documents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_locations: {
        Row: {
          accuracy: number
          company_id: string
          latitude: number
          longitude: number
          recorded_at: string
          shift_id: string
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy: number
          company_id: string
          latitude: number
          longitude: number
          recorded_at?: string
          shift_id: string
          speed?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number
          company_id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          shift_id?: string
          speed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_locations_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_leave_balances: {
        Row: {
          base_entitlement_hours: number
          carried_forward_hours: number
          carried_forward_year: number | null
          company_id: string
          pending_hours: number
          public_holiday_credit_hours: number
          taken_hours: number
          user_id: string
        }
        Insert: {
          base_entitlement_hours?: number
          carried_forward_hours?: number
          carried_forward_year?: number | null
          company_id: string
          pending_hours?: number
          public_holiday_credit_hours?: number
          taken_hours?: number
          user_id: string
        }
        Update: {
          base_entitlement_hours?: number
          carried_forward_hours?: number
          carried_forward_year?: number | null
          company_id?: string
          pending_hours?: number
          public_holiday_credit_hours?: number
          taken_hours?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_leave_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_leave_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          platform_owner: boolean
          registration_status: string
          role: Database["public"]["Enums"]["app_role"]
          terminated_at: string | null
          terminated_by: string | null
          termination_reason: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          platform_owner?: boolean
          registration_status?: string
          role: Database["public"]["Enums"]["app_role"]
          terminated_at?: string | null
          terminated_by?: string | null
          termination_reason?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          platform_owner?: boolean
          registration_status?: string
          role?: Database["public"]["Enums"]["app_role"]
          terminated_at?: string | null
          terminated_by?: string | null
          termination_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          app_theme_preference: string
          company_id: string
          created_at: string
          email: string
          employee_id: string | null
          full_name: string
          home_address: string | null
          id: string
          language_preference: string
          next_of_kin_1: Json
          next_of_kin_2: Json
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"]
          signature_on_file: string | null
          technician_initials: string | null
        }
        Insert: {
          app_theme_preference?: string
          company_id: string
          created_at?: string
          email: string
          employee_id?: string | null
          full_name: string
          home_address?: string | null
          id: string
          language_preference?: string
          next_of_kin_1?: Json
          next_of_kin_2?: Json
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          signature_on_file?: string | null
          technician_initials?: string | null
        }
        Update: {
          app_theme_preference?: string
          company_id?: string
          created_at?: string
          email?: string
          employee_id?: string | null
          full_name?: string
          home_address?: string | null
          id?: string
          language_preference?: string
          next_of_kin_1?: Json
          next_of_kin_2?: Json
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          signature_on_file?: string | null
          technician_initials?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_client_portal_invite: { Args: { _token: string }; Returns: string }
      accept_company_invite: { Args: { _token: string }; Returns: string }
      accept_company_invite_named: {
        Args: { _first_name: string; _surname: string; _token: string }
        Returns: string
      }
      branding_offers: { Args: never; Returns: Json }
      can_read_chat_object: { Args: { _name: string }; Returns: boolean }
      chat_sheet_access: { Args: { _sheet: string }; Returns: boolean }
      claim_open_job: { Args: { _job: string }; Returns: string }
      client_message_recipients: {
        Args: {
          _channel: string
          _client: string
          _purpose: string
          _site: string
        }
        Returns: Json
      }
      client_portal_directory: { Args: never; Returns: Json }
      client_workspace: { Args: { _client: string }; Returns: Json }
      client_workspace_scope: { Args: { _client: string }; Returns: Json }
      company_app_product_id: { Args: never; Returns: string }
      company_invoice_lapsed: {
        Args: { _subscription: string }
        Returns: boolean
      }
      company_module_access: {
        Args: { _company: string; _module: string }
        Returns: boolean
      }
      company_storage_usage: { Args: { _company: string }; Returns: Json }
      create_equipment_report_link: {
        Args: { _asset: string }
        Returns: string
      }
      create_proposal_approval_link: {
        Args: { _proposal: string }
        Returns: string
      }
      current_company_id: { Args: never; Returns: string }
      decide_proposal_approval: {
        Args: {
          _comment: string
          _decision: string
          _name: string
          _token: string
        }
        Returns: undefined
      }
      dwr_sheet_entries: {
        Args: { _date: string; _user: string }
        Returns: {
          assisting: boolean
          client: string
          jobsheet_id: string
          jobsheet_number: string
          lead_name: string
          site: string
          time_in: string
          time_out: string
          travel: number
        }[]
      }
      fieldbridge_public_legal: { Args: never; Returns: Json }
      fleet_day: { Args: { _date: string; _user: string }; Returns: Json }
      fleet_vehicle_list: { Args: never; Returns: Json }
      generate_ppm_visits: { Args: { _plan: string }; Returns: number }
      get_equipment_logbook: { Args: { _token: string }; Returns: Json }
      get_equipment_report_target: { Args: { _token: string }; Returns: Json }
      get_invite: {
        Args: { _token: string }
        Returns: {
          company_name: string
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          valid: boolean
        }[]
      }
      get_referral_offer: {
        Args: { _code: string }
        Returns: {
          app_url: string
          product_name: string
          trial_days: number
        }[]
      }
      has_company_role: {
        Args: { _role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_client_contact: {
        Args: { _admin?: boolean; _client: string; _contact: string }
        Returns: string
      }
      is_company_manager: { Args: never; Returns: boolean }
      is_on_standby: {
        Args: { _date: string; _user: string }
        Returns: boolean
      }
      is_platform_owner: { Args: never; Returns: boolean }
      member_is_active: { Args: { _user: string }; Returns: boolean }
      my_commercial_status: { Args: never; Returns: Json }
      my_registration_status: { Args: never; Returns: string }
      my_role: { Args: never; Returns: Database["public"]["Enums"]["app_role"] }
      open_jobs_for_me: {
        Args: never
        Returns: {
          client_name: string
          id: string
          job_number: number
          places_left: number
          priority: string
          problem_summary: string
          required_team_size: number
          scheduled_date: string
          site_name: string
          skills: string[]
          window_end: string
          window_start: string
        }[]
      }
      platform_analytics_summary: {
        Args: { _days?: number; _product: string }
        Returns: Json
      }
      platform_company_directory: {
        Args: never
        Returns: {
          id: string
          name: string
          user_count: number
        }[]
      }
      platform_hq_directory: {
        Args: never
        Returns: {
          address: string
          city: string
          contact_email: string
          country: string
          id: string
          internal_notes: string
          is_test: boolean
          name: string
          user_count: number
        }[]
      }
      platform_hq_module_status: {
        Args: never
        Returns: {
          enabled: boolean
          module: string
          subscription_id: string
        }[]
      }
      platform_reset_test_data: {
        Args: {
          _company: string
          _confirmation: string
          _modules: string[]
          _preview?: boolean
        }
        Returns: Json
      }
      platform_save_company_controls: {
        Args: {
          _city: string
          _company: string
          _country: string
          _notes: string
          _test: boolean
        }
        Returns: undefined
      }
      platform_set_company_module: {
        Args: { _mode: string; _module: string; _subscription: string }
        Returns: undefined
      }
      platform_subscription_module_access: {
        Args: { _module: string; _subscription: string }
        Returns: boolean
      }
      read_client_report: { Args: { _hash: string }; Returns: Json }
      read_proposal_approval: { Args: { _token: string }; Returns: Json }
      record_platform_usage: { Args: { _feature: string }; Returns: undefined }
      registered_members: {
        Args: never
        Returns: {
          created_at: string
          email: string
          employee_id: string
          full_name: string
          id: string
          platform_owner: boolean
          providers: string[]
          registration_status: string
          role: Database["public"]["Enums"]["app_role"]
          terminated_at: string
          termination_reason: string
        }[]
      }
      revoke_client_portal_access: {
        Args: { _client: string; _contact: string }
        Returns: undefined
      }
      route_pending_work: {
        Args: {
          _action: string
          _assignee?: string
          _date?: string
          _expected: string
          _note?: string
          _sheet: string
        }
        Returns: string
      }
      save_client_contact: {
        Args: { _client: string; _contact: string; _details: Json }
        Returns: string
      }
      save_employee_payroll_setup: {
        Args: {
          _config: Json
          _opening: Json
          _user: string
          _wage: Json
          _year: number
        }
        Returns: undefined
      }
      save_fleet_vehicle: {
        Args: { _litres: number; _plate: string; _price: number }
        Returns: undefined
      }
      save_fleet_vehicle_details: {
        Args: {
          _assigned: string
          _fuel_type: string
          _litres: number
          _make_model: string
          _plate: string
          _price: number
        }
        Returns: undefined
      }
      save_my_staff_signature: {
        Args: { _signature: string }
        Returns: undefined
      }
      save_sheet_snapshot: {
        Args: {
          _expected: string
          _form: Json
          _id: string
          _logs: Json
          _parts: Json
        }
        Returns: string
      }
      save_sheet_snapshot_with_photos: {
        Args: {
          _expected: string
          _form: Json
          _id: string
          _logs: Json
          _parts: Json
        }
        Returns: string
      }
      save_standby_roster: {
        Args: {
          _order: string[]
          _per_shift: number
          _rotation_days: number
          _start: string
        }
        Returns: undefined
      }
      save_standby_track: {
        Args: {
          _order: string[]
          _per_shift: number
          _rotation_days: number
          _start: string
          _track: string
        }
        Returns: undefined
      }
      search_technical_documents: {
        Args: {
          _asset?: string
          _query?: string
          _site?: string
          _status?: string
        }
        Returns: {
          asset_id: string | null
          classification: Json
          company_id: string
          content_tags: string[]
          created_at: string
          file_path: string
          id: string
          keywords: string
          notes: string
          page_count: number
          pages: Json
          restricted: boolean
          site_id: string | null
          status: string
          title: string
          updated_at: string
          uploaded_by: string
        }[]
        SetofOptions: {
          from: "*"
          to: "technical_documents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_catalog_module: {
        Args: { _catalog: string; _enabled: boolean; _module: string }
        Returns: undefined
      }
      set_member_access: {
        Args: { _active: boolean; _reason?: string; _user: string }
        Returns: undefined
      }
      set_subscription_pack: {
        Args: { _enabled: boolean; _pack: string; _subscription: string }
        Returns: undefined
      }
      sign_batch_sheet: {
        Args: {
          _batch: string
          _card: string
          _name: string
          _sheet: string
          _signature: string
        }
        Returns: undefined
      }
      standby_track_ids: {
        Args: { _company: string; _date: string; _track: string }
        Returns: string[]
      }
      submit_equipment_problem: {
        Args: {
          _first: string
          _last: string
          _position: string
          _problem: string
          _token: string
        }
        Returns: undefined
      }
      submit_platform_feedback: {
        Args: { _category: string; _message: string; _rating: number }
        Returns: string
      }
      user_initials: {
        Args: { _full_name: string; _initials: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "superuser"
        | "admin"
        | "supervisor"
        | "technician"
        | "maintenance"
      custom_field_target: "asset" | "job_sheet" | "client"
      custom_field_type: "text" | "number" | "dropdown" | "date" | "checkbox"
      job_status:
        | "draft"
        | "pending"
        | "in_transit"
        | "in_progress"
        | "completed"
      leave_status: "pending" | "approved" | "rejected"
      user_role: "admin" | "technician" | "supervisor"
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
      app_role: [
        "superuser",
        "admin",
        "supervisor",
        "technician",
        "maintenance",
      ],
      custom_field_target: ["asset", "job_sheet", "client"],
      custom_field_type: ["text", "number", "dropdown", "date", "checkbox"],
      job_status: [
        "draft",
        "pending",
        "in_transit",
        "in_progress",
        "completed",
      ],
      leave_status: ["pending", "approved", "rejected"],
      user_role: ["admin", "technician", "supervisor"],
    },
  },
} as const
