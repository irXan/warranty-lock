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
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string
          created_by: string | null
          current_status: Database["public"]["Enums"]["repair_status"]
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          device_model: string
          id: string
          issue_description: string
          serial_number: string
          track_id: string
          warranty_days: number
          workshop_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_status?: Database["public"]["Enums"]["repair_status"]
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          device_model: string
          id?: string
          issue_description: string
          serial_number: string
          track_id: string
          warranty_days?: number
          workshop_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_status?: Database["public"]["Enums"]["repair_status"]
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          device_model?: string
          id?: string
          issue_description?: string
          serial_number?: string
          track_id?: string
          warranty_days?: number
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      status_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          receipt_id: string
          status: Database["public"]["Enums"]["repair_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          receipt_id: string
          status: Database["public"]["Enums"]["repair_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          receipt_id?: string
          status?: Database["public"]["Enums"]["repair_status"]
        }
        Relationships: [
          {
            foreignKeyName: "status_events_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workshop_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workshop_role"]
          user_id: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workshop_role"]
          user_id: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workshop_role"]
          user_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_members_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          owner_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_workshop_id: { Args: { _user_id: string }; Returns: string }
      get_receipt_by_track_id: { Args: { _track_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workshop_member: {
        Args: { _user_id: string; _workshop_id: string }
        Returns: boolean
      }
      is_workshop_owner: {
        Args: { _user_id: string; _workshop_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      repair_status:
        | "Received"
        | "Diagnosing"
        | "In Repair"
        | "Ready for Pickup"
        | "Delivered"
      workshop_role: "owner" | "staff"
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
      app_role: ["admin", "customer"],
      repair_status: [
        "Received",
        "Diagnosing",
        "In Repair",
        "Ready for Pickup",
        "Delivered",
      ],
      workshop_role: ["owner", "staff"],
    },
  },
} as const
