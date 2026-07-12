import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isRealSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'placeholder' && 
  !supabaseUrl.includes('placeholder')
);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are missing. Please check your environment variables.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          category: string
          stock_quantity: number
          min_stock: number
          unit_cost: number
          created_at: string
          created_by?: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          stock_quantity?: number
          min_stock?: number
          unit_cost?: number
          created_at?: string
          created_by?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          stock_quantity?: number
          min_stock?: number
          unit_cost?: number
          created_at?: string
          created_by?: string
        }
      }
      transactions: {
        Row: {
          id: string
          product_id: string
          type: 'in' | 'out'
          quantity: number
          unit_cost: number
          timestamp: string
          user_id: string | null
          user_name: string | null
          note: string | null
        }
        Insert: {
          id?: string
          product_id: string
          type: 'in' | 'out'
          quantity: number
          unit_cost?: number
          timestamp?: string
          user_id?: string | null
          user_name?: string | null
          note?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          type?: 'in' | 'out'
          quantity?: number
          unit_cost?: number
          timestamp?: string
          user_id?: string | null
          user_name?: string | null
          note?: string | null
        }
      }
      laundry_records: {
        Row: {
          id: string
          item_name: string
          quantity_out: number
          quantity_in: number
          unit_cost: number
          total_cost: number
          status: 'out' | 'partial' | 'returned'
          sent_at: string
          returned_at: string | null
          operator_name: string | null
          product_id: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_name: string
          quantity_out: number
          quantity_in?: number
          unit_cost?: number
          total_cost?: number
          status?: 'out' | 'partial' | 'returned'
          sent_at?: string
          returned_at?: string | null
          operator_name?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item_name?: string
          quantity_out?: number
          quantity_in?: number
          unit_cost?: number
          total_cost?: number
          status?: 'out' | 'partial' | 'returned'
          sent_at?: string
          returned_at?: string | null
          operator_name?: string | null
          note?: string | null
          created_at?: string
        }
      }
    }
  }
}
