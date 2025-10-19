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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ad_campaigns: {
        Row: {
          budget: number
          clicks: number
          cost_per_click: number
          created_at: string
          description: string | null
          end_date: string
          id: string
          image_url: string | null
          impressions: number
          is_active: boolean
          merchant_id: string
          product_id: string | null
          spent: number
          start_date: string
          target_farm_size_max: number | null
          target_farm_size_min: number | null
          target_region: string | null
          title: string
          updated_at: string
        }
        Insert: {
          budget: number
          clicks?: number
          cost_per_click?: number
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          merchant_id: string
          product_id?: string | null
          spent?: number
          start_date: string
          target_farm_size_max?: number | null
          target_farm_size_min?: number | null
          target_region?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          budget?: number
          clicks?: number
          cost_per_click?: number
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          merchant_id?: string
          product_id?: string | null
          spent?: number
          start_date?: string
          target_farm_size_max?: number | null
          target_farm_size_min?: number | null
          target_region?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_impressions: {
        Row: {
          campaign_id: string
          clicked: boolean
          created_at: string
          farmer_id: string
          id: string
        }
        Insert: {
          campaign_id: string
          clicked?: boolean
          created_at?: string
          farmer_id: string
          id?: string
        }
        Update: {
          campaign_id?: string
          clicked?: boolean
          created_at?: string
          farmer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_impressions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_records: {
        Row: {
          animal_id: string
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          performed_date: string | null
          pregnancy_confirmed: boolean | null
          scheduled_date: string | null
          technician: string | null
        }
        Insert: {
          animal_id: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          performed_date?: string | null
          pregnancy_confirmed?: boolean | null
          scheduled_date?: string | null
          technician?: string | null
        }
        Update: {
          animal_id?: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          performed_date?: string | null
          pregnancy_confirmed?: boolean | null
          scheduled_date?: string | null
          technician?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      animal_events: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["animal_event_type"]
          id: string
          notes: string | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["animal_event_type"]
          id?: string
          notes?: string | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["animal_event_type"]
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "animal_events_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      animal_photos: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          photo_path: string
          taken_at: string | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          photo_path: string
          taken_at?: string | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          photo_path?: string
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "animal_photos_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      animals: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          breed: string | null
          client_generated_id: string | null
          created_at: string
          current_weight_kg: number | null
          ear_tag: string | null
          farm_id: string
          father_id: string | null
          gender: string | null
          id: string
          is_deleted: boolean
          life_stage: string | null
          milking_stage: string | null
          milking_start_date: string | null
          mother_id: string | null
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          breed?: string | null
          client_generated_id?: string | null
          created_at?: string
          current_weight_kg?: number | null
          ear_tag?: string | null
          farm_id: string
          father_id?: string | null
          gender?: string | null
          id?: string
          is_deleted?: boolean
          life_stage?: string | null
          milking_stage?: string | null
          milking_start_date?: string | null
          mother_id?: string | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          breed?: string | null
          client_generated_id?: string | null
          created_at?: string
          current_weight_kg?: number | null
          ear_tag?: string | null
          farm_id?: string
          father_id?: string | null
          gender?: string | null
          id?: string
          is_deleted?: boolean
          life_stage?: string | null
          milking_stage?: string | null
          milking_start_date?: string | null
          mother_id?: string | null
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animals_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_father_id_fkey"
            columns: ["father_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_mother_id_fkey"
            columns: ["mother_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_reports: {
        Row: {
          branches_covered: number
          branches_total: number
          coverage_percentage: number
          created_at: string
          file_path: string
          functions_covered: number
          functions_total: number
          id: string
          lines_covered: number
          lines_total: number
          test_run_id: string
        }
        Insert: {
          branches_covered: number
          branches_total: number
          coverage_percentage: number
          created_at?: string
          file_path: string
          functions_covered: number
          functions_total: number
          id?: string
          lines_covered: number
          lines_total: number
          test_run_id: string
        }
        Update: {
          branches_covered?: number
          branches_total?: number
          coverage_percentage?: number
          created_at?: string
          file_path?: string
          functions_covered?: number
          functions_total?: number
          id?: string
          lines_covered?: number
          lines_total?: number
          test_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_reports_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_farm_stats: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          stage_counts: Json
          stat_date: string
          total_milk_liters: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          stage_counts?: Json
          stat_date: string
          total_milk_liters?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          stage_counts?: Json
          stat_date?: string
          total_milk_liters?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_farm_stats_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      distributors: {
        Row: {
          address: string
          contact_person: string | null
          created_at: string
          email: string | null
          gps_lat: number
          gps_lng: number
          id: string
          is_active: boolean
          merchant_id: string
          name: string
          phone: string
          region: string | null
          updated_at: string
        }
        Insert: {
          address: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gps_lat: number
          gps_lng: number
          id?: string
          is_active?: boolean
          merchant_id: string
          name: string
          phone: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gps_lat?: number
          gps_lng?: number
          id?: string
          is_active?: boolean
          merchant_id?: string
          name?: string
          phone?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distributors_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_aga_faqs: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          question: string
          tags: string[] | null
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          tags?: string[] | null
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          tags?: string[] | null
        }
        Relationships: []
      }
      doc_aga_queries: {
        Row: {
          answer: string | null
          created_at: string
          farm_id: string | null
          id: string
          image_url: string | null
          matched_faq_id: string | null
          question: string
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          created_at?: string
          farm_id?: string | null
          id?: string
          image_url?: string | null
          matched_faq_id?: string | null
          question: string
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          created_at?: string
          farm_id?: string | null
          id?: string
          image_url?: string | null
          matched_faq_id?: string | null
          question?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_aga_queries_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_aga_queries_matched_faq_id_fkey"
            columns: ["matched_faq_id"]
            isOneToOne: false
            referencedRelation: "doc_aga_faqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_aga_queries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_memberships: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          invitation_status: string | null
          invitation_token: string | null
          invited_at: string | null
          invited_by: string | null
          invited_email: string | null
          role_in_farm: Database["public"]["Enums"]["user_role"]
          token_expires_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          invitation_status?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          role_in_farm: Database["public"]["Enums"]["user_role"]
          token_expires_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          invitation_status?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          role_in_farm?: Database["public"]["Enums"]["user_role"]
          token_expires_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_memberships_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          client_generated_id: string | null
          created_at: string
          gps_lat: number
          gps_lng: number
          id: string
          is_deleted: boolean
          name: string
          owner_id: string
          region: string | null
          updated_at: string
        }
        Insert: {
          client_generated_id?: string | null
          created_at?: string
          gps_lat: number
          gps_lng: number
          id?: string
          is_deleted?: boolean
          name: string
          owner_id: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          client_generated_id?: string | null
          created_at?: string
          gps_lat?: number
          gps_lng?: number
          id?: string
          is_deleted?: boolean
          name?: string
          owner_id?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farms_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_inventory: {
        Row: {
          cost_per_unit: number | null
          created_at: string
          created_by: string | null
          farm_id: string
          feed_type: string
          id: string
          last_updated: string
          notes: string | null
          quantity_kg: number
          reorder_threshold: number | null
          supplier: string | null
          unit: string
          weight_per_unit: number | null
        }
        Insert: {
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          farm_id: string
          feed_type: string
          id?: string
          last_updated?: string
          notes?: string | null
          quantity_kg?: number
          reorder_threshold?: number | null
          supplier?: string | null
          unit?: string
          weight_per_unit?: number | null
        }
        Update: {
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          farm_id?: string
          feed_type?: string
          id?: string
          last_updated?: string
          notes?: string | null
          quantity_kg?: number
          reorder_threshold?: number | null
          supplier?: string | null
          unit?: string
          weight_per_unit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_inventory_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_stock_transactions: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          feed_inventory_id: string
          id: string
          notes: string | null
          quantity_change_kg: number
          transaction_type: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          feed_inventory_id: string
          id?: string
          notes?: string | null
          quantity_change_kg: number
          transaction_type: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          feed_inventory_id?: string
          id?: string
          notes?: string | null
          quantity_change_kg?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_stock_transactions_feed_inventory_id_fkey"
            columns: ["feed_inventory_id"]
            isOneToOne: false
            referencedRelation: "feed_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_records: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          feed_type: string | null
          id: string
          kilograms: number | null
          notes: string | null
          record_datetime: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          feed_type?: string | null
          id?: string
          kilograms?: number | null
          notes?: string | null
          record_datetime: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          feed_type?: string | null
          id?: string
          kilograms?: number | null
          notes?: string | null
          record_datetime?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          diagnosis: string | null
          id: string
          notes: string | null
          treatment: string | null
          visit_date: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          id?: string
          notes?: string | null
          treatment?: string | null
          visit_date: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          id?: string
          notes?: string | null
          treatment?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      injection_records: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          dosage: string | null
          id: string
          instructions: string | null
          medicine_name: string | null
          photo_path: string | null
          record_datetime: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          dosage?: string | null
          id?: string
          instructions?: string | null
          medicine_name?: string | null
          photo_path?: string | null
          record_datetime: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          dosage?: string | null
          id?: string
          instructions?: string | null
          medicine_name?: string | null
          photo_path?: string | null
          record_datetime?: string
        }
        Relationships: [
          {
            foreignKeyName: "injection_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injection_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          is_paid: boolean
          issued_date: string
          order_id: string
          paid_date: string | null
          tax_amount: number
        }
        Insert: {
          amount: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          is_paid?: boolean
          issued_date?: string
          order_id: string
          paid_date?: string | null
          tax_amount?: number
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          is_paid?: boolean
          issued_date?: string
          order_id?: string
          paid_date?: string | null
          tax_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          business_address: string | null
          business_description: string | null
          business_logo_url: string | null
          business_name: string
          contact_email: string
          contact_phone: string | null
          created_at: string
          gps_lat: number | null
          gps_lng: number | null
          id: string
          is_verified: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          business_address?: string | null
          business_description?: string | null
          business_logo_url?: string | null
          business_name: string
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          is_verified?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          business_address?: string | null
          business_description?: string | null
          business_logo_url?: string | null
          business_name?: string
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          is_verified?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          order_id: string | null
          recipient_id: string
          recipient_type: Database["public"]["Enums"]["message_party"]
          sender_id: string
          sender_type: Database["public"]["Enums"]["message_party"]
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          order_id?: string | null
          recipient_id: string
          recipient_type: Database["public"]["Enums"]["message_party"]
          sender_id: string
          sender_type: Database["public"]["Enums"]["message_party"]
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          order_id?: string | null
          recipient_id?: string
          recipient_type?: Database["public"]["Enums"]["message_party"]
          sender_id?: string
          sender_type?: Database["public"]["Enums"]["message_party"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      milking_records: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          id: string
          liters: number
          record_date: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          liters?: number
          record_date: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          liters?: number
          record_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "milking_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milking_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_farm_stats: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          month_date: string
          stage_counts: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          month_date: string
          stage_counts?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          month_date?: string
          stage_counts?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_farm_stats_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          delivery_address: string | null
          farmer_id: string
          id: string
          merchant_id: string
          notes: string | null
          order_number: string
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_address?: string | null
          farmer_id: string
          id?: string
          merchant_id: string
          notes?: string | null
          order_number: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_address?: string | null
          farmer_id?: string
          id?: string
          merchant_id?: string
          notes?: string | null
          order_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          merchant_id: string
          name: string
          price: number
          stock_quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          merchant_id: string
          name: string
          price: number
          stock_quantity?: number
          unit: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          merchant_id?: string
          name?: string
          price?: number
          stock_quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          created_at: string
          duration_ms: number
          error_message: string | null
          file_path: string | null
          id: string
          stack_trace: string | null
          status: string
          suite_name: string
          test_name: string
          test_run_id: string
        }
        Insert: {
          created_at?: string
          duration_ms: number
          error_message?: string | null
          file_path?: string | null
          id?: string
          stack_trace?: string | null
          status: string
          suite_name: string
          test_name: string
          test_run_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          file_path?: string | null
          id?: string
          stack_trace?: string | null
          status?: string
          suite_name?: string
          test_name?: string
          test_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_results_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_runs: {
        Row: {
          branch: string
          commit_hash: string | null
          coverage_percentage: number | null
          created_at: string
          duration_ms: number
          failed_tests: number
          id: string
          passed_tests: number
          run_date: string
          skipped_tests: number
          status: string
          total_tests: number
          triggered_by: string | null
        }
        Insert: {
          branch: string
          commit_hash?: string | null
          coverage_percentage?: number | null
          created_at?: string
          duration_ms: number
          failed_tests: number
          id?: string
          passed_tests: number
          run_date?: string
          skipped_tests: number
          status: string
          total_tests: number
          triggered_by?: string | null
        }
        Update: {
          branch?: string
          commit_hash?: string | null
          coverage_percentage?: number | null
          created_at?: string
          duration_ms?: number
          failed_tests?: number
          id?: string
          passed_tests?: number
          run_date?: string
          skipped_tests?: number
          status?: string
          total_tests?: number
          triggered_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      weight_records: {
        Row: {
          animal_id: string
          created_at: string
          id: string
          measurement_date: string
          measurement_method: string | null
          notes: string | null
          recorded_by: string | null
          weight_kg: number
        }
        Insert: {
          animal_id: string
          created_at?: string
          id?: string
          measurement_date: string
          measurement_method?: string | null
          notes?: string | null
          recorded_by?: string | null
          weight_kg: number
        }
        Update: {
          animal_id?: string
          created_at?: string
          id?: string
          measurement_date?: string
          measurement_method?: string | null
          notes?: string | null
          recorded_by?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_farm: {
        Args: { fid: string }
        Returns: boolean
      }
      create_default_farm: {
        Args: {
          _name?: string
          _region?: string
          _role?: Database["public"]["Enums"]["user_role"]
        }
        Returns: string
      }
      generate_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      handle_merchant_signup: {
        Args: {
          _business_address: string
          _business_description: string
          _business_name: string
          _contact_email: string
          _contact_phone: string
          _full_name: string
          _user_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_farm_manager: {
        Args: { _farm_id: string; _user_id: string }
        Returns: boolean
      }
      is_farm_member: {
        Args: { farm_id: string }
        Returns: boolean
      }
      is_farm_owner: {
        Args: { _farm_id: string; _user_id: string }
        Returns: boolean
      }
      is_farm_owner_or_manager: {
        Args: { _farm_id: string; _user_id: string }
        Returns: boolean
      }
      is_farmhand: {
        Args: { _farm_id: string; _user_id: string }
        Returns: boolean
      }
      is_merchant: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      animal_event_type:
        | "birth"
        | "pregnancy_confirmed"
        | "ai_scheduled"
        | "ai_performed"
        | "milking_started"
        | "health_diagnosis"
        | "treatment"
        | "note"
      message_party: "farmer" | "merchant" | "vet" | "admin"
      notification_type:
        | "order_update"
        | "vet_update"
        | "message"
        | "system"
        | "order_received"
      order_status:
        | "received"
        | "in_process"
        | "in_transit"
        | "delivered"
        | "cancelled"
      user_role:
        | "farmer_owner"
        | "farmhand"
        | "merchant"
        | "vet"
        | "admin"
        | "distributor"
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
      animal_event_type: [
        "birth",
        "pregnancy_confirmed",
        "ai_scheduled",
        "ai_performed",
        "milking_started",
        "health_diagnosis",
        "treatment",
        "note",
      ],
      message_party: ["farmer", "merchant", "vet", "admin"],
      notification_type: [
        "order_update",
        "vet_update",
        "message",
        "system",
        "order_received",
      ],
      order_status: [
        "received",
        "in_process",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      user_role: [
        "farmer_owner",
        "farmhand",
        "merchant",
        "vet",
        "admin",
        "distributor",
      ],
    },
  },
} as const
