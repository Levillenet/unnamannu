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
      apartments: {
        Row: {
          apartment_type: string | null
          bedrooms: number | null
          building_id: string
          created_at: string
          floor: string | null
          id: string
          number: string
          size_m2: number | null
          updated_at: string
        }
        Insert: {
          apartment_type?: string | null
          bedrooms?: number | null
          building_id: string
          created_at?: string
          floor?: string | null
          id?: string
          number: string
          size_m2?: number | null
          updated_at?: string
        }
        Update: {
          apartment_type?: string | null
          bedrooms?: number | null
          building_id?: string
          created_at?: string
          floor?: string | null
          id?: string
          number?: string
          size_m2?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apartments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: number
          ts: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ts?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ts?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      buildings: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_assignments: {
        Row: {
          apartment_id: string | null
          created_at: string
          id: string
          schedule_id: string
          thermostat_id: string | null
        }
        Insert: {
          apartment_id?: string | null
          created_at?: string
          id?: string
          schedule_id: string
          thermostat_id?: string | null
        }
        Update: {
          apartment_id?: string | null
          created_at?: string
          id?: string
          schedule_id?: string
          thermostat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_thermostat_id_fkey"
            columns: ["thermostat_id"]
            isOneToOne: false
            referencedRelation: "thermostats"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          weekly_program: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          weekly_program?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          weekly_program?: Json
        }
        Relationships: []
      }
      thermostat_readings: {
        Row: {
          energy_kwh: number | null
          event: string | null
          floor_temp: number | null
          id: number
          power_w: number | null
          room_temp: number | null
          setpoint: number | null
          thermostat_id: string
          ts: string
        }
        Insert: {
          energy_kwh?: number | null
          event?: string | null
          floor_temp?: number | null
          id?: number
          power_w?: number | null
          room_temp?: number | null
          setpoint?: number | null
          thermostat_id: string
          ts?: string
        }
        Update: {
          energy_kwh?: number | null
          event?: string | null
          floor_temp?: number | null
          id?: number
          power_w?: number | null
          room_temp?: number | null
          setpoint?: number | null
          thermostat_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "thermostat_readings_thermostat_id_fkey"
            columns: ["thermostat_id"]
            isOneToOne: false
            referencedRelation: "thermostats"
            referencedColumns: ["id"]
          },
        ]
      }
      thermostats: {
        Row: {
          apartment_id: string | null
          created_at: string
          current_schedule_id: string | null
          current_setpoint: number
          ebeco_device_id: string | null
          enabled: boolean
          guest_max_setpoint: number
          id: string
          last_seen_at: string | null
          locked: boolean
          max_hold_started_at: string | null
          max_setpoint: number
          min_setpoint: number
          name: string
          override_started_at: string | null
          room: string | null
          status: Database["public"]["Enums"]["thermostat_status"]
          updated_at: string
          zone: string
        }
        Insert: {
          apartment_id?: string | null
          created_at?: string
          current_schedule_id?: string | null
          current_setpoint?: number
          ebeco_device_id?: string | null
          enabled?: boolean
          guest_max_setpoint?: number
          id?: string
          last_seen_at?: string | null
          locked?: boolean
          max_hold_started_at?: string | null
          max_setpoint?: number
          min_setpoint?: number
          name: string
          override_started_at?: string | null
          room?: string | null
          status?: Database["public"]["Enums"]["thermostat_status"]
          updated_at?: string
          zone?: string
        }
        Update: {
          apartment_id?: string | null
          created_at?: string
          current_schedule_id?: string | null
          current_setpoint?: number
          ebeco_device_id?: string | null
          enabled?: boolean
          guest_max_setpoint?: number
          id?: string
          last_seen_at?: string | null
          locked?: boolean
          max_hold_started_at?: string | null
          max_setpoint?: number
          min_setpoint?: number
          name?: string
          override_started_at?: string | null
          room?: string | null
          status?: Database["public"]["Enums"]["thermostat_status"]
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "thermostats_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thermostats_current_schedule_id_fkey"
            columns: ["current_schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
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
      zone_defaults: {
        Row: {
          building_id: string
          created_at: string
          default_setpoint: number
          guest_max_setpoint: number
          id: string
          label: string
          max_hold_minutes: number
          override_grace_minutes: number
          updated_at: string
          zone: string
        }
        Insert: {
          building_id: string
          created_at?: string
          default_setpoint?: number
          guest_max_setpoint?: number
          id?: string
          label: string
          max_hold_minutes?: number
          override_grace_minutes?: number
          updated_at?: string
          zone: string
        }
        Update: {
          building_id?: string
          created_at?: string
          default_setpoint?: number
          guest_max_setpoint?: number
          id?: string
          label?: string
          max_hold_minutes?: number
          override_grace_minutes?: number
          updated_at?: string
          zone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_zone_default: { Args: { _id: string }; Returns: undefined }
      enforce_pending_overrides: { Args: never; Returns: number }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "manager" | "resident" | "admin" | "user"
      thermostat_status: "online" | "offline" | "alarm"
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
      app_role: ["manager", "resident", "admin", "user"],
      thermostat_status: ["online", "offline", "alarm"],
    },
  },
} as const
