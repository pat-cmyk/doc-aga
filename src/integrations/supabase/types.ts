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
      admin_animal_edits: {
        Row: {
          action_type: string
          admin_id: string
          animal_id: string
          changes_made: Json
          created_at: string
          farm_id: string
          id: string
          previous_values: Json | null
          reason: string
          ticket_number: string | null
        }
        Insert: {
          action_type: string
          admin_id: string
          animal_id: string
          changes_made?: Json
          created_at?: string
          farm_id: string
          id?: string
          previous_values?: Json | null
          reason: string
          ticket_number?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          animal_id?: string
          changes_made?: Json
          created_at?: string
          farm_id?: string
          id?: string
          previous_values?: Json | null
          reason?: string
          ticket_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_animal_edits_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_animal_edits_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_animal_edits_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_farm_edits: {
        Row: {
          admin_id: string
          changes_made: Json
          created_at: string
          farm_id: string
          id: string
          previous_values: Json
          reason: string
          ticket_number: string | null
        }
        Insert: {
          admin_id: string
          changes_made?: Json
          created_at?: string
          farm_id: string
          id?: string
          previous_values?: Json
          reason: string
          ticket_number?: string | null
        }
        Update: {
          admin_id?: string
          changes_made?: Json
          created_at?: string
          farm_id?: string
          id?: string
          previous_values?: Json
          reason?: string
          ticket_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_farm_edits_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_farm_edits_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_profile_edits: {
        Row: {
          admin_id: string
          changes_made: Json
          created_at: string
          id: string
          previous_values: Json | null
          profile_id: string
          reason: string
          ticket_number: string | null
        }
        Insert: {
          admin_id: string
          changes_made?: Json
          created_at?: string
          id?: string
          previous_values?: Json | null
          profile_id: string
          reason: string
          ticket_number?: string | null
        }
        Update: {
          admin_id?: string
          changes_made?: Json
          created_at?: string
          id?: string
          previous_values?: Json | null
          profile_id?: string
          reason?: string
          ticket_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_profile_edits_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_records: {
        Row: {
          animal_id: string
          client_generated_id: string | null
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
          client_generated_id?: string | null
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
          client_generated_id?: string | null
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
      animal_ovr_cache: {
        Row: {
          animal_id: string
          breakdown: Json | null
          computed_at: string
          is_stale: boolean | null
          score: number
          tier: string
          trend: string
          updated_at: string
        }
        Insert: {
          animal_id: string
          breakdown?: Json | null
          computed_at?: string
          is_stale?: boolean | null
          score?: number
          tier?: string
          trend?: string
          updated_at?: string
        }
        Update: {
          animal_id?: string
          breakdown?: Json | null
          computed_at?: string
          is_stale?: boolean | null
          score?: number
          tier?: string
          trend?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_ovr_cache_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: true
            referencedRelation: "animals"
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
          acquisition_type: string | null
          avatar_url: string | null
          birth_date: string | null
          birth_date_unknown: boolean | null
          birth_weight_kg: number | null
          breed: string | null
          buyer_info: string | null
          client_generated_id: string | null
          created_at: string
          current_barn_id: string | null
          current_weight_kg: number | null
          ear_tag: string | null
          entry_weight_kg: number | null
          entry_weight_unknown: boolean | null
          estimated_days_in_milk: number | null
          exit_date: string | null
          exit_notes: string | null
          exit_reason: string | null
          exit_reason_details: string | null
          farm_entry_date: string | null
          farm_id: string
          father_id: string | null
          father_unknown: boolean | null
          fertility_status:
            | Database["public"]["Enums"]["fertility_status"]
            | null
          gender: string | null
          grant_source: string | null
          grant_source_other: string | null
          id: string
          is_currently_lactating: boolean | null
          is_deleted: boolean
          last_ai_date: string | null
          last_calving_date: string | null
          last_heat_date: string | null
          life_stage: string | null
          livestock_type: string
          milking_stage: string | null
          milking_start_date: string | null
          mother_id: string | null
          mother_unknown: boolean | null
          name: string | null
          parity: number | null
          purchase_price: number | null
          sale_price: number | null
          services_this_cycle: number | null
          source_farm: string | null
          unique_code: string
          updated_at: string
          voluntary_waiting_end_date: string | null
        }
        Insert: {
          acquisition_type?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          birth_date_unknown?: boolean | null
          birth_weight_kg?: number | null
          breed?: string | null
          buyer_info?: string | null
          client_generated_id?: string | null
          created_at?: string
          current_barn_id?: string | null
          current_weight_kg?: number | null
          ear_tag?: string | null
          entry_weight_kg?: number | null
          entry_weight_unknown?: boolean | null
          estimated_days_in_milk?: number | null
          exit_date?: string | null
          exit_notes?: string | null
          exit_reason?: string | null
          exit_reason_details?: string | null
          farm_entry_date?: string | null
          farm_id: string
          father_id?: string | null
          father_unknown?: boolean | null
          fertility_status?:
            | Database["public"]["Enums"]["fertility_status"]
            | null
          gender?: string | null
          grant_source?: string | null
          grant_source_other?: string | null
          id?: string
          is_currently_lactating?: boolean | null
          is_deleted?: boolean
          last_ai_date?: string | null
          last_calving_date?: string | null
          last_heat_date?: string | null
          life_stage?: string | null
          livestock_type?: string
          milking_stage?: string | null
          milking_start_date?: string | null
          mother_id?: string | null
          mother_unknown?: boolean | null
          name?: string | null
          parity?: number | null
          purchase_price?: number | null
          sale_price?: number | null
          services_this_cycle?: number | null
          source_farm?: string | null
          unique_code: string
          updated_at?: string
          voluntary_waiting_end_date?: string | null
        }
        Update: {
          acquisition_type?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          birth_date_unknown?: boolean | null
          birth_weight_kg?: number | null
          breed?: string | null
          buyer_info?: string | null
          client_generated_id?: string | null
          created_at?: string
          current_barn_id?: string | null
          current_weight_kg?: number | null
          ear_tag?: string | null
          entry_weight_kg?: number | null
          entry_weight_unknown?: boolean | null
          estimated_days_in_milk?: number | null
          exit_date?: string | null
          exit_notes?: string | null
          exit_reason?: string | null
          exit_reason_details?: string | null
          farm_entry_date?: string | null
          farm_id?: string
          father_id?: string | null
          father_unknown?: boolean | null
          fertility_status?:
            | Database["public"]["Enums"]["fertility_status"]
            | null
          gender?: string | null
          grant_source?: string | null
          grant_source_other?: string | null
          id?: string
          is_currently_lactating?: boolean | null
          is_deleted?: boolean
          last_ai_date?: string | null
          last_calving_date?: string | null
          last_heat_date?: string | null
          life_stage?: string | null
          livestock_type?: string
          milking_stage?: string | null
          milking_start_date?: string | null
          mother_id?: string | null
          mother_unknown?: boolean | null
          name?: string | null
          parity?: number | null
          purchase_price?: number | null
          sale_price?: number | null
          services_this_cycle?: number | null
          source_farm?: string | null
          unique_code?: string
          updated_at?: string
          voluntary_waiting_end_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "animals_current_barn_id_fkey"
            columns: ["current_barn_id"]
            isOneToOne: false
            referencedRelation: "barns"
            referencedColumns: ["id"]
          },
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
      barn_assignments: {
        Row: {
          animal_id: string
          assigned_at: string
          assigned_by: string | null
          barn_id: string
          farm_id: string
          id: string
          removed_at: string | null
        }
        Insert: {
          animal_id: string
          assigned_at?: string
          assigned_by?: string | null
          barn_id: string
          farm_id: string
          id?: string
          removed_at?: string | null
        }
        Update: {
          animal_id?: string
          assigned_at?: string
          assigned_by?: string | null
          barn_id?: string
          farm_id?: string
          id?: string
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barn_assignments_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barn_assignments_barn_id_fkey"
            columns: ["barn_id"]
            isOneToOne: false
            referencedRelation: "barns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barn_assignments_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barn_assignments_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      barns: {
        Row: {
          barn_type: string
          capacity: number | null
          created_at: string
          created_by: string | null
          description: string | null
          farm_id: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          barn_type?: string
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          farm_id: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          barn_type?: string
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          farm_id?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "barns_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barns_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
          client_generated_id: string | null
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
          client_generated_id?: string | null
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
          client_generated_id?: string | null
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
      breeding_events: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          event_date: string
          event_type: string
          farm_id: string
          id: string
          metadata: Json | null
          notes: string | null
          related_ai_record_id: string | null
          related_heat_record_id: string | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_type: string
          farm_id: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          related_ai_record_id?: string | null
          related_heat_record_id?: string | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_type?: string
          farm_id?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          related_ai_record_id?: string | null
          related_heat_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "breeding_events_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeding_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeding_events_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeding_events_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeding_events_related_ai_record_id_fkey"
            columns: ["related_ai_record_id"]
            isOneToOne: false
            referencedRelation: "ai_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeding_events_related_heat_record_id_fkey"
            columns: ["related_heat_record_id"]
            isOneToOne: false
            referencedRelation: "heat_records"
            referencedColumns: ["id"]
          },
        ]
      }
      coop_feed_disbursements: {
        Row: {
          category: string
          coop_feed_inventory_id: string
          cooperative_id: string
          cost_per_kg: number
          created_at: string
          disbursed_by: string
          disbursement_date: string
          entry_type: string
          farm_feed_inventory_id: string | null
          farm_id: string
          feed_type: string
          id: string
          notes: string | null
          original_disbursement_id: string | null
          quantity_kg: number
          reversal_reason: string | null
          status: string
          total_cost: number | null
        }
        Insert: {
          category: string
          coop_feed_inventory_id: string
          cooperative_id: string
          cost_per_kg: number
          created_at?: string
          disbursed_by: string
          disbursement_date: string
          entry_type?: string
          farm_feed_inventory_id?: string | null
          farm_id: string
          feed_type: string
          id?: string
          notes?: string | null
          original_disbursement_id?: string | null
          quantity_kg: number
          reversal_reason?: string | null
          status?: string
          total_cost?: number | null
        }
        Update: {
          category?: string
          coop_feed_inventory_id?: string
          cooperative_id?: string
          cost_per_kg?: number
          created_at?: string
          disbursed_by?: string
          disbursement_date?: string
          entry_type?: string
          farm_feed_inventory_id?: string | null
          farm_id?: string
          feed_type?: string
          id?: string
          notes?: string | null
          original_disbursement_id?: string | null
          quantity_kg?: number
          reversal_reason?: string | null
          status?: string
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coop_feed_disbursements_coop_feed_inventory_id_fkey"
            columns: ["coop_feed_inventory_id"]
            isOneToOne: false
            referencedRelation: "coop_feed_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_feed_disbursements_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_feed_disbursements_farm_feed_inventory_id_fkey"
            columns: ["farm_feed_inventory_id"]
            isOneToOne: false
            referencedRelation: "feed_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_feed_disbursements_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_feed_disbursements_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_feed_disbursements_original_disbursement_id_fkey"
            columns: ["original_disbursement_id"]
            isOneToOne: false
            referencedRelation: "coop_feed_disbursements"
            referencedColumns: ["id"]
          },
        ]
      }
      coop_feed_inventory: {
        Row: {
          batch_number: string | null
          category: string
          cooperative_id: string
          cost_per_kg: number
          created_at: string
          created_by: string | null
          expiry_date: string | null
          feed_type: string
          id: string
          last_updated: string
          notes: string | null
          purchase_date: string | null
          quantity_kg: number
          supplier: string | null
        }
        Insert: {
          batch_number?: string | null
          category?: string
          cooperative_id: string
          cost_per_kg: number
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          feed_type: string
          id?: string
          last_updated?: string
          notes?: string | null
          purchase_date?: string | null
          quantity_kg: number
          supplier?: string | null
        }
        Update: {
          batch_number?: string | null
          category?: string
          cooperative_id?: string
          cost_per_kg?: number
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          feed_type?: string
          id?: string
          last_updated?: string
          notes?: string | null
          purchase_date?: string | null
          quantity_kg?: number
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coop_feed_inventory_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      coop_milk_price_schedule: {
        Row: {
          cooperative_id: string
          created_at: string
          created_by: string
          effective_date: string
          id: string
          notes: string | null
          price_per_liter: number
          species: string
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          created_by: string
          effective_date: string
          id?: string
          notes?: string | null
          price_per_liter: number
          species: string
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          created_by?: string
          effective_date?: string
          id?: string
          notes?: string | null
          price_per_liter?: number
          species?: string
        }
        Relationships: [
          {
            foreignKeyName: "coop_milk_price_schedule_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      coop_milk_receivings: {
        Row: {
          cooperative_id: string
          created_at: string
          entry_type: string
          farm_id: string
          farm_milk_deductions: Json | null
          id: string
          milk_quality: string
          notes: string | null
          original_receiving_id: string | null
          price_per_liter: number
          received_by: string
          receiving_date: string
          reversal_reason: string | null
          session: string
          species: string
          status: string
          total_value: number | null
          volume_liters: number
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          entry_type?: string
          farm_id: string
          farm_milk_deductions?: Json | null
          id?: string
          milk_quality?: string
          notes?: string | null
          original_receiving_id?: string | null
          price_per_liter: number
          received_by: string
          receiving_date: string
          reversal_reason?: string | null
          session: string
          species: string
          status?: string
          total_value?: number | null
          volume_liters: number
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          entry_type?: string
          farm_id?: string
          farm_milk_deductions?: Json | null
          id?: string
          milk_quality?: string
          notes?: string | null
          original_receiving_id?: string | null
          price_per_liter?: number
          received_by?: string
          receiving_date?: string
          reversal_reason?: string | null
          session?: string
          species?: string
          status?: string
          total_value?: number | null
          volume_liters?: number
        }
        Relationships: [
          {
            foreignKeyName: "coop_milk_receivings_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_milk_receivings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_milk_receivings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_milk_receivings_original_receiving_id_fkey"
            columns: ["original_receiving_id"]
            isOneToOne: false
            referencedRelation: "coop_milk_receivings"
            referencedColumns: ["id"]
          },
        ]
      }
      coop_soa_periods: {
        Row: {
          cooperative_id: string
          created_at: string
          created_by: string | null
          farm_id: string
          finalized_at: string | null
          id: string
          net_balance: number
          notes: string | null
          period_end: string
          period_start: string
          previous_soa_id: string | null
          revision_number: number
          settled_at: string | null
          status: string
          total_feed_cost: number
          total_feed_kg: number
          total_milk_liters: number
          total_milk_value: number
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          farm_id: string
          finalized_at?: string | null
          id?: string
          net_balance?: number
          notes?: string | null
          period_end: string
          period_start: string
          previous_soa_id?: string | null
          revision_number?: number
          settled_at?: string | null
          status?: string
          total_feed_cost?: number
          total_feed_kg?: number
          total_milk_liters?: number
          total_milk_value?: number
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          farm_id?: string
          finalized_at?: string | null
          id?: string
          net_balance?: number
          notes?: string | null
          period_end?: string
          period_start?: string
          previous_soa_id?: string | null
          revision_number?: number
          settled_at?: string | null
          status?: string
          total_feed_cost?: number
          total_feed_kg?: number
          total_milk_liters?: number
          total_milk_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coop_soa_periods_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_soa_periods_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_soa_periods_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_soa_periods_previous_soa_id_fkey"
            columns: ["previous_soa_id"]
            isOneToOne: false
            referencedRelation: "coop_soa_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperative_memberships: {
        Row: {
          accepted_at: string | null
          accepted_ip: unknown
          cooperative_id: string
          created_at: string
          farm_id: string
          id: string
          invitation_status: string
          invitation_token: string
          invited_at: string
          invited_email: string
          last_resend_at: string | null
          token_expires_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_ip?: unknown
          cooperative_id: string
          created_at?: string
          farm_id: string
          id?: string
          invitation_status?: string
          invitation_token?: string
          invited_at?: string
          invited_email: string
          last_resend_at?: string | null
          token_expires_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_ip?: unknown
          cooperative_id?: string
          created_at?: string
          farm_id?: string
          id?: string
          invitation_status?: string
          invitation_token?: string
          invited_at?: string
          invited_email?: string
          last_resend_at?: string | null
          token_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cooperative_memberships_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cooperative_memberships_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cooperative_memberships_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperatives: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          logo_url: string | null
          municipality: string | null
          name: string
          region: string | null
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          logo_url?: string | null
          municipality?: string | null
          name: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          municipality?: string | null
          name?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
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
      daily_farm_checklists: {
        Row: {
          checklist_date: string
          completed_by: string | null
          completed_items: Json
          created_at: string
          farm_id: string
          id: string
          updated_at: string
        }
        Insert: {
          checklist_date: string
          completed_by?: string | null
          completed_items?: Json
          created_at?: string
          farm_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          checklist_date?: string
          completed_by?: string | null
          completed_items?: Json
          created_at?: string
          farm_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_farm_checklists_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_farm_checklists_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_farm_stats: {
        Row: {
          created_at: string
          farm_id: string
          feed_animal_count: number
          id: string
          stage_counts: Json
          stat_date: string
          total_feed_kg: number
          total_milk_liters: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          feed_animal_count?: number
          id?: string
          stage_counts?: Json
          stat_date: string
          total_feed_kg?: number
          total_milk_liters?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          feed_animal_count?: number
          id?: string
          stage_counts?: Json
          stat_date?: string
          total_feed_kg?: number
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
          conversation_id: string | null
          created_at: string
          farm_id: string | null
          feedback_at: string | null
          feedback_comment: string | null
          feedback_rating: string | null
          id: string
          image_url: string | null
          matched_faq_id: string | null
          message_index: number | null
          question: string
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          conversation_id?: string | null
          created_at?: string
          farm_id?: string | null
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_rating?: string | null
          id?: string
          image_url?: string | null
          matched_faq_id?: string | null
          message_index?: number | null
          question: string
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          conversation_id?: string | null
          created_at?: string
          farm_id?: string | null
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_rating?: string | null
          id?: string
          image_url?: string | null
          matched_faq_id?: string | null
          message_index?: number | null
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      faq_candidates: {
        Row: {
          converted_faq_id: string | null
          created_at: string | null
          id: string
          normalized_text: string
          occurrence_count: number | null
          question_pattern: string
          reviewed_at: string | null
          reviewed_by: string | null
          sample_query_ids: string[] | null
          status: string | null
          suggested_answer: string | null
          suggested_category: string | null
          updated_at: string | null
        }
        Insert: {
          converted_faq_id?: string | null
          created_at?: string | null
          id?: string
          normalized_text: string
          occurrence_count?: number | null
          question_pattern: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_query_ids?: string[] | null
          status?: string | null
          suggested_answer?: string | null
          suggested_category?: string | null
          updated_at?: string | null
        }
        Update: {
          converted_faq_id?: string | null
          created_at?: string | null
          id?: string
          normalized_text?: string
          occurrence_count?: number | null
          question_pattern?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_query_ids?: string[] | null
          status?: string | null
          suggested_answer?: string | null
          suggested_category?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faq_candidates_converted_faq_id_fkey"
            columns: ["converted_faq_id"]
            isOneToOne: false
            referencedRelation: "doc_aga_faqs"
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
          animal_id: string | null
          category: string
          client_generated_id: string | null
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
          animal_id?: string | null
          category: string
          client_generated_id?: string | null
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
          animal_id?: string | null
          category?: string
          client_generated_id?: string | null
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
            foreignKeyName: "farm_expenses_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
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
          accepted_ip: unknown
          created_at: string
          farm_id: string
          id: string
          invitation_status: string | null
          invitation_token: string | null
          invited_at: string | null
          invited_by: string | null
          invited_email: string | null
          last_resend_at: string | null
          role_in_farm: Database["public"]["Enums"]["user_role"]
          token_expires_at: string | null
          user_id: string | null
        }
        Insert: {
          accepted_ip?: unknown
          created_at?: string
          farm_id: string
          id?: string
          invitation_status?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          last_resend_at?: string | null
          role_in_farm: Database["public"]["Enums"]["user_role"]
          token_expires_at?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_ip?: unknown
          created_at?: string
          farm_id?: string
          id?: string
          invitation_status?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          last_resend_at?: string | null
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
      farm_sync_checkpoints: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          last_record_timestamp: string | null
          last_sync_at: string
          records_synced: number
          table_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          last_record_timestamp?: string | null
          last_sync_at?: string
          records_synced?: number
          table_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          last_record_timestamp?: string | null
          last_sync_at?: string
          records_synced?: number
          table_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_sync_checkpoints_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_sync_checkpoints_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
          biosecurity_level: string | null
          client_generated_id: string | null
          created_at: string
          data_category: string
          distance_to_market_km: number | null
          ffedis_id: string | null
          gps_lat: number
          gps_lng: number
          id: string
          is_deleted: boolean
          is_program_participant: boolean | null
          lgu_code: string | null
          livestock_type: string
          logo_url: string | null
          max_backdate_days: number | null
          municipality: string | null
          name: string
          owner_id: string
          pcic_enrolled: boolean | null
          program_group: string | null
          province: string | null
          region: string | null
          updated_at: string
          validated_at: string | null
          validation_status: string | null
          water_source: string | null
        }
        Insert: {
          biosecurity_level?: string | null
          client_generated_id?: string | null
          created_at?: string
          data_category?: string
          distance_to_market_km?: number | null
          ffedis_id?: string | null
          gps_lat: number
          gps_lng: number
          id?: string
          is_deleted?: boolean
          is_program_participant?: boolean | null
          lgu_code?: string | null
          livestock_type?: string
          logo_url?: string | null
          max_backdate_days?: number | null
          municipality?: string | null
          name: string
          owner_id: string
          pcic_enrolled?: boolean | null
          program_group?: string | null
          province?: string | null
          region?: string | null
          updated_at?: string
          validated_at?: string | null
          validation_status?: string | null
          water_source?: string | null
        }
        Update: {
          biosecurity_level?: string | null
          client_generated_id?: string | null
          created_at?: string
          data_category?: string
          distance_to_market_km?: number | null
          ffedis_id?: string | null
          gps_lat?: number
          gps_lng?: number
          id?: string
          is_deleted?: boolean
          is_program_participant?: boolean | null
          lgu_code?: string | null
          livestock_type?: string
          logo_url?: string | null
          max_backdate_days?: number | null
          municipality?: string | null
          name?: string
          owner_id?: string
          pcic_enrolled?: boolean | null
          program_group?: string | null
          province?: string | null
          region?: string | null
          updated_at?: string
          validated_at?: string | null
          validation_status?: string | null
          water_source?: string | null
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
          batch_number: string | null
          category: string | null
          cost_per_unit: number | null
          created_at: string
          created_by: string | null
          expiry_date: string | null
          farm_id: string
          feed_type: string
          id: string
          last_updated: string
          notes: string | null
          purchase_date: string | null
          quantity_kg: number
          reorder_threshold: number | null
          supplier: string | null
          unit: string
          weight_per_unit: number | null
        }
        Insert: {
          batch_number?: string | null
          category?: string | null
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          farm_id: string
          feed_type: string
          id?: string
          last_updated?: string
          notes?: string | null
          purchase_date?: string | null
          quantity_kg?: number
          reorder_threshold?: number | null
          supplier?: string | null
          unit?: string
          weight_per_unit?: number | null
        }
        Update: {
          batch_number?: string | null
          category?: string | null
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          farm_id?: string
          feed_type?: string
          id?: string
          last_updated?: string
          notes?: string | null
          purchase_date?: string | null
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
          client_generated_id: string | null
          cost_per_kg_at_time: number | null
          created_at: string
          created_by: string | null
          feed_inventory_id: string | null
          feed_type: string | null
          id: string
          input_method: string
          kilograms: number | null
          milk_inventory_id: string | null
          notes: string | null
          record_datetime: string
          stt_session_id: string | null
        }
        Insert: {
          animal_id: string
          client_generated_id?: string | null
          cost_per_kg_at_time?: number | null
          created_at?: string
          created_by?: string | null
          feed_inventory_id?: string | null
          feed_type?: string | null
          id?: string
          input_method?: string
          kilograms?: number | null
          milk_inventory_id?: string | null
          notes?: string | null
          record_datetime: string
          stt_session_id?: string | null
        }
        Update: {
          animal_id?: string
          client_generated_id?: string | null
          cost_per_kg_at_time?: number | null
          created_at?: string
          created_by?: string | null
          feed_inventory_id?: string | null
          feed_type?: string | null
          id?: string
          input_method?: string
          kilograms?: number | null
          milk_inventory_id?: string | null
          notes?: string | null
          record_datetime?: string
          stt_session_id?: string | null
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
          {
            foreignKeyName: "feeding_records_feed_inventory_id_fkey"
            columns: ["feed_inventory_id"]
            isOneToOne: false
            referencedRelation: "feed_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_records_milk_inventory_id_fkey"
            columns: ["milk_inventory_id"]
            isOneToOne: false
            referencedRelation: "milk_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_records_stt_session_id_fkey"
            columns: ["stt_session_id"]
            isOneToOne: false
            referencedRelation: "voice_session_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      gov_analytics_access_audit_log: {
        Row: {
          access_type: string
          accessed_at: string
          id: string
          metadata: Json | null
          records_accessed: number
          regions_accessed: string[] | null
          user_id: string
          user_role: string | null
        }
        Insert: {
          access_type?: string
          accessed_at?: string
          id?: string
          metadata?: Json | null
          records_accessed?: number
          regions_accessed?: string[] | null
          user_id: string
          user_role?: string | null
        }
        Update: {
          access_type?: string
          accessed_at?: string
          id?: string
          metadata?: Json | null
          records_accessed?: number
          regions_accessed?: string[] | null
          user_id?: string
          user_role?: string | null
        }
        Relationships: []
      }
      health_records: {
        Row: {
          animal_id: string
          client_generated_id: string | null
          created_at: string
          created_by: string | null
          diagnosis: string | null
          id: string
          input_method: string
          notes: string | null
          resolution_notes: string | null
          stt_session_id: string | null
          treatment: string | null
          visit_date: string
        }
        Insert: {
          animal_id: string
          client_generated_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          id?: string
          input_method?: string
          notes?: string | null
          resolution_notes?: string | null
          stt_session_id?: string | null
          treatment?: string | null
          visit_date: string
        }
        Update: {
          animal_id?: string
          client_generated_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          id?: string
          input_method?: string
          notes?: string | null
          resolution_notes?: string | null
          stt_session_id?: string | null
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
          {
            foreignKeyName: "health_records_stt_session_id_fkey"
            columns: ["stt_session_id"]
            isOneToOne: false
            referencedRelation: "voice_session_attempts"
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
      heat_observation_checks: {
        Row: {
          animal_id: string
          checked_at: string
          checked_by: string | null
          created_at: string
          farm_id: string
          id: string
          notes: string | null
        }
        Insert: {
          animal_id: string
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          farm_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          animal_id?: string
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          farm_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "heat_observation_checks_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heat_observation_checks_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heat_observation_checks_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      heat_records: {
        Row: {
          animal_id: string
          client_generated_id: string | null
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
          client_generated_id?: string | null
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
          client_generated_id?: string | null
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
          input_method: string
          instructions: string | null
          medicine_name: string | null
          photo_path: string | null
          record_datetime: string
          stt_session_id: string | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          dosage?: string | null
          id?: string
          input_method?: string
          instructions?: string | null
          medicine_name?: string | null
          photo_path?: string | null
          record_datetime: string
          stt_session_id?: string | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          dosage?: string | null
          id?: string
          input_method?: string
          instructions?: string | null
          medicine_name?: string | null
          photo_path?: string | null
          record_datetime?: string
          stt_session_id?: string | null
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
          {
            foreignKeyName: "injection_records_stt_session_id_fkey"
            columns: ["stt_session_id"]
            isOneToOne: false
            referencedRelation: "voice_session_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_fix_log: {
        Row: {
          admin_id: string
          created_at: string | null
          details: Json | null
          farm_id: string | null
          fix_type: string
          id: string
          items_fixed: number | null
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          details?: Json | null
          farm_id?: string | null
          fix_type: string
          id?: string
          items_fixed?: number | null
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          farm_id?: string | null
          fix_type?: string
          id?: string
          items_fixed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "integrity_fix_log_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrity_fix_log_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
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
      milk_inventory: {
        Row: {
          animal_id: string
          client_generated_id: string | null
          created_at: string | null
          farm_id: string
          id: string
          is_available: boolean
          liters_original: number
          liters_remaining: number
          milk_quality: string
          milk_quality_rejection_reason: string | null
          milking_record_id: string
          record_date: string
          updated_at: string | null
        }
        Insert: {
          animal_id: string
          client_generated_id?: string | null
          created_at?: string | null
          farm_id: string
          id?: string
          is_available?: boolean
          liters_original: number
          liters_remaining: number
          milk_quality?: string
          milk_quality_rejection_reason?: string | null
          milking_record_id: string
          record_date: string
          updated_at?: string | null
        }
        Update: {
          animal_id?: string
          client_generated_id?: string | null
          created_at?: string | null
          farm_id?: string
          id?: string
          is_available?: boolean
          liters_original?: number
          liters_remaining?: number
          milk_quality?: string
          milk_quality_rejection_reason?: string | null
          milking_record_id?: string
          record_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_inventory_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_inventory_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_inventory_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_inventory_milking_record_id_fkey"
            columns: ["milking_record_id"]
            isOneToOne: true
            referencedRelation: "milking_records"
            referencedColumns: ["id"]
          },
        ]
      }
      milking_records: {
        Row: {
          animal_id: string
          client_generated_id: string | null
          created_at: string
          created_by: string | null
          id: string
          input_method: string
          is_sold: boolean | null
          liters: number
          milk_quality: string
          milk_quality_rejection_reason: string | null
          price_per_liter: number | null
          record_date: string
          sale_amount: number | null
          session: string
          stt_session_id: string | null
        }
        Insert: {
          animal_id: string
          client_generated_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          input_method?: string
          is_sold?: boolean | null
          liters?: number
          milk_quality?: string
          milk_quality_rejection_reason?: string | null
          price_per_liter?: number | null
          record_date: string
          sale_amount?: number | null
          session: string
          stt_session_id?: string | null
        }
        Update: {
          animal_id?: string
          client_generated_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          input_method?: string
          is_sold?: boolean | null
          liters?: number
          milk_quality?: string
          milk_quality_rejection_reason?: string | null
          price_per_liter?: number | null
          record_date?: string
          sale_amount?: number | null
          session?: string
          stt_session_id?: string | null
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
          {
            foreignKeyName: "milking_records_stt_session_id_fkey"
            columns: ["stt_session_id"]
            isOneToOne: false
            referencedRelation: "voice_session_attempts"
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
          farm_id: string | null
          id: string
          read: boolean
          title: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          farm_id?: string | null
          id?: string
          read?: boolean
          title?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          farm_id?: string | null
          id?: string
          read?: boolean
          title?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
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
          input_method: string
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
          input_method?: string
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
          input_method?: string
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
      platform_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
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
          is_disabled: boolean | null
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
          is_disabled?: boolean | null
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
          is_disabled?: boolean | null
          phone?: string | null
          updated_at?: string
          voice_training_completed?: boolean | null
          voice_training_skipped?: boolean | null
        }
        Relationships: []
      }
      stats_job_runs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          job_name: string
          result: Json | null
          started_at: string
          success: boolean | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          result?: Json | null
          started_at?: string
          success?: boolean | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          result?: Json | null
          started_at?: string
          success?: boolean | null
        }
        Relationships: []
      }
      stt_analytics: {
        Row: {
          audio_duration_seconds: number | null
          audio_size_bytes: number
          created_at: string | null
          error_message: string | null
          farm_id: string | null
          id: string
          latency_ms: number
          model_provider: string
          model_version: string
          status: string
          transcription_length: number | null
          user_id: string | null
        }
        Insert: {
          audio_duration_seconds?: number | null
          audio_size_bytes: number
          created_at?: string | null
          error_message?: string | null
          farm_id?: string | null
          id?: string
          latency_ms: number
          model_provider?: string
          model_version?: string
          status?: string
          transcription_length?: number | null
          user_id?: string | null
        }
        Update: {
          audio_duration_seconds?: number | null
          audio_size_bytes?: number
          created_at?: string | null
          error_message?: string | null
          farm_id?: string | null
          id?: string
          latency_ms?: number
          model_provider?: string
          model_version?: string
          status?: string
          transcription_length?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stt_analytics_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stt_analytics_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          linked_animal_id: string | null
          linked_farm_id: string | null
          linked_user_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tags: string[] | null
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          linked_animal_id?: string | null
          linked_farm_id?: string | null
          linked_user_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tags?: string[] | null
          ticket_number: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          linked_animal_id?: string | null
          linked_farm_id?: string | null
          linked_user_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          tags?: string[] | null
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_linked_animal_id_fkey"
            columns: ["linked_animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_linked_farm_id_fkey"
            columns: ["linked_farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_linked_farm_id_fkey"
            columns: ["linked_farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      sync_conflicts: {
        Row: {
          client_data: Json
          created_at: string
          farm_id: string
          id: string
          record_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_data: Json | null
          server_data: Json
          table_name: string
          user_id: string
        }
        Insert: {
          client_data: Json
          created_at?: string
          farm_id: string
          id?: string
          record_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_data?: Json | null
          server_data: Json
          table_name: string
          user_id: string
        }
        Update: {
          client_data?: Json
          created_at?: string
          farm_id?: string
          id?: string
          record_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_data?: Json | null
          server_data?: Json
          table_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_conflicts_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_conflicts_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_queue: {
        Row: {
          client_generated_id: string | null
          client_timestamp: string | null
          created_at: string
          error_message: string | null
          farm_id: string
          id: string
          operation_type: string
          payload: Json
          processed_at: string | null
          record_id: string | null
          retry_count: number
          sync_status: Database["public"]["Enums"]["sync_status"]
          table_name: string
          user_id: string
        }
        Insert: {
          client_generated_id?: string | null
          client_timestamp?: string | null
          created_at?: string
          error_message?: string | null
          farm_id: string
          id?: string
          operation_type: string
          payload: Json
          processed_at?: string | null
          record_id?: string | null
          retry_count?: number
          sync_status?: Database["public"]["Enums"]["sync_status"]
          table_name: string
          user_id: string
        }
        Update: {
          client_generated_id?: string | null
          client_timestamp?: string | null
          created_at?: string
          error_message?: string | null
          farm_id?: string
          id?: string
          operation_type?: string
          payload?: Json
          processed_at?: string | null
          record_id?: string | null
          retry_count?: number
          sync_status?: Database["public"]["Enums"]["sync_status"]
          table_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_queue_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_queue_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
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
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
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
      user_invitations: {
        Row: {
          accepted_at: string | null
          accepted_ip: unknown
          accepted_user_id: string | null
          email: string
          id: string
          invitation_status: string
          invitation_token: string
          invited_at: string
          invited_by: string | null
          last_resend_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          token_expires_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_ip?: unknown
          accepted_user_id?: string | null
          email: string
          id?: string
          invitation_status?: string
          invitation_token?: string
          invited_at?: string
          invited_by?: string | null
          last_resend_at?: string | null
          role: Database["public"]["Enums"]["user_role"]
          token_expires_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_ip?: unknown
          accepted_user_id?: string | null
          email?: string
          id?: string
          invitation_status?: string
          invitation_token?: string
          invited_at?: string
          invited_by?: string | null
          last_resend_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          token_expires_at?: string
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
      voice_session_attempts: {
        Row: {
          cancel_reason: string | null
          created_at: string
          ended_at: string | null
          farm_id: string | null
          final_record_id: string | null
          final_record_table: string | null
          followed_by_manual_record_id: string | null
          followed_by_manual_within_5m: boolean
          id: string
          model_provider: string | null
          model_version: string | null
          outcome: string | null
          parsed_fields: Json | null
          preview_shown_at: string | null
          record_type: string
          started_at: string
          transcript_preview: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_reason?: string | null
          created_at?: string
          ended_at?: string | null
          farm_id?: string | null
          final_record_id?: string | null
          final_record_table?: string | null
          followed_by_manual_record_id?: string | null
          followed_by_manual_within_5m?: boolean
          id?: string
          model_provider?: string | null
          model_version?: string | null
          outcome?: string | null
          parsed_fields?: Json | null
          preview_shown_at?: string | null
          record_type: string
          started_at?: string
          transcript_preview?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_reason?: string | null
          created_at?: string
          ended_at?: string | null
          farm_id?: string | null
          final_record_id?: string | null
          final_record_table?: string | null
          followed_by_manual_record_id?: string | null
          followed_by_manual_within_5m?: boolean
          id?: string
          model_provider?: string | null
          model_version?: string | null
          outcome?: string | null
          parsed_fields?: Json | null
          preview_shown_at?: string | null
          record_type?: string
          started_at?: string
          transcript_preview?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_session_attempts_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_session_attempts_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "gov_farm_analytics"
            referencedColumns: ["id"]
          },
        ]
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
          client_generated_id: string | null
          created_at: string
          id: string
          input_method: string
          measurement_date: string
          measurement_method: string | null
          notes: string | null
          recorded_by: string | null
          stt_session_id: string | null
          weight_kg: number
        }
        Insert: {
          animal_id: string
          client_generated_id?: string | null
          created_at?: string
          id?: string
          input_method?: string
          measurement_date: string
          measurement_method?: string | null
          notes?: string | null
          recorded_by?: string | null
          stt_session_id?: string | null
          weight_kg: number
        }
        Update: {
          animal_id?: string
          client_generated_id?: string | null
          created_at?: string
          id?: string
          input_method?: string
          measurement_date?: string
          measurement_method?: string | null
          notes?: string | null
          recorded_by?: string | null
          stt_session_id?: string | null
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
          {
            foreignKeyName: "weight_records_stt_session_id_fkey"
            columns: ["stt_session_id"]
            isOneToOne: false
            referencedRelation: "voice_session_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      gov_farm_analytics: {
        Row: {
          active_animal_count: number | null
          carabao_count: number | null
          cattle_count: number | null
          created_at: string | null
          data_category: string | null
          goat_count: number | null
          gps_lat: number | null
          gps_lng: number | null
          id: string | null
          is_deleted: boolean | null
          is_program_participant: boolean | null
          livestock_type: string | null
          municipality: string | null
          name: string | null
          program_group: string | null
          province: string | null
          region: string | null
          sheep_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_cooperative_invitation: {
        Args: { _token: string }
        Returns: string
      }
      accept_farm_invitation: {
        Args: { p_token: string }
        Returns: {
          error_code: string
          farm_id: string
          farm_name: string
          success: boolean
        }[]
      }
      accept_user_invitation: { Args: { _token: string }; Returns: Json }
      add_coop_feed_stock: {
        Args: {
          _batch_number?: string
          _category: string
          _cooperative_id: string
          _cost_per_kg: number
          _expiry_date?: string
          _feed_type: string
          _notes?: string
          _purchase_date?: string
          _quantity_kg: number
          _supplier?: string
        }
        Returns: string
      }
      admin_add_animal: {
        Args: {
          _animal_data: Json
          _farm_id: string
          _reason: string
          _ticket_number?: string
        }
        Returns: Json
      }
      admin_assign_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_disable_user: {
        Args: { _profile_id: string; _reason: string }
        Returns: Json
      }
      admin_edit_animal: {
        Args: {
          _animal_id: string
          _changes: Json
          _reason: string
          _ticket_number?: string
        }
        Returns: Json
      }
      admin_edit_farm: {
        Args: {
          _changes: Json
          _farm_id: string
          _reason: string
          _ticket_number?: string
        }
        Returns: Json
      }
      admin_edit_profile: {
        Args: {
          _changes: Json
          _profile_id: string
          _reason: string
          _ticket_number?: string
        }
        Returns: Json
      }
      admin_enable_user: {
        Args: { _profile_id: string; _reason: string }
        Returns: Json
      }
      admin_remove_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_revoke_user_invitation: {
        Args: { _invitation_id: string }
        Returns: undefined
      }
      approve_pending_activity:
        | {
            Args: {
              _approved_by: string
              _is_auto?: boolean
              _pending_id: string
            }
            Returns: Json
          }
        | {
            Args: { p_activity_id: string; p_approver_id: string }
            Returns: Json
          }
      batch_calculate_ovr_scores: {
        Args: { p_farm_id?: string }
        Returns: Json
      }
      calculate_animal_ovr: { Args: { p_animal_id: string }; Returns: Json }
      calculate_auto_approve_time: {
        Args: { _farm_id: string }
        Returns: string
      }
      calculate_daily_farm_stats: {
        Args: { p_target_date?: string }
        Returns: Json
      }
      can_access_farm: { Args: { fid: string }; Returns: boolean }
      check_data_consistency: {
        Args: { p_date?: string; p_farm_id: string }
        Returns: {
          actual_value: number
          check_name: string
          expected_value: number
          is_consistent: boolean
        }[]
      }
      check_stale_sync_items: {
        Args: { p_client_id: string; p_user_id: string }
        Returns: Json
      }
      compute_coop_soa: {
        Args: {
          _cooperative_id: string
          _farm_id: string
          _period_end: string
          _period_start: string
        }
        Returns: Json
      }
      correct_coop_feed_disbursement: {
        Args: {
          _new_quantity_kg: number
          _original_id: string
          _reason?: string
        }
        Returns: string
      }
      correct_coop_milk_receiving: {
        Args: {
          _new_price_per_liter?: number
          _new_volume_liters: number
          _original_id: string
          _reason?: string
        }
        Returns: string
      }
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
      decline_cooperative_invitation: {
        Args: { _token: string }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_sync_conflict: {
        Args: {
          p_client_data: Json
          p_client_timestamp: string
          p_record_id: string
          p_table_name: string
        }
        Returns: Json
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_farm_stats: {
        Args: { p_end_date: string; p_farm_id: string; p_start_date: string }
        Returns: Json
      }
      finalize_coop_soa: {
        Args: {
          _cooperative_id: string
          _farm_id: string
          _notes?: string
          _period_end: string
          _period_start: string
        }
        Returns: string
      }
      fix_animal_weights: { Args: { p_farm_id: string }; Returns: Json }
      fix_missing_milk_revenues: { Args: { p_farm_id: string }; Returns: Json }
      fix_valuation_calculations: { Args: { p_farm_id: string }; Returns: Json }
      generate_animal_code: { Args: { animal_type: string }; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      get_active_coop_price: {
        Args: { _cooperative_id: string; _species: string }
        Returns: number
      }
      get_all_farms_for_integrity_check: {
        Args: never
        Returns: {
          animal_count: number
          farm_id: string
          farm_name: string
          last_activity: string
          owner_email: string
          owner_id: string
          owner_name: string
        }[]
      }
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
      get_coop_feed_disbursements: {
        Args: {
          _cooperative_id: string
          _date_from?: string
          _date_to?: string
        }
        Returns: {
          category: string
          cost_per_kg: number
          created_at: string
          disbursed_by: string
          disbursement_date: string
          entry_type: string
          farm_id: string
          farm_name: string
          feed_type: string
          id: string
          notes: string
          original_disbursement_id: string
          quantity_kg: number
          reversal_reason: string
          status: string
          total_cost: number
        }[]
      }
      get_coop_feed_inventory: {
        Args: { _cooperative_id: string }
        Returns: {
          batch_number: string
          category: string
          cost_per_kg: number
          created_at: string
          expiry_date: string
          feed_type: string
          id: string
          last_updated: string
          notes: string
          purchase_date: string
          quantity_kg: number
          supplier: string
          total_value: number
        }[]
      }
      get_coop_milk_receivings: {
        Args: {
          _cooperative_id: string
          _date_from?: string
          _date_to?: string
        }
        Returns: {
          created_at: string
          entry_type: string
          farm_id: string
          farm_name: string
          id: string
          milk_quality: string
          notes: string
          original_receiving_id: string
          price_per_liter: number
          received_by: string
          receiving_date: string
          reversal_reason: string
          session: string
          species: string
          status: string
          total_value: number
          volume_liters: number
        }[]
      }
      get_coop_price_schedule: {
        Args: { _cooperative_id: string }
        Returns: {
          created_at: string
          created_by: string
          effective_date: string
          id: string
          notes: string
          price_per_liter: number
          species: string
        }[]
      }
      get_cooperative_farm_ids: {
        Args: { _cooperative_id: string }
        Returns: {
          farm_id: string
        }[]
      }
      get_cooperative_financial_summary: {
        Args: { _cooperative_id: string; _days?: number }
        Returns: Json
      }
      get_cooperative_health_overview: {
        Args: { _cooperative_id: string }
        Returns: Json
      }
      get_cooperative_herd_summary: {
        Args: { _cooperative_id: string }
        Returns: Json
      }
      get_cooperative_invitation_public: {
        Args: { _token: string }
        Returns: {
          cooperative_name: string
          farm_name: string
          invitation_status: string
          token_expires_at: string
        }[]
      }
      get_cooperative_member_farms: {
        Args: { _cooperative_id: string }
        Returns: {
          accepted_at: string
          animal_count: number
          farm_id: string
          farm_name: string
          invitation_status: string
          membership_id: string
          municipality: string
          region: string
        }[]
      }
      get_cooperative_milk_production: {
        Args: { _cooperative_id: string; _days?: number }
        Returns: Json
      }
      get_data_entry_analytics: {
        Args: {
          _data_category?: string
          _end_date?: string
          _municipality?: string
          _province?: string
          _region?: string
          _start_date?: string
        }
        Returns: Json
      }
      get_faq_match_timeline: {
        Args: { p_days?: number }
        Returns: {
          match_count: number
          match_date: string
        }[]
      }
      get_faq_usage_stats: {
        Args: never
        Returns: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          last_matched_at: string
          matches_last_30d: number
          matches_last_7d: number
          question: string
          total_matches: number
        }[]
      }
      get_farm_audit_report: {
        Args: { p_end_date: string; p_farm_id: string; p_start_date: string }
        Returns: Json
      }
      get_farm_compliance_metrics:
        | {
            Args: {
              end_date: string
              province_filter?: string
              region_filter?: string
              start_date: string
            }
            Returns: {
              avg_feeding_completion: number
              avg_milking_completion: number
              compliance_rate: number
              farms_with_feeding_logs: number
              farms_with_health_logs: number
              farms_with_milking_logs: number
              high_compliance_farms: number
              low_compliance_farms: number
              province: string
              region: string
              total_farms: number
            }[]
          }
        | {
            Args: {
              data_category_filter?: string
              end_date: string
              province_filter?: string
              region_filter?: string
              start_date: string
            }
            Returns: {
              avg_feeding_completion: number
              avg_milking_completion: number
              compliance_rate: number
              farms_with_feeding_logs: number
              farms_with_health_logs: number
              farms_with_milking_logs: number
              high_compliance_farms: number
              low_compliance_farms: number
              province: string
              region: string
              total_farms: number
            }[]
          }
      get_farm_invitation_public: {
        Args: { p_token: string }
        Returns: {
          farm_id: string
          farm_name: string
          invited_email: string
          inviter_name: string
          role_in_farm: string
          token_expires_at: string
        }[]
      }
      get_gov_farm_analytics: {
        Args: {
          p_municipality?: string
          p_province?: string
          p_region?: string
        }
        Returns: {
          active_animal_count: number
          animal_count: number
          ffedis_id: string
          gps_lat: number
          gps_lng: number
          health_events_30d: number
          health_events_7d: number
          id: string
          is_program_participant: boolean
          lgu_code: string
          municipality: string
          name: string
          owner_id: string
          program_group: string
          province: string
          region: string
          validated_at: string
          validation_status: string
        }[]
      }
      get_gov_farm_analytics_with_audit: {
        Args: { _access_type?: string; _metadata?: Json }
        Returns: {
          active_animal_count: number
          carabao_count: number
          cattle_count: number
          created_at: string
          data_category: string
          goat_count: number
          gps_lat: number
          gps_lng: number
          id: string
          is_deleted: boolean
          is_program_participant: boolean
          livestock_type: string
          municipality: string
          name: string
          program_group: string
          province: string
          region: string
          sheep_count: number
        }[]
      }
      get_government_breeding_stats:
        | {
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
        | {
            Args: {
              data_category_filter?: string
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
              unique_semen_count: number
            }[]
          }
      get_government_feed_consumption: {
        Args: {
          data_category_filter?: string
          end_date: string
          municipality_filter?: string
          province_filter?: string
          region_filter?: string
          start_date: string
        }
        Returns: {
          report_date: string
          total_animals_fed: number
          total_farms_feeding: number
          total_feed_kg: number
        }[]
      }
      get_government_health_stats: {
        Args: {
          data_category_filter?: string
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
      get_government_milk_analytics:
        | {
            Args: {
              end_date: string
              municipality_filter?: string
              province_filter?: string
              region_filter?: string
              start_date: string
            }
            Returns: {
              avg_carabao_price: number
              avg_cattle_price: number
              avg_goat_price: number
              carabao_farms_milking: number
              carabao_milk_liters: number
              cattle_farms_milking: number
              cattle_milk_liters: number
              goat_farms_milking: number
              goat_milk_liters: number
              report_date: string
              total_milk_liters: number
            }[]
          }
        | {
            Args: {
              data_category_filter?: string
              end_date: string
              municipality_filter?: string
              province_filter?: string
              region_filter?: string
              start_date: string
            }
            Returns: {
              avg_carabao_price: number
              avg_cattle_price: number
              avg_goat_price: number
              carabao_farms_milking: number
              carabao_milk_liters: number
              cattle_farms_milking: number
              cattle_milk_liters: number
              goat_farms_milking: number
              goat_milk_liters: number
              report_date: string
              total_milk_liters: number
            }[]
          }
      get_government_stats:
        | {
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
        | {
            Args: {
              data_category_filter?: string
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
      get_government_stats_timeseries:
        | {
            Args: {
              end_date: string
              filter_municipality?: string
              filter_province?: string
              filter_region?: string
              start_date: string
            }
            Returns: {
              carabao_count: number
              cattle_count: number
              date: string
              doc_aga_queries: number
              goat_count: number
              health_events: number
              sheep_count: number
              total_farms: number
              total_milk_liters: number
            }[]
          }
        | {
            Args: {
              data_category_filter?: string
              end_date: string
              filter_municipality?: string
              filter_province?: string
              filter_region?: string
              start_date: string
            }
            Returns: {
              carabao_count: number
              cattle_count: number
              date: string
              doc_aga_queries: number
              goat_count: number
              health_events: number
              sheep_count: number
              total_farms: number
              total_milk_liters: number
            }[]
          }
      get_grant_effectiveness: {
        Args: {
          p_data_category?: string
          p_municipality?: string
          p_province?: string
          p_region?: string
        }
        Returns: Json
      }
      get_health_heatmap_data:
        | {
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
        | {
            Args: {
              data_category_filter?: string
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
      get_my_coop_feed_receipts: {
        Args: { _date_from?: string; _date_to?: string; _farm_id: string }
        Returns: {
          category: string
          cost_per_kg: number
          created_at: string
          disbursement_date: string
          entry_type: string
          feed_type: string
          id: string
          original_disbursement_id: string
          quantity_kg: number
          status: string
          total_cost: number
        }[]
      }
      get_my_coop_membership: {
        Args: { _farm_id: string }
        Returns: {
          accepted_at: string
          cooperative_id: string
          cooperative_name: string
          invitation_status: string
        }[]
      }
      get_my_coop_milk_deliveries: {
        Args: { _date_from?: string; _date_to?: string; _farm_id: string }
        Returns: {
          created_at: string
          entry_type: string
          id: string
          milk_quality: string
          original_receiving_id: string
          price_per_liter: number
          receiving_date: string
          session: string
          species: string
          status: string
          total_value: number
          volume_liters: number
        }[]
      }
      get_my_coop_soa: {
        Args: { _farm_id: string; _period_end?: string; _period_start?: string }
        Returns: {
          cooperative_name: string
          finalized_at: string
          id: string
          net_balance: number
          notes: string
          period_end: string
          period_start: string
          revision_number: number
          settled_at: string
          status: string
          total_feed_cost: number
          total_feed_kg: number
          total_milk_liters: number
          total_milk_value: number
        }[]
      }
      get_recent_abandoned_voice_attempts: {
        Args: { _limit?: number; _start_date?: string }
        Returns: Json
      }
      get_regional_data_quality: {
        Args: {
          data_category_filter?: string
          municipality_filter?: string
          province_filter?: string
          region_filter?: string
        }
        Returns: {
          animals_with_weight: number
          farms_with_gps: number
          farms_with_health_logs: number
          farms_with_production_logs: number
          gps_coverage_pct: number
          health_recording_pct: number
          overall_quality_score: number
          production_tracking_pct: number
          province: string
          region: string
          total_animals: number
          total_farms: number
          weight_completeness_pct: number
        }[]
      }
      get_regional_feed_security:
        | {
            Args: {
              municipality_filter?: string
              province_filter?: string
              region_filter?: string
            }
            Returns: {
              adequate_feed_farms: number
              avg_feed_stock_days: number
              critical_feed_farms: number
              critical_percentage: number
              low_feed_farms: number
              low_percentage: number
              province: string
              region: string
              total_concentrate_kg: number
              total_farms: number
              total_roughage_kg: number
            }[]
          }
        | {
            Args: {
              data_category_filter?: string
              municipality_filter?: string
              province_filter?: string
              region_filter?: string
            }
            Returns: {
              adequate_feed_farms: number
              avg_feed_stock_days: number
              critical_feed_farms: number
              critical_percentage: number
              low_feed_farms: number
              low_percentage: number
              province: string
              region: string
              total_concentrate_kg: number
              total_farms: number
              total_roughage_kg: number
            }[]
          }
      get_regional_market_prices:
        | {
            Args: {
              end_date: string
              region_filter?: string
              start_date: string
            }
            Returns: {
              avg_price_per_kg: number
              latest_date: string
              latest_price: number
              livestock_type: string
              max_price: number
              min_price: number
              price_trend: string
              price_volatility: number
              region: string
              sample_count: number
            }[]
          }
        | {
            Args: {
              data_category_filter?: string
              end_date: string
              region_filter?: string
              start_date: string
            }
            Returns: {
              avg_price_per_kg: number
              latest_date: string
              latest_price: number
              livestock_type: string
              max_price: number
              min_price: number
              price_trend: string
              price_volatility: number
              region: string
              sample_count: number
            }[]
          }
      get_regional_pcrs_summary: {
        Args: {
          data_category_filter?: string
          municipality_filter?: string
          province_filter?: string
          region_filter?: string
        }
        Returns: {
          avg_risk_score: number
          critical_count: number
          high_count: number
          low_count: number
          moderate_count: number
          monthly_breakdown: Json
          province: string
          region: string
          total_pregnant: number
        }[]
      }
      get_stt_analytics: {
        Args: { end_date?: string; start_date?: string }
        Returns: Json
      }
      get_system_health_metrics: {
        Args: { data_category_filter?: string }
        Returns: Json
      }
      get_team_members: {
        Args: { p_farm_id: string }
        Returns: {
          full_name: string
          id: string
          invitation_status: string
          role_in_farm: Database["public"]["Enums"]["user_role"]
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
      get_user_cooperative_id: { Args: { _user_id: string }; Returns: string }
      get_user_invitation_public: {
        Args: { _token: string }
        Returns: {
          email: string
          invitation_status: string
          invited_at: string
          role: Database["public"]["Enums"]["user_role"]
          token_expires_at: string
        }[]
      }
      get_voice_health_by_farm: {
        Args: { _end_date?: string; _farm_id: string; _start_date?: string }
        Returns: Json
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
      initialize_animal_fertility_status: {
        Args: { p_animal_id: string }
        Returns: Database["public"]["Enums"]["fertility_status"]
      }
      invite_farm_to_cooperative: {
        Args: { _cooperative_id: string; _email: string }
        Returns: string
      }
      is_cooperative_admin: {
        Args: { _cooperative_id: string; _user_id: string }
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
      is_vet: { Args: { _farm_id: string; _user_id: string }; Returns: boolean }
      leave_cooperative: { Args: { _membership_id: string }; Returns: string }
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
      lookup_invitation: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          invited_at: string
          inviter_email: string
          inviter_name: string
          role: string
          role_label: string
          status: string
          target_name: string
          type: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_coop_feed_disbursement: {
        Args: {
          _coop_feed_inventory_id: string
          _cooperative_id: string
          _farm_id: string
          _notes?: string
          _quantity_kg: number
        }
        Returns: string
      }
      record_coop_milk_receiving: {
        Args: {
          _cooperative_id: string
          _farm_id: string
          _milk_quality?: string
          _notes?: string
          _price_per_liter?: number
          _receiving_date: string
          _session: string
          _species: string
          _volume_liters: number
        }
        Returns: string
      }
      remove_farm_from_cooperative: {
        Args: { _cooperative_id: string; _membership_id: string }
        Returns: string
      }
      request_invitation_resend: {
        Args: { p_token: string }
        Returns: {
          new_token: string
          reason: string
          sent: boolean
        }[]
      }
      requires_approval: {
        Args: { _activity_type: string; _farm_id: string; _user_id: string }
        Returns: boolean
      }
      run_daily_stats_job: { Args: never; Returns: undefined }
      set_coop_milk_price: {
        Args: {
          _cooperative_id: string
          _effective_date: string
          _notes?: string
          _price_per_liter: number
          _species: string
        }
        Returns: string
      }
      settle_coop_soa: {
        Args: {
          _cooperative_id: string
          _farm_id: string
          _period_start: string
        }
        Returns: string
      }
      update_sync_checkpoint: {
        Args: {
          p_farm_id: string
          p_last_record_timestamp: string
          p_records_synced: number
          p_table_name: string
        }
        Returns: undefined
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
      fertility_status:
        | "not_eligible"
        | "open_cycling"
        | "in_heat"
        | "bred_waiting"
        | "suspected_pregnant"
        | "confirmed_pregnant"
        | "fresh_postpartum"
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
      sync_status: "pending" | "syncing" | "synced" | "conflict" | "error"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_on_customer"
        | "resolved"
        | "closed"
      user_role:
        | "farmer_owner"
        | "farmhand"
        | "merchant"
        | "vet"
        | "admin"
        | "distributor"
        | "government"
        | "cooperative"
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
      fertility_status: [
        "not_eligible",
        "open_cycling",
        "in_heat",
        "bred_waiting",
        "suspected_pregnant",
        "confirmed_pregnant",
        "fresh_postpartum",
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
      sync_status: ["pending", "syncing", "synced", "conflict", "error"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_on_customer",
        "resolved",
        "closed",
      ],
      user_role: [
        "farmer_owner",
        "farmhand",
        "merchant",
        "vet",
        "admin",
        "distributor",
        "government",
        "cooperative",
      ],
    },
  },
} as const
