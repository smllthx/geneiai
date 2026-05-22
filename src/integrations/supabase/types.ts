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
      actividad: {
        Row: {
          created_at: string
          descripcion: string
          id: string
          metadata: Json
          ref_id: string | null
          ref_tipo: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descripcion: string
          id?: string
          metadata?: Json
          ref_id?: string | null
          ref_tipo?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          id?: string
          metadata?: Json
          ref_id?: string | null
          ref_tipo?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          contexto: Json
          created_at: string
          duracion_ms: number | null
          error: string | null
          id: string
          modelo: string
          persona_id: string | null
          prompt: string
          provider: Database["public"]["Enums"]["agent_provider"]
          resultado: string | null
          status: Database["public"]["Enums"]["agent_status"]
          titulo: string
          tokens_in: number | null
          tokens_out: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contexto?: Json
          created_at?: string
          duracion_ms?: number | null
          error?: string | null
          id?: string
          modelo: string
          persona_id?: string | null
          prompt: string
          provider: Database["public"]["Enums"]["agent_provider"]
          resultado?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          titulo: string
          tokens_in?: number | null
          tokens_out?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contexto?: Json
          created_at?: string
          duracion_ms?: number | null
          error?: string | null
          id?: string
          modelo?: string
          persona_id?: string | null
          prompt?: string
          provider?: Database["public"]["Enums"]["agent_provider"]
          resultado?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          titulo?: string
          tokens_in?: number | null
          tokens_out?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          acento: string
          asistente_voz: boolean
          configurado: boolean
          idioma: string
          investigacion_auto: boolean
          modelo_default: string
          proveedor_default: Database["public"]["Enums"]["agent_provider"]
          proveedores_activos: Json
          region_busqueda: string | null
          tema: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acento?: string
          asistente_voz?: boolean
          configurado?: boolean
          idioma?: string
          investigacion_auto?: boolean
          modelo_default?: string
          proveedor_default?: Database["public"]["Enums"]["agent_provider"]
          proveedores_activos?: Json
          region_busqueda?: string | null
          tema?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acento?: string
          asistente_voz?: boolean
          configurado?: boolean
          idioma?: string
          investigacion_auto?: boolean
          modelo_default?: string
          proveedor_default?: Database["public"]["Enums"]["agent_provider"]
          proveedores_activos?: Json
          region_busqueda?: string | null
          tema?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      busquedas_externas: {
        Row: {
          created_at: string
          id: string
          notas: string | null
          objetivo: string | null
          persona_id: string | null
          plataforma: string
          query: string
          resultado_encontrado: boolean | null
          url: string | null
          url_hallazgo: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notas?: string | null
          objetivo?: string | null
          persona_id?: string | null
          plataforma: string
          query: string
          resultado_encontrado?: boolean | null
          url?: string | null
          url_hallazgo?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notas?: string | null
          objetivo?: string | null
          persona_id?: string | null
          plataforma?: string
          query?: string
          resultado_encontrado?: boolean | null
          url?: string | null
          url_hallazgo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "busquedas_externas_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      coincidencias: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["coincidencia_estado"]
          id: string
          razones: Json
          ref_a: string
          ref_b: string
          score: number
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["coincidencia_estado"]
          id?: string
          razones?: Json
          ref_a: string
          ref_b: string
          score?: number
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["coincidencia_estado"]
          id?: string
          razones?: Json
          ref_a?: string
          ref_b?: string
          score?: number
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      credenciales_externas: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          password_cifrado: string
          proveedor: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          password_cifrado: string
          proveedor: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          password_cifrado?: string
          proveedor?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      dna_estimates: {
        Row: {
          created_at: string
          fuente: string | null
          id: string
          notas: string | null
          persona_id: string | null
          porcentaje: number
          rama: string | null
          region: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fuente?: string | null
          id?: string
          notas?: string | null
          persona_id?: string | null
          porcentaje?: number
          rama?: string | null
          region: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fuente?: string | null
          id?: string
          notas?: string | null
          persona_id?: string | null
          porcentaje?: number
          rama?: string | null
          region?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documentos: {
        Row: {
          archivo_path: string | null
          cita: string | null
          created_at: string
          estado: Database["public"]["Enums"]["documento_estado"]
          fecha: string | null
          id: string
          lugares_mencionados: string[] | null
          ocr_calidad: string | null
          ocr_dudas: string | null
          ocr_texto: string | null
          personas_mencionadas: string[] | null
          repositorio: string | null
          resumen: string | null
          tipo: Database["public"]["Enums"]["documento_tipo"]
          titulo: string
          traduccion: string | null
          transcripcion: string | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          archivo_path?: string | null
          cita?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["documento_estado"]
          fecha?: string | null
          id?: string
          lugares_mencionados?: string[] | null
          ocr_calidad?: string | null
          ocr_dudas?: string | null
          ocr_texto?: string | null
          personas_mencionadas?: string[] | null
          repositorio?: string | null
          resumen?: string | null
          tipo?: Database["public"]["Enums"]["documento_tipo"]
          titulo: string
          traduccion?: string | null
          transcripcion?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          archivo_path?: string | null
          cita?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["documento_estado"]
          fecha?: string | null
          id?: string
          lugares_mencionados?: string[] | null
          ocr_calidad?: string | null
          ocr_dudas?: string | null
          ocr_texto?: string | null
          personas_mencionadas?: string[] | null
          repositorio?: string | null
          resumen?: string | null
          tipo?: Database["public"]["Enums"]["documento_tipo"]
          titulo?: string
          traduccion?: string | null
          transcripcion?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      equivalencias_nombre: {
        Row: {
          created_at: string
          equivalente: string
          id: string
          idioma: string | null
          nombre_base: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equivalente: string
          id?: string
          idioma?: string | null
          nombre_base: string
          user_id: string
        }
        Update: {
          created_at?: string
          equivalente?: string
          id?: string
          idioma?: string | null
          nombre_base?: string
          user_id?: string
        }
        Relationships: []
      }
      error_reports: {
        Row: {
          applied: boolean
          contexto: Json
          created_at: string
          diagnosis: string | null
          id: string
          message: string
          severity: string | null
          source: string
          stack: string | null
          suggested_action: string | null
          url: string | null
          user_agent: string | null
          user_id: string
          user_message: string | null
        }
        Insert: {
          applied?: boolean
          contexto?: Json
          created_at?: string
          diagnosis?: string | null
          id?: string
          message: string
          severity?: string | null
          source?: string
          stack?: string | null
          suggested_action?: string | null
          url?: string | null
          user_agent?: string | null
          user_id: string
          user_message?: string | null
        }
        Update: {
          applied?: boolean
          contexto?: Json
          created_at?: string
          diagnosis?: string | null
          id?: string
          message?: string
          severity?: string | null
          source?: string
          stack?: string | null
          suggested_action?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string
          user_message?: string | null
        }
        Relationships: []
      }
      eventos: {
        Row: {
          certeza: Database["public"]["Enums"]["certeza_nivel"]
          created_at: string
          descripcion: string | null
          fecha: string | null
          fecha_aprox: string | null
          fuente_id: string | null
          id: string
          lugar_id: string | null
          lugar_original: string | null
          persona_id: string
          rango_fin: number | null
          rango_ini: number | null
          tipo: Database["public"]["Enums"]["evento_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          certeza?: Database["public"]["Enums"]["certeza_nivel"]
          created_at?: string
          descripcion?: string | null
          fecha?: string | null
          fecha_aprox?: string | null
          fuente_id?: string | null
          id?: string
          lugar_id?: string | null
          lugar_original?: string | null
          persona_id: string
          rango_fin?: number | null
          rango_ini?: number | null
          tipo: Database["public"]["Enums"]["evento_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          certeza?: Database["public"]["Enums"]["certeza_nivel"]
          created_at?: string
          descripcion?: string | null
          fecha?: string | null
          fecha_aprox?: string | null
          fuente_id?: string | null
          id?: string
          lugar_id?: string | null
          lugar_original?: string | null
          persona_id?: string
          rango_fin?: number | null
          rango_ini?: number | null
          tipo?: Database["public"]["Enums"]["evento_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_fuente_fk"
            columns: ["fuente_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_lugar_id_fkey"
            columns: ["lugar_id"]
            isOneToOne: false
            referencedRelation: "lugares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      external_accounts: {
        Row: {
          access_token: string | null
          account_ref: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          provider: string
          refresh_token: string | null
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_ref?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_ref?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      familias: {
        Row: {
          created_at: string
          head_persona_id: string | null
          id: string
          nombre: string
          notas: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          head_persona_id?: string | null
          id?: string
          nombre: string
          notas?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          head_persona_id?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      foto_tags: {
        Row: {
          created_at: string
          foto_id: string
          h: number
          id: string
          persona_id: string
          user_id: string
          w: number
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          foto_id: string
          h?: number
          id?: string
          persona_id: string
          user_id: string
          w?: number
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          foto_id?: string
          h?: number
          id?: string
          persona_id?: string
          user_id?: string
          w?: number
          x?: number
          y?: number
        }
        Relationships: []
      }
      fotos: {
        Row: {
          created_at: string
          descripcion: string | null
          fecha: string | null
          fecha_aprox: string | null
          id: string
          lugar_id: string | null
          personas_ids: string[]
          storage_path: string | null
          titulo: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          fecha?: string | null
          fecha_aprox?: string | null
          id?: string
          lugar_id?: string | null
          personas_ids?: string[]
          storage_path?: string | null
          titulo?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          fecha?: string | null
          fecha_aprox?: string | null
          id?: string
          lugar_id?: string | null
          personas_ids?: string[]
          storage_path?: string | null
          titulo?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_inferences: {
        Row: {
          confidence_score: number
          created_at: string
          date_range_end: number | null
          date_range_start: number | null
          explanation: string
          id: string
          inference_type: string
          inferred_field: string | null
          inferred_value: string | null
          person_id: string | null
          related_event_ids: string[] | null
          related_person_ids: string[] | null
          rule_code: string | null
          status: Database["public"]["Enums"]["inferencia_estado"]
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          date_range_end?: number | null
          date_range_start?: number | null
          explanation: string
          id?: string
          inference_type: string
          inferred_field?: string | null
          inferred_value?: string | null
          person_id?: string | null
          related_event_ids?: string[] | null
          related_person_ids?: string[] | null
          rule_code?: string | null
          status?: Database["public"]["Enums"]["inferencia_estado"]
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          date_range_end?: number | null
          date_range_start?: number | null
          explanation?: string
          id?: string
          inference_type?: string
          inferred_field?: string | null
          inferred_value?: string | null
          person_id?: string | null
          related_event_ids?: string[] | null
          related_person_ids?: string[] | null
          rule_code?: string | null
          status?: Database["public"]["Enums"]["inferencia_estado"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_inferences_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      hipotesis: {
        Row: {
          argumentos_contra: string | null
          argumentos_favor: string | null
          created_at: string
          descripcion: string | null
          documentos: string[] | null
          estado: Database["public"]["Enums"]["hipotesis_estado"]
          id: string
          personas: string[] | null
          probabilidad: number | null
          proxima_accion: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          argumentos_contra?: string | null
          argumentos_favor?: string | null
          created_at?: string
          descripcion?: string | null
          documentos?: string[] | null
          estado?: Database["public"]["Enums"]["hipotesis_estado"]
          id?: string
          personas?: string[] | null
          probabilidad?: number | null
          proxima_accion?: string | null
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          argumentos_contra?: string | null
          argumentos_favor?: string | null
          created_at?: string
          descripcion?: string | null
          documentos?: string[] | null
          estado?: Database["public"]["Enums"]["hipotesis_estado"]
          id?: string
          personas?: string[] | null
          probabilidad?: number | null
          proxima_accion?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inference_rules: {
        Row: {
          activa: boolean
          code: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          code: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          code?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      inference_sources: {
        Row: {
          documento_id: string | null
          evento_id: string | null
          id: string
          inference_id: string
          peso: number | null
          user_id: string
        }
        Insert: {
          documento_id?: string | null
          evento_id?: string | null
          id?: string
          inference_id: string
          peso?: number | null
          user_id: string
        }
        Update: {
          documento_id?: string | null
          evento_id?: string | null
          id?: string
          inference_id?: string
          peso?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inference_sources_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inference_sources_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inference_sources_inference_id_fkey"
            columns: ["inference_id"]
            isOneToOne: false
            referencedRelation: "generated_inferences"
            referencedColumns: ["id"]
          },
        ]
      }
      lugares: {
        Row: {
          archivo: string | null
          ciudad: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          notas: string | null
          pais: string | null
          parroquia: string | null
          provincia: string | null
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archivo?: string | null
          ciudad?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notas?: string | null
          pais?: string | null
          parroquia?: string | null
          provincia?: string | null
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archivo?: string | null
          ciudad?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notas?: string | null
          pais?: string | null
          parroquia?: string | null
          provincia?: string | null
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notificaciones: {
        Row: {
          created_at: string
          id: string
          leida: boolean
          mensaje: string | null
          metadata: Json
          tipo: string
          titulo: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leida?: boolean
          mensaje?: string | null
          metadata?: Json
          tipo?: string
          titulo: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leida?: boolean
          mensaje?: string | null
          metadata?: Json
          tipo?: string
          titulo?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      parecidos: {
        Row: {
          created_at: string
          estimacion_genetica: number | null
          id: string
          notas: string | null
          persona_a: string
          persona_b: string
          rasgos_comunes: Json
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          estimacion_genetica?: number | null
          id?: string
          notas?: string | null
          persona_a: string
          persona_b: string
          rasgos_comunes?: Json
          score?: number
          user_id: string
        }
        Update: {
          created_at?: string
          estimacion_genetica?: number | null
          id?: string
          notas?: string | null
          persona_a?: string
          persona_b?: string
          rasgos_comunes?: Json
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      personas: {
        Row: {
          apellidos: string
          bautismo_fecha: string | null
          bautismo_lugar_id: string | null
          certeza: Database["public"]["Enums"]["certeza_nivel"]
          created_at: string
          defuncion_fecha: string | null
          defuncion_lugar_id: string | null
          enlaces: Json
          entierro_fecha: string | null
          entierro_lugar_id: string | null
          foto_url: string | null
          id: string
          ids_externos: Json
          matrimonio_fecha: string | null
          matrimonio_lugar_id: string | null
          nac_fecha: string | null
          nac_fecha_aprox: string | null
          nac_lugar_id: string | null
          nac_rango_fin: number | null
          nac_rango_ini: number | null
          nacionalidad: string | null
          nombres: string
          notas: string | null
          ocupacion: string | null
          religion: string | null
          sexo: string | null
          sync_to_fs: boolean
          updated_at: string
          user_id: string
          variantes_nombre: string[] | null
          viva: Database["public"]["Enums"]["viva_status"]
        }
        Insert: {
          apellidos: string
          bautismo_fecha?: string | null
          bautismo_lugar_id?: string | null
          certeza?: Database["public"]["Enums"]["certeza_nivel"]
          created_at?: string
          defuncion_fecha?: string | null
          defuncion_lugar_id?: string | null
          enlaces?: Json
          entierro_fecha?: string | null
          entierro_lugar_id?: string | null
          foto_url?: string | null
          id?: string
          ids_externos?: Json
          matrimonio_fecha?: string | null
          matrimonio_lugar_id?: string | null
          nac_fecha?: string | null
          nac_fecha_aprox?: string | null
          nac_lugar_id?: string | null
          nac_rango_fin?: number | null
          nac_rango_ini?: number | null
          nacionalidad?: string | null
          nombres: string
          notas?: string | null
          ocupacion?: string | null
          religion?: string | null
          sexo?: string | null
          sync_to_fs?: boolean
          updated_at?: string
          user_id: string
          variantes_nombre?: string[] | null
          viva?: Database["public"]["Enums"]["viva_status"]
        }
        Update: {
          apellidos?: string
          bautismo_fecha?: string | null
          bautismo_lugar_id?: string | null
          certeza?: Database["public"]["Enums"]["certeza_nivel"]
          created_at?: string
          defuncion_fecha?: string | null
          defuncion_lugar_id?: string | null
          enlaces?: Json
          entierro_fecha?: string | null
          entierro_lugar_id?: string | null
          foto_url?: string | null
          id?: string
          ids_externos?: Json
          matrimonio_fecha?: string | null
          matrimonio_lugar_id?: string | null
          nac_fecha?: string | null
          nac_fecha_aprox?: string | null
          nac_lugar_id?: string | null
          nac_rango_fin?: number | null
          nac_rango_ini?: number | null
          nacionalidad?: string | null
          nombres?: string
          notas?: string | null
          ocupacion?: string | null
          religion?: string | null
          sexo?: string | null
          sync_to_fs?: boolean
          updated_at?: string
          user_id?: string
          variantes_nombre?: string[] | null
          viva?: Database["public"]["Enums"]["viva_status"]
        }
        Relationships: [
          {
            foreignKeyName: "personas_bautismo_lugar_id_fkey"
            columns: ["bautismo_lugar_id"]
            isOneToOne: false
            referencedRelation: "lugares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personas_defuncion_lugar_id_fkey"
            columns: ["defuncion_lugar_id"]
            isOneToOne: false
            referencedRelation: "lugares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personas_entierro_lugar_id_fkey"
            columns: ["entierro_lugar_id"]
            isOneToOne: false
            referencedRelation: "lugares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personas_matrimonio_lugar_id_fkey"
            columns: ["matrimonio_lugar_id"]
            isOneToOne: false
            referencedRelation: "lugares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personas_nac_lugar_id_fkey"
            columns: ["nac_lugar_id"]
            isOneToOne: false
            referencedRelation: "lugares"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          proband_asked: boolean
          proband_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          proband_asked?: boolean
          proband_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          proband_asked?: boolean
          proband_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_proband_id_fkey"
            columns: ["proband_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys?: Json
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rasgos_faciales: {
        Row: {
          created_at: string
          foto_id: string | null
          foto_url: string | null
          id: string
          modelo: string | null
          persona_id: string
          rasgos: Json
          resumen: string | null
          updated_at: string
          user_id: string
          vector: number[] | null
        }
        Insert: {
          created_at?: string
          foto_id?: string | null
          foto_url?: string | null
          id?: string
          modelo?: string | null
          persona_id: string
          rasgos?: Json
          resumen?: string | null
          updated_at?: string
          user_id: string
          vector?: number[] | null
        }
        Update: {
          created_at?: string
          foto_id?: string | null
          foto_url?: string | null
          id?: string
          modelo?: string | null
          persona_id?: string
          rasgos?: Json
          resumen?: string | null
          updated_at?: string
          user_id?: string
          vector?: number[] | null
        }
        Relationships: []
      }
      relaciones: {
        Row: {
          certeza: Database["public"]["Enums"]["certeza_nivel"]
          created_at: string
          id: string
          naturaleza: Database["public"]["Enums"]["relacion_naturaleza"]
          notas: string | null
          pariente_id: string
          persona_id: string
          tipo: Database["public"]["Enums"]["relacion_tipo"]
          user_id: string
        }
        Insert: {
          certeza?: Database["public"]["Enums"]["certeza_nivel"]
          created_at?: string
          id?: string
          naturaleza?: Database["public"]["Enums"]["relacion_naturaleza"]
          notas?: string | null
          pariente_id: string
          persona_id: string
          tipo: Database["public"]["Enums"]["relacion_tipo"]
          user_id: string
        }
        Update: {
          certeza?: Database["public"]["Enums"]["certeza_nivel"]
          created_at?: string
          id?: string
          naturaleza?: Database["public"]["Enums"]["relacion_naturaleza"]
          notas?: string | null
          pariente_id?: string
          persona_id?: string
          tipo?: Database["public"]["Enums"]["relacion_tipo"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relaciones_pariente_id_fkey"
            columns: ["pariente_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relaciones_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      research_tasks: {
        Row: {
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["tarea_estado"]
          id: string
          inference_id: string | null
          person_id: string | null
          tipo: Database["public"]["Enums"]["tarea_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tarea_estado"]
          id?: string
          inference_id?: string | null
          person_id?: string | null
          tipo?: Database["public"]["Enums"]["tarea_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tarea_estado"]
          id?: string
          inference_id?: string | null
          person_id?: string | null
          tipo?: Database["public"]["Enums"]["tarea_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_tasks_inference_id_fkey"
            columns: ["inference_id"]
            isOneToOne: false
            referencedRelation: "generated_inferences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_tasks_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      sugerencias: {
        Row: {
          confianza: number
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["sugerencia_estado"]
          id: string
          origen: string | null
          payload: Json
          persona_id: string | null
          tipo: string
          tipo_externo: string | null
          titulo: string
          updated_at: string
          url_externa: string | null
          user_id: string
        }
        Insert: {
          confianza?: number
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["sugerencia_estado"]
          id?: string
          origen?: string | null
          payload?: Json
          persona_id?: string | null
          tipo: string
          tipo_externo?: string | null
          titulo: string
          updated_at?: string
          url_externa?: string | null
          user_id: string
        }
        Update: {
          confianza?: number
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["sugerencia_estado"]
          id?: string
          origen?: string | null
          payload?: Json
          persona_id?: string | null
          tipo?: string
          tipo_externo?: string | null
          titulo?: string
          updated_at?: string
          url_externa?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variantes_apellido: {
        Row: {
          apellido_base: string
          created_at: string
          id: string
          user_id: string
          variante: string
        }
        Insert: {
          apellido_base: string
          created_at?: string
          id?: string
          user_id: string
          variante: string
        }
        Update: {
          apellido_base?: string
          created_at?: string
          id?: string
          user_id?: string
          variante?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      agent_provider: "gemini" | "openai" | "anthropic"
      agent_status: "queued" | "running" | "done" | "error" | "cancelled"
      app_role: "admin" | "editor" | "lector"
      certeza_nivel: "comprobado" | "probable" | "hipotesis" | "descartado"
      coincidencia_estado:
        | "pendiente"
        | "confirmada"
        | "rechazada"
        | "hipotesis"
        | "fusionada"
      documento_estado: "pendiente" | "transcrito" | "verificado" | "dudoso"
      documento_tipo:
        | "acta_civil"
        | "partida_parroquial"
        | "pasaporte"
        | "lista_pasajeros"
        | "censo"
        | "foto"
        | "certificado"
        | "lapida"
        | "carta"
        | "otro"
      evento_tipo:
        | "nacimiento"
        | "bautismo"
        | "matrimonio"
        | "inmigracion"
        | "viaje"
        | "residencia"
        | "censo"
        | "defuncion"
        | "entierro"
        | "otro"
      hipotesis_estado: "abierta" | "probable" | "confirmada" | "descartada"
      inferencia_estado:
        | "pending"
        | "accepted_as_hypothesis"
        | "rejected"
        | "confirmed"
      relacion_naturaleza: "biologica" | "adoptiva" | "desconocida"
      relacion_tipo: "padre" | "madre" | "conyuge" | "hijo" | "hermano" | "otro"
      sugerencia_estado: "pendiente" | "aceptada" | "rechazada"
      tarea_estado: "pendiente" | "en_proceso" | "encontrado" | "descartado"
      tarea_tipo:
        | "buscar_matrimonio"
        | "buscar_nacimiento"
        | "buscar_defuncion"
        | "buscar_pasajeros"
        | "buscar_parroquial"
        | "otro"
      viva_status: "si" | "no" | "desconocido"
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
      agent_provider: ["gemini", "openai", "anthropic"],
      agent_status: ["queued", "running", "done", "error", "cancelled"],
      app_role: ["admin", "editor", "lector"],
      certeza_nivel: ["comprobado", "probable", "hipotesis", "descartado"],
      coincidencia_estado: [
        "pendiente",
        "confirmada",
        "rechazada",
        "hipotesis",
        "fusionada",
      ],
      documento_estado: ["pendiente", "transcrito", "verificado", "dudoso"],
      documento_tipo: [
        "acta_civil",
        "partida_parroquial",
        "pasaporte",
        "lista_pasajeros",
        "censo",
        "foto",
        "certificado",
        "lapida",
        "carta",
        "otro",
      ],
      evento_tipo: [
        "nacimiento",
        "bautismo",
        "matrimonio",
        "inmigracion",
        "viaje",
        "residencia",
        "censo",
        "defuncion",
        "entierro",
        "otro",
      ],
      hipotesis_estado: ["abierta", "probable", "confirmada", "descartada"],
      inferencia_estado: [
        "pending",
        "accepted_as_hypothesis",
        "rejected",
        "confirmed",
      ],
      relacion_naturaleza: ["biologica", "adoptiva", "desconocida"],
      relacion_tipo: ["padre", "madre", "conyuge", "hijo", "hermano", "otro"],
      sugerencia_estado: ["pendiente", "aceptada", "rechazada"],
      tarea_estado: ["pendiente", "en_proceso", "encontrado", "descartado"],
      tarea_tipo: [
        "buscar_matrimonio",
        "buscar_nacimiento",
        "buscar_defuncion",
        "buscar_pasajeros",
        "buscar_parroquial",
        "otro",
      ],
      viva_status: ["si", "no", "desconocido"],
    },
  },
} as const
