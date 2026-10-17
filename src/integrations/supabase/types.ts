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
      client_contacts: {
        Row: {
          client_id: string
          company_id: string
          email: string | null
          first_name: string
          id: string
          is_primary_contact: boolean
          last_name: string | null
          phone: string | null
          receives_job_sheets: boolean
          role_title: string | null
        }
        Insert: {
          client_id: string
          company_id: string
          email?: string | null
          first_name: string
          id?: string
          is_primary_contact?: boolean
          last_name?: string | null
          phone?: string | null
          receives_job_sheets?: boolean
          role_title?: string | null
        }
        Update: {
          client_id?: string
          company_id?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary_contact?: boolean
          last_name?: string | null
          phone?: string | null
          receives_job_sheets?: boolean
          role_title?: string | null
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
        ]
      }
      clients: {
        Row: {
          billing_address: string | null
          company_id: string
          created_at: string
          id: string
          location: string | null
          name: string
          property_name: string | null
          street_name: string | null
        }
        Insert: {
          billing_address?: string | null
          company_id: string
          created_at?: string
          id?: string
          location?: string | null
          name: string
          property_name?: string | null
          street_name?: string | null
        }
        Update: {
          billing_address?: string | null
          company_id?: string
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          property_name?: string | null
          street_name?: string | null
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
      internal_messages: {
        Row: {
          company_id: string
          created_at: string
          id: string
          job_sheet_id: string | null
          message_text: string
          receiver_id: string | null
          sender_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          job_sheet_id?: string | null
          message_text: string
          receiver_id?: string | null
          sender_id: string
        }
        Update: {
          company_id?: string
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
      job_sheets: {
        Row: {
          asset_id: string | null
          asset_type: string
          asset_type_other: string | null
          assigned_technician_id: string | null
          client_full_name: string | null
          client_id: string
          client_id_card_no: string | null
          company_id: string
          created_at: string
          custom_values: Json
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
          pending_works_future_jobs: string | null
          photo_paths: Json
          repairs_performed: string | null
          reported_fault: string | null
          requires_admin_approval: boolean
          serial_number: string | null
          signature_data: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          technician_name: string | null
          travel_start_time: string | null
          updated_at: string
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          asset_id?: string | null
          asset_type?: string
          asset_type_other?: string | null
          assigned_technician_id?: string | null
          client_full_name?: string | null
          client_id: string
          client_id_card_no?: string | null
          company_id: string
          created_at?: string
          custom_values?: Json
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
          pending_works_future_jobs?: string | null
          photo_paths?: Json
          repairs_performed?: string | null
          reported_fault?: string | null
          requires_admin_approval?: boolean
          serial_number?: string | null
          signature_data?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          technician_name?: string | null
          travel_start_time?: string | null
          updated_at?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          asset_id?: string | null
          asset_type?: string
          asset_type_other?: string | null
          assigned_technician_id?: string | null
          client_full_name?: string | null
          client_id?: string
          client_id_card_no?: string | null
          company_id?: string
          created_at?: string
          custom_values?: Json
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
          pending_works_future_jobs?: string | null
          photo_paths?: Json
          repairs_performed?: string | null
          reported_fault?: string | null
          requires_admin_approval?: boolean
          serial_number?: string | null
          signature_data?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          technician_name?: string | null
          travel_start_time?: string | null
          updated_at?: string
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
            foreignKeyName: "job_sheets_job_id_fkey"
            columns: ["job_id"]
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
      jobs: {
        Row: {
          acknowledged_at: string | null
          asset_id: string | null
          assigned_technician_id: string | null
          client_id: string
          company_id: string
          created_at: string
          id: string
          job_number: number
          priority: string
          problem_summary: string | null
          scheduled_date: string
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
          id?: string
          job_number?: number
          priority?: string
          problem_summary?: string | null
          scheduled_date?: string
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
          id?: string
          job_number?: number
          priority?: string
          problem_summary?: string | null
          scheduled_date?: string
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
            foreignKeyName: "jobs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
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
      leave_requests: {
        Row: {
          company_id: string
          created_at: string
          end_date: string
          id: string
          leave_type: string
          medical_certificate_path: string | null
          optional_notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          total_hours: number
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_date: string
          id?: string
          leave_type?: string
          medical_certificate_path?: string | null
          optional_notes?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          total_hours?: number
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          medical_certificate_path?: string | null
          optional_notes?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          total_hours?: number
          user_id?: string
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
      lookup_options: {
        Row: {
          category: string
          company_id: string | null
          created_by_user_id: string | null
          id: string
          industry_type: string | null
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
      shifts: {
        Row: {
          company_id: string
          created_at: string
          ended_at: string | null
          id: string
          shift_type: string
          started_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          shift_type?: string
          started_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          shift_type?: string
          started_at?: string
          user_id?: string
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
      user_leave_balances: {
        Row: {
          base_entitlement_hours: number
          company_id: string
          pending_hours: number
          public_holiday_credit_hours: number
          taken_hours: number
          user_id: string
        }
        Insert: {
          base_entitlement_hours?: number
          company_id: string
          pending_hours?: number
          public_holiday_credit_hours?: number
          taken_hours?: number
          user_id: string
        }
        Update: {
          base_entitlement_hours?: number
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
      current_company_id: { Args: never; Returns: string }
      has_company_role: {
        Args: { _role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      is_company_manager: { Args: never; Returns: boolean }
    }
    Enums: {
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
