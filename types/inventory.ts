export interface Product {
  id: string;
  name: string;
  category: string;
  stock_quantity: number;
  min_stock: number;
  unit_cost: number;
  created_at: string;
  created_by?: string;
}

export interface Transaction {
  id: string;
  product_id: string;
  type: 'in' | 'out';
  quantity: number;
  unit_cost: number;
  timestamp: string;
  user_id?: string;
  user_name?: string;
  note?: string;
  products?: Product;
}

export interface MovementData {
  date: string;
  in: number;
  out: number;
}

export interface LaundryRecord {
  id: string;
  item_name: string;
  quantity_out: number;
  quantity_in: number;
  unit_cost: number;
  total_cost: number;
  status: 'out' | 'partial' | 'returned';
  sent_at: string;
  returned_at: string | null;
  operator_name: string | null;
  product_id: string | null;
  note: string | null;
  created_at: string;
}

export interface RestockRequest {
  id: string;
  item_name: string;
  product_id: string | null;
  quantity: number;
  requested_by: string;
  user_id: string | null;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  products?: Product | null;
}

