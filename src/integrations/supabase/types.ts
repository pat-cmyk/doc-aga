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
      admin_actions: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
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
          semen_code: string | null
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
          semen_code?: string | null
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
          semen_code?: string | null
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
          milestone_type: string | null
          photo_path: string
          taken_at: string | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          milestone_type?: string | null
          photo_path: string
          taken_at?: string | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          milestone_type?: string | null
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
          buyer_info: string | null
          client_generated_id: string | null
          created_at: string
          current_weight_kg: number | null
          ear_tag: string | null
          exit_date: string | null
          exit_notes: string | null
          exit_reason: string | null
          exit_reason_details: string | null
          farm_id: string
          father_id: string | null
          gender: string | null
          id: string
          is_deleted: boolean
          life_stage: string | null
          livestock_type: string
          milking_stage: string | null
          milking_start_date: string | null
          mother_id: string | null
          name: string | null
          sale_price: number | null
          unique_code: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          breed?: string | null
          buyer_info?: string | null
          client_generated_id?: string | null
          created_at?: string
          current_weight_kg?: number | null
          ear_tag?: string | null
          exit_date?: string | null
          exit_notes?: string | null
          exit_reason?: string | null
          exit_reason_details?: string | null
          farm_id: string
          father_id?: string | null
          gender?: string | null
          id?: string
          is_deleted?: boolean
          life_stage?: string | null
          livestock_type?: string
          milking_stage?: string | null
          milking_start_date?: string | null
          mother_id?: string | null
          name?: string | null
          sale_price?: number | null
          unique_code: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          breed?: string | null
          buyer_info?: string | null
          client_generated_id?: string | null
          created_at?: string
          current_weight_kg?: number | null
          ear_tag?: string | null
          exit_date?: string | null
          exit_notes?: string | null
          exit_reason?: string | null
          exit_reason_details?: string | null
          farm_id?: string
          father_id?: string | null
          gender?: string | null
          id?: string
          is_deleted?: boolean
          life_stage?: string | null
          livestock_type?: string
          milking_stage?: string | null
          milking_start_date?: string | null
          mother_id?: string | null
          name?: string | null
          sale_price?: number | null
          unique_code?: string
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
            foreignKeyName: "animals_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
      biological_asset_valuations: {
        Row: {
          animal_id: string
          created_at: string | null
          estimated_value: number | null
          farm_id: string
          id: string
          is_sold: boolean | null
          market_price_per_kg: number
          valuation_date: string
          weight_kg: number
        }
        Insert: {
          animal_id: string
          created_at?: string | null
          estimated_value?: number | null
          farm_id: string
          id?: string
          is_sold?: boolean | null
          market_price_per_kg: number
          valuation_date?: string
          weight_kg: number
        }
        Update: {
          animal_id?: string
          created_at?: string | null
          estimated_value?: number | null
          farm_id?: string
          id?: string
          is_sold?: boolean | null
          market_price_per_kg?: number
          valuation_date?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "biological_asset_valuations_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biological_asset_valuations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biological_asset_valuations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      body_condition_scores: {
        Row: {
          animal_id: string
          assessment_date: string
          assessor_id: string | null
          created_at: string
          farm_id: string
          id: string
          notes: string | null
          photo_id: string | null
          score: number
        }
        Insert: {
          animal_id: string
          assessment_date?: string
          assessor_id?: string | null
          created_at?: string
          farm_id: string
          id?: string
          notes?: string | null
          photo_id?: string | null
          score: number
        }
        Update: {
          animal_id?: string
          assessment_date?: string
          assessor_id?: string | null
          created_at?: string
          farm_id?: string
          id?: string
          notes?: string | null
          photo_id?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "body_condition_scores_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_condition_scores_assessor_id_fkey"
            columns: ["assessor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_condition_scores_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_condition_scores_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_condition_scores_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "animal_photos"
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
          {
            foreignKeyName: "daily_farm_stats_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
            foreignKeyName: "doc_aga_queries_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
      farm_approval_settings: {
        Row: {
          auto_approve_enabled: boolean
          auto_approve_hours: number
          created_at: string
          farm_id: string
          require_approval_for_types: string[] | null
          updated_at: string
        }
        Insert: {
          auto_approve_enabled?: boolean
          auto_approve_hours?: number
          created_at?: string
          farm_id: string
          require_approval_for_types?: string[] | null
          updated_at?: string
        }
        Update: {
          auto_approve_enabled?: boolean
          auto_approve_hours?: number
          created_at?: string
          farm_id?: string
          require_approval_for_types?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_approval_settings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: true
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_approval_settings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: true
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_expenses: {
        Row: {
          allocation_type: string | null
          amount: number
          category: string
          created_at: string | null
          description: string | null
          expense_date: string
          farm_id: string
          id: string
          is_deleted: boolean | null
          linked_feed_inventory_id: string | null
          payment_method: string | null
          receipt_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allocation_type?: string | null
          amount: number
          category: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          farm_id: string
          id?: string
          is_deleted?: boolean | null
          linked_feed_inventory_id?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allocation_type?: string | null
          amount?: number
          category?: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          farm_id?: string
          id?: string
          is_deleted?: boolean | null
          linked_feed_inventory_id?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_expenses_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_expenses_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_expenses_linked_feed_inventory_id_fkey"
            columns: ["linked_feed_inventory_id"]
            isOneToOne: false
            referencedRelation: "feed_inventory"
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
            foreignKeyName: "farm_memberships_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
      farm_revenues: {
        Row: {
          amount: number
          created_at: string | null
          farm_id: string
          id: string
          is_deleted: boolean | null
          linked_animal_id: string | null
          linked_milk_log_id: string | null
          notes: string | null
          source: string
          transaction_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          farm_id: string
          id?: string
          is_deleted?: boolean | null
          linked_animal_id?: string | null
          linked_milk_log_id?: string | null
          notes?: string | null
          source: string
          transaction_date?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          farm_id?: string
          id?: string
          is_deleted?: boolean | null
          linked_animal_id?: string | null
          linked_milk_log_id?: string | null
          notes?: string | null
          source?: string
          transaction_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_revenues_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_revenues_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_revenues_linked_animal_id_fkey"
            columns: ["linked_animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_revenues_linked_milk_log_id_fkey"
            columns: ["linked_milk_log_id"]
            isOneToOne: false
            referencedRelation: "milking_records"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_feedback: {
        Row: {
          acknowledged_at: string | null
          action_taken: string | null
          ai_summary: string | null
          assigned_department: string | null
          auto_priority: Database["public"]["Enums"]["feedback_priority"]
          created_at: string
          detected_entities: Json | null
          farm_id: string
          farm_snapshot: Json | null
          government_notes: string | null
          id: string
          is_anonymous: boolean
          primary_category: Database["public"]["Enums"]["feedback_category"]
          priority_score: number
          resolution_date: string | null
          reviewed_at: string | null
          secondary_categories:
            | Database["public"]["Enums"]["feedback_category"][]
            | null
          sentiment: Database["public"]["Enums"]["feedback_sentiment"]
          status: Database["public"]["Enums"]["feedback_status"]
          tags: string[] | null
          transcription: string
          updated_at: string
          user_id: string
          voice_audio_url: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          action_taken?: string | null
          ai_summary?: string | null
          assigned_department?: string | null
          auto_priority?: Database["public"]["Enums"]["feedback_priority"]
          created_at?: string
          detected_entities?: Json | null
          farm_id: string
          farm_snapshot?: Json | null
          government_notes?: string | null
          id?: string
          is_anonymous?: boolean
          primary_category: Database["public"]["Enums"]["feedback_category"]
          priority_score?: number
          resolution_date?: string | null
          reviewed_at?: string | null
          secondary_categories?:
            | Database["public"]["Enums"]["feedback_category"][]
            | null
          sentiment?: Database["public"]["Enums"]["feedback_sentiment"]
          status?: Database["public"]["Enums"]["feedback_status"]
          tags?: string[] | null
          transcription: string
          updated_at?: string
          user_id: string
          voice_audio_url?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          action_taken?: string | null
          ai_summary?: string | null
          assigned_department?: string | null
          auto_priority?: Database["public"]["Enums"]["feedback_priority"]
          created_at?: string
          detected_entities?: Json | null
          farm_id?: string
          farm_snapshot?: Json | null
          government_notes?: string | null
          id?: string
          is_anonymous?: boolean
          primary_category?: Database["public"]["Enums"]["feedback_category"]
          priority_score?: number
          resolution_date?: string | null
          reviewed_at?: string | null
          secondary_categories?:
            | Database["public"]["Enums"]["feedback_category"][]
            | null
          sentiment?: Database["public"]["Enums"]["feedback_sentiment"]
          status?: Database["public"]["Enums"]["feedback_status"]
          tags?: string[] | null
          transcription?: string
          updated_at?: string
          user_id?: string
          voice_audio_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmer_feedback_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_feedback_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          client_generated_id: string | null
          created_at: string
          ffedis_id: string | null
          gps_lat: number
          gps_lng: number
          id: string
          is_deleted: boolean
          is_program_participant: boolean | null
          lgu_code: string | null
          livestock_type: string
          logo_url: string | null
          municipality: string | null
          name: string
          owner_id: string
          program_group: string | null
          province: string | null
          region: string | null
          updated_at: string
          validated_at: string | null
          validation_status: string | null
        }
        Insert: {
          client_generated_id?: string | null
          created_at?: string
          ffedis_id?: string | null
          gps_lat: number
          gps_lng: number
          id?: string
          is_deleted?: boolean
          is_program_participant?: boolean | null
          lgu_code?: string | null
          livestock_type?: string
          logo_url?: string | null
          municipality?: string | null
          name: string
          owner_id: string
          program_group?: string | null
          province?: string | null
          region?: string | null
          updated_at?: string
          validated_at?: string | null
          validation_status?: string | null
        }
        Update: {
          client_generated_id?: string | null
          created_at?: string
          ffedis_id?: string | null
          gps_lat?: number
          gps_lng?: number
          id?: string
          is_deleted?: boolean
          is_program_participant?: boolean | null
          lgu_code?: string | null
          livestock_type?: string
          logo_url?: string | null
          municipality?: string | null
          name?: string
          owner_id?: string
          program_group?: string | null
          province?: string | null
          region?: string | null
          updated_at?: string
          validated_at?: string | null
          validation_status?: string | null
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
          {
            foreignKeyName: "feed_inventory_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
      health_symptom_categories: {
        Row: {
          created_at: string | null
          detected_at: string | null
          health_record_id: string | null
          id: string
          severity: string | null
          symptom_type: string
        }
        Insert: {
          created_at?: string | null
          detected_at?: string | null
          health_record_id?: string | null
          id?: string
          severity?: string | null
          symptom_type: string
        }
        Update: {
          created_at?: string | null
          detected_at?: string | null
          health_record_id?: string | null
          id?: string
          severity?: string | null
          symptom_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_symptom_categories_health_record_id_fkey"
            columns: ["health_record_id"]
            isOneToOne: false
            referencedRelation: "health_records"
            referencedColumns: ["id"]
          },
        ]
      }
      heat_records: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          detected_at: string
          detection_method: string
          farm_id: string
          id: string
          intensity: string | null
          notes: string | null
          optimal_breeding_end: string | null
          optimal_breeding_start: string | null
          standing_heat: boolean | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          detected_at?: string
          detection_method?: string
          farm_id: string
          id?: string
          intensity?: string | null
          notes?: string | null
          optimal_breeding_end?: string | null
          optimal_breeding_start?: string | null
          standing_heat?: boolean | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          detected_at?: string
          detection_method?: string
          farm_id?: string
          id?: string
          intensity?: string | null
          notes?: string | null
          optimal_breeding_end?: string | null
          optimal_breeding_start?: string | null
          standing_heat?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "heat_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heat_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heat_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heat_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
      market_prices: {
        Row: {
          animal_id: string | null
          created_at: string | null
          effective_date: string
          farm_id: string | null
          id: string
          is_verified: boolean | null
          livestock_type: string
          municipality: string | null
          notes: string | null
          price_per_kg: number
          province: string | null
          region: string | null
          reported_by: string | null
          source: string
        }
        Insert: {
          animal_id?: string | null
          created_at?: string | null
          effective_date?: string
          farm_id?: string | null
          id?: string
          is_verified?: boolean | null
          livestock_type: string
          municipality?: string | null
          notes?: string | null
          price_per_kg: number
          province?: string | null
          region?: string | null
          reported_by?: string | null
          source: string
        }
        Update: {
          animal_id?: string | null
          created_at?: string | null
          effective_date?: string
          farm_id?: string | null
          id?: string
          is_verified?: boolean | null
          livestock_type?: string
          municipality?: string | null
          notes?: string | null
          price_per_kg?: number
          province?: string | null
          region?: string | null
          reported_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_prices_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_prices_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_prices_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
          is_sold: boolean | null
          liters: number
          price_per_liter: number | null
          record_date: string
          sale_amount: number | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_sold?: boolean | null
          liters?: number
          price_per_liter?: number | null
          record_date: string
          sale_amount?: number | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_sold?: boolean | null
          liters?: number
          price_per_liter?: number | null
          record_date?: string
          sale_amount?: number | null
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
          {
            foreignKeyName: "monthly_farm_stats_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
      pending_activities: {
        Row: {
          activity_data: Json
          activity_type: Database["public"]["Enums"]["pending_activity_type"]
          animal_ids: string[]
          auto_approve_at: string | null
          created_at: string
          farm_id: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["pending_activity_status"]
          submitted_at: string
          submitted_by: string
        }
        Insert: {
          activity_data: Json
          activity_type: Database["public"]["Enums"]["pending_activity_type"]
          animal_ids: string[]
          auto_approve_at?: string | null
          created_at?: string
          farm_id: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["pending_activity_status"]
          submitted_at?: string
          submitted_by: string
        }
        Update: {
          activity_data?: Json
          activity_type?: Database["public"]["Enums"]["pending_activity_type"]
          animal_ids?: string[]
          auto_approve_at?: string | null
          created_at?: string
          farm_id?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["pending_activity_status"]
          submitted_at?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pending_activities_reviewed_by_profiles"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pending_activities_submitted_by_profiles"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_health_protocols: {
        Row: {
          created_at: string | null
          first_dose_age_months: number | null
          id: string
          is_mandatory: boolean | null
          livestock_type: string
          notes: string | null
          recurring_interval_months: number | null
          source: string | null
          treatment_name: string
          treatment_name_tagalog: string | null
          treatment_type: string
        }
        Insert: {
          created_at?: string | null
          first_dose_age_months?: number | null
          id?: string
          is_mandatory?: boolean | null
          livestock_type: string
          notes?: string | null
          recurring_interval_months?: number | null
          source?: string | null
          treatment_name: string
          treatment_name_tagalog?: string | null
          treatment_type: string
        }
        Update: {
          created_at?: string | null
          first_dose_age_months?: number | null
          id?: string
          is_mandatory?: boolean | null
          livestock_type?: string
          notes?: string | null
          recurring_interval_months?: number | null
          source?: string | null
          treatment_name?: string
          treatment_name_tagalog?: string | null
          treatment_type?: string
        }
        Relationships: []
      }
      preventive_health_schedules: {
        Row: {
          animal_id: string
          completed_by: string | null
          completed_date: string | null
          created_at: string | null
          farm_id: string
          id: string
          next_due_date: string | null
          notes: string | null
          recurring_interval_months: number | null
          schedule_type: string
          scheduled_date: string
          status: string | null
          treatment_name: string
          updated_at: string | null
        }
        Insert: {
          animal_id: string
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string | null
          farm_id: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          recurring_interval_months?: number | null
          schedule_type: string
          scheduled_date: string
          status?: string | null
          treatment_name: string
          updated_at?: string | null
        }
        Update: {
          animal_id?: string
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string | null
          farm_id?: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          recurring_interval_months?: number | null
          schedule_type?: string
          scheduled_date?: string
          status?: string | null
          treatment_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preventive_health_schedules_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_health_schedules_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_health_schedules_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_health_schedules_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
          updated_at: string
          voice_training_completed: boolean | null
          voice_training_skipped: boolean | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          voice_training_completed?: boolean | null
          voice_training_skipped?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          voice_training_completed?: boolean | null
          voice_training_skipped?: boolean | null
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
      transcription_corrections: {
        Row: {
          audio_duration_seconds: number | null
          context: string | null
          corrected_text: string
          created_at: string
          farm_id: string | null
          id: string
          original_text: string
          user_id: string
        }
        Insert: {
          audio_duration_seconds?: number | null
          context?: string | null
          corrected_text: string
          created_at?: string
          farm_id?: string | null
          id?: string
          original_text: string
          user_id: string
        }
        Update: {
          audio_duration_seconds?: number | null
          context?: string | null
          corrected_text?: string
          created_at?: string
          farm_id?: string | null
          id?: string
          original_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcription_corrections_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcription_corrections_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_logs: {
        Row: {
          activity_category: string
          activity_type: string
          created_at: string
          description: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activity_category: string
          activity_type: string
          created_at?: string
          description: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activity_category?: string
          activity_type?: string
          created_at?: string
          description?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_super_admin: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_super_admin?: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_super_admin?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles_audit: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          id: string
          is_super_admin: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          id?: string
          is_super_admin?: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          is_super_admin?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string | null
        }
        Relationships: []
      }
      voice_training_samples: {
        Row: {
          audio_url: string
          created_at: string | null
          id: string
          language: string
          sample_text: string
          transcription: string | null
          user_id: string
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          id?: string
          language: string
          sample_text: string
          transcription?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          id?: string
          language?: string
          sample_text?: string
          transcription?: string | null
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
      gov_farm_analytics: {
        Row: {
          active_animal_count: number | null
          animal_count: number | null
          ffedis_id: string | null
          gps_lat: number | null
          gps_lng: number | null
          health_events_30d: number | null
          health_events_7d: number | null
          id: string | null
          is_program_participant: boolean | null
          lgu_code: string | null
          municipality: string | null
          name: string | null
          owner_id: string | null
          program_group: string | null
          province: string | null
          region: string | null
          validated_at: string | null
          validation_status: string | null
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
    }
    Functions: {
      admin_assign_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_remove_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: undefined
      }
      approve_pending_activity: {
        Args: { _approved_by: string; _is_auto?: boolean; _pending_id: string }
        Returns: Json
      }
      calculate_auto_approve_time: {
        Args: { _farm_id: string }
        Returns: string
      }
      can_access_farm: { Args: { fid: string }; Returns: boolean }
      create_default_farm:
        | {
            Args: {
              _livestock_type?: string
              _municipality?: string
              _name?: string
              _province?: string
              _region?: string
              _role?: Database["public"]["Enums"]["user_role"]
            }
            Returns: string
          }
        | {
            Args: {
              _name?: string
              _region?: string
              _role?: Database["public"]["Enums"]["user_role"]
            }
            Returns: string
          }
        | {
            Args: {
              _livestock_type?: string
              _name?: string
              _region?: string
              _role?: Database["public"]["Enums"]["user_role"]
            }
            Returns: string
          }
      generate_animal_code: { Args: { animal_type: string }; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      get_combined_dashboard_data: {
        Args: {
          p_end_date: string
          p_farm_id: string
          p_monthly_end_date: string
          p_monthly_start_date: string
          p_start_date: string
        }
        Returns: Json
      }
      get_government_breeding_stats: {
        Args: {
          end_date: string
          municipality_filter?: string
          province_filter?: string
          region_filter?: string
          start_date: string
        }
        Returns: {
          ai_success_rate: number
          carabao_success_rate: number
          cattle_success_rate: number
          currently_pregnant: number
          due_this_quarter: number
          expected_deliveries_by_month: Json
          goat_success_rate: number
          sheep_success_rate: number
          total_ai_performed: number
          total_ai_scheduled: number
          total_pregnancies_confirmed: number
          unique_semen_codes: number
        }[]
      }
      get_government_health_stats: {
        Args: {
          end_date: string
          municipality_filter?: string
          province_filter?: string
          region_filter?: string
          start_date: string
        }
        Returns: {
          animals_in_optimal_window: number
          animals_optimal: number
          animals_overweight: number
          animals_underweight: number
          avg_bcs_score: number
          avg_cycle_length_days: number
          bcs_assessments_count: number
          completed_deworming: number
          completed_vaccinations: number
          exits_culled: number
          exits_died: number
          exits_slaughtered: number
          exits_sold: number
          exits_transferred: number
          heat_events_count: number
          mortality_rate: number
          overdue_vaccinations: number
          scheduled_deworming: number
          scheduled_vaccinations: number
          total_exits: number
          total_sales_revenue: number
          vaccination_compliance_rate: number
        }[]
      }
      get_government_stats: {
        Args: {
          end_date: string
          municipality_filter?: string
          province_filter?: string
          region_filter?: string
          start_date: string
        }
        Returns: {
          active_animal_count: number
          avg_milk_liters: number
          daily_log_count: number
          doc_aga_query_count: number
          farm_count: number
          health_event_count: number
        }[]
      }
      get_government_stats_timeseries: {
        Args: {
          end_date: string
          municipality_filter?: string
          province_filter?: string
          region_filter?: string
          start_date: string
        }
        Returns: {
          active_animal_count: number
          avg_milk_liters: number
          date: string
          doc_aga_query_count: number
          farm_count: number
          health_event_count: number
          livestock_type: string
        }[]
      }
      get_health_heatmap_data: {
        Args: {
          days_back?: number
          municipality_filter?: string
          province_filter?: string
          region_filter?: string
        }
        Returns: {
          health_event_count: number
          municipality: string
          prevalence_rate: number
          region: string
          symptom_types: string[]
          total_animals: number
        }[]
      }
      get_market_price: {
        Args: {
          p_farm_id?: string
          p_livestock_type: string
          p_province?: string
          p_region?: string
        }
        Returns: {
          effective_date: string
          price: number
          source: string
        }[]
      }
      get_upcoming_alerts: {
        Args: { p_days_ahead?: number; p_farm_id: string }
        Returns: {
          alert_title: string
          alert_type: string
          animal_ear_tag: string
          animal_id: string
          animal_name: string
          days_until_due: number
          due_date: string
          schedule_id: string
          urgency: string
        }[]
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
      has_government_access: { Args: { _user_id: string }; Returns: boolean }
      has_order_with_merchant: {
        Args: { _merchant_id: string; _user_id: string }
        Returns: boolean
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
      is_farm_manager_only: {
        Args: { _farm_id: string; _user_id: string }
        Returns: boolean
      }
      is_farm_member: { Args: { farm_id: string }; Returns: boolean }
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
      is_merchant: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_user_activity: {
        Args: {
          _activity_category: string
          _activity_type: string
          _description: string
          _metadata?: Json
          _user_id: string
        }
        Returns: string
      }
      requires_approval: {
        Args: { _activity_type: string; _farm_id: string; _user_id: string }
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
      feedback_category:
        | "policy_concern"
        | "market_access"
        | "veterinary_support"
        | "training_request"
        | "infrastructure"
        | "financial_assistance"
        | "emergency_support"
        | "disease_outbreak"
        | "feed_shortage"
      feedback_priority: "critical" | "high" | "medium" | "low"
      feedback_sentiment: "urgent" | "negative" | "neutral" | "positive"
      feedback_status:
        | "submitted"
        | "acknowledged"
        | "under_review"
        | "action_taken"
        | "resolved"
        | "closed"
      message_party: "farmer" | "merchant" | "vet" | "admin"
      notification_type:
        | "order_update"
        | "vet_update"
        | "message"
        | "system"
        | "order_received"
        | "activity_approved"
        | "activity_rejected"
      order_status:
        | "received"
        | "in_process"
        | "in_transit"
        | "delivered"
        | "cancelled"
      pending_activity_status:
        | "pending"
        | "approved"
        | "rejected"
        | "auto_approved"
      pending_activity_type:
        | "milking"
        | "feeding"
        | "health_observation"
        | "weight_measurement"
        | "injection"
      user_role:
        | "farmer_owner"
        | "farmhand"
        | "merchant"
        | "vet"
        | "admin"
        | "distributor"
        | "government"
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
      feedback_category: [
        "policy_concern",
        "market_access",
        "veterinary_support",
        "training_request",
        "infrastructure",
        "financial_assistance",
        "emergency_support",
        "disease_outbreak",
        "feed_shortage",
      ],
      feedback_priority: ["critical", "high", "medium", "low"],
      feedback_sentiment: ["urgent", "negative", "neutral", "positive"],
      feedback_status: [
        "submitted",
        "acknowledged",
        "under_review",
        "action_taken",
        "resolved",
        "closed",
      ],
      message_party: ["farmer", "merchant", "vet", "admin"],
      notification_type: [
        "order_update",
        "vet_update",
        "message",
        "system",
        "order_received",
        "activity_approved",
        "activity_rejected",
      ],
      order_status: [
        "received",
        "in_process",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      pending_activity_status: [
        "pending",
        "approved",
        "rejected",
        "auto_approved",
      ],
      pending_activity_type: [
        "milking",
        "feeding",
        "health_observation",
        "weight_measurement",
        "injection",
      ],
      user_role: [
        "farmer_owner",
        "farmhand",
        "merchant",
        "vet",
        "admin",
        "distributor",
        "government",
      ],
    },
  },
} as const
