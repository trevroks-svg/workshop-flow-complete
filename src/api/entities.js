/**
 * entities.js
 *
 * A thin wrapper around Supabase that mirrors the base44 SDK's entity API:
 *
 *   entities.PartsRequest.list('-created_at', 100)
 *   entities.PartsRequest.filter({ business_id }, '-created_at', 50)
 *   entities.PartsRequest.get(id)
 *   entities.PartsRequest.create({ ... })
 *   entities.PartsRequest.update(id, { ... })
 *   entities.PartsRequest.delete(id)
 *
 * After migration, replace all `entities.X` calls with `entities.X`.
 */

import { supabase } from '@/api/supabaseClient';

/**
 * Map from base44 entity name → Supabase table name
 */
const TABLE_MAP = {
  PartsRequest:      'parts_requests',
  Business:          'businesses',
  Notification:      'notifications',
  VehicleInspection: 'vehicle_inspections',
  QuoteRequestPhoto: 'quote_request_photos',
  AppSettings:       'app_settings',
  User:              'users',
};

/**
 * Parse a base44-style sort string like '-created_at' into
 * Supabase's { column, ascending } form.
 *
 * Examples:
 *   '-created_at' → { column: 'created_at', ascending: false }
 *   'job_card_number' → { column: 'job_card_number', ascending: true }
 */
const FIELD_MAP = {
  created_at: 'created_at',
  updated_at: 'updated_at',
};

function parseSort(sortStr) {
  if (!sortStr) return null;
  const descending = sortStr.startsWith('-');
  const raw = descending ? sortStr.slice(1) : sortStr;
  const column = FIELD_MAP[raw] ?? raw;
  return { column, ascending: !descending };
}

function makeEntity(tableName) {
  return {
    /** Fetch all rows, optionally sorted and limited */
    async list(sort = '-created_at', limit = 200) {
      let q = supabase.from(tableName).select('*');
      const s = parseSort(sort);
      if (s) q = q.order(s.column, { ascending: s.ascending });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },

    /** Filter by an object of field/value pairs */
    async filter(filters = {}, sort = '-created_at', limit = 200) {
      let q = supabase.from(tableName).select('*');
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          q = q.eq(key, value);
        }
      }
      const s = parseSort(sort);
      if (s) q = q.order(s.column, { ascending: s.ascending });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },

    /** Fetch a single row by ID */
    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    /** Insert a new row */
    async create(payload) {
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /** Update a row by ID */
    async update(id, payload) {
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /** Delete a row by ID */
    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    },
  };
}

/** Drop-in replacement for entities.* */
export const entities = Object.fromEntries(
  Object.entries(TABLE_MAP).map(([entityName, tableName]) => [
    entityName,
    makeEntity(tableName),
  ])
);

// ── Convenience re-exports ────────────────────────────────────────────────────
export const PartsRequest      = entities.PartsRequest;
export const Business          = entities.Business;
export const Notification      = entities.Notification;
export const VehicleInspection = entities.VehicleInspection;
export const QuoteRequestPhoto = entities.QuoteRequestPhoto;
export const AppSettings       = entities.AppSettings;
export const User              = entities.User;
