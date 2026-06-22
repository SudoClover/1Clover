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
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          byte_size: number
          checksum: string | null
          created_at: string
          duration_ms: number | null
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          mime_type: string
          moderation_state: Database["public"]["Enums"]["moderation_state"]
          owner_id: string
          processing_state: Database["public"]["Enums"]["processing_state"]
          storage_key: string
          variants: Json
          width: number | null
        }
        Insert: {
          byte_size: number
          checksum?: string | null
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          mime_type: string
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          owner_id: string
          processing_state?: Database["public"]["Enums"]["processing_state"]
          storage_key: string
          variants?: Json
          width?: number | null
        }
        Update: {
          byte_size?: number
          checksum?: string | null
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          mime_type?: string
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          owner_id?: string
          processing_state?: Database["public"]["Enums"]["processing_state"]
          storage_key?: string
          variants?: Json
          width?: number | null
        }
        Relationships: []
      }
      post_media: {
        Row: {
          media_id: string
          position: number
          post_id: string
        }
        Insert: {
          media_id: string
          position?: number
          post_id: string
        }
        Update: {
          media_id?: string
          position?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          created_at: string
          description: string | null
          edited_at: string | null
          hot_score: number
          id: string
          moderation_state: Database["public"]["Enums"]["moderation_state"]
          title: string
        }
        Insert: {
          author_id: string
          created_at?: string
          description?: string | null
          edited_at?: string | null
          hot_score?: number
          id?: string
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          title: string
        }
        Update: {
          author_id?: string
          created_at?: string
          description?: string | null
          edited_at?: string | null
          hot_score?: number
          id?: string
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          birthdate: string | null
          created_at: string
          display_name: string | null
          id: string
          username: string
        }
        Insert: {
          bio?: string | null
          birthdate?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          username: string
        }
        Update: {
          bio?: string | null
          birthdate?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          username?: string
        }
        Relationships: []
      }
      tags: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_post: {
        Args: { p_description: string; p_media_ids: string[]; p_title: string }
        Returns: string
      }
      hot_feed_page: {
        Args: { p_cursor_id?: string; p_limit: number }
        Returns: string[]
      }
      set_post_tags: {
        Args: { p_post_id: string; p_tag_names: string[] }
        Returns: undefined
      }
    }
    Enums: {
      media_kind: "image" | "audio" | "video"
      moderation_state: "pending" | "approved" | "held" | "removed"
      processing_state: "pending" | "processing" | "ready" | "failed"
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
      media_kind: ["image", "audio", "video"],
      moderation_state: ["pending", "approved", "held", "removed"],
      processing_state: ["pending", "processing", "ready", "failed"],
    },
  },
} as const

