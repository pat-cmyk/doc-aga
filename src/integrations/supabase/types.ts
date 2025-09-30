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
      ai_records: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          performed_date: string | null
          scheduled_date: string | null
          technician: string | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          performed_date?: string | null
          scheduled_date?: string | null
          technician?: string | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          performed_date?: string | null
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
          birth_date: string | null
          breed: string | null
          client_generated_id: string | null
          created_at: string
          ear_tag: string | null
          farm_id: string
          gender: string | null
          id: string
          is_deleted: boolean
          milking_start_date: string | null
          name: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          breed?: string | null
          client_generated_id?: string | null
          created_at?: string
          ear_tag?: string | null
          farm_id: string
          gender?: string | null
          id?: string
          is_deleted?: boolean
          milking_start_date?: string | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          breed?: string | null
          client_generated_id?: string | null
          created_at?: string
          ear_tag?: string | null
          farm_id?: string
          gender?: string | null
          id?: string
          is_deleted?: boolean
          milking_start_date?: string | null
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
          matched_faq_id: string | null
          question: string
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          created_at?: string
          farm_id?: string | null
          id?: string
          matched_faq_id?: string | null
          question: string
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          created_at?: string
          farm_id?: string | null
          id?: string
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
          role_in_farm: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          role_in_farm: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          role_in_farm?: Database["public"]["Enums"]["user_role"]
          user_id?: string
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
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
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
      is_farm_member: {
        Args: { farm_id: string }
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
      notification_type: "order_update" | "vet_update" | "message" | "system"
      order_status:
        | "received"
        | "in_process"
        | "in_transit"
        | "delivered"
        | "cancelled"
      user_role: "farmer_owner" | "farmhand" | "merchant" | "vet" | "admin"
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
      notification_type: ["order_update", "vet_update", "message", "system"],
      order_status: [
        "received",
        "in_process",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      user_role: ["farmer_owner", "farmhand", "merchant", "vet", "admin"],
    },
  },
} as const
