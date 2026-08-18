import { createClient } from '@supabase/supabase-js';

// Retrieve credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isRealSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'placeholder';

// Real Supabase Client (if keys are supplied)
export const realSupabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Pre-seeded database keys in local storage
const PRODUCTS_KEY = 'stockflow_local_products';
const TRANSACTIONS_KEY = 'stockflow_local_transactions';
const LAUNDRY_KEY = 'stockflow_local_laundry';
const RESTOCK_KEY = 'stockflow_local_restock';
const USERS_KEY = 'stockflow_local_users';
const TRANSFERS_KEY = 'stockflow_local_warehouse_transfers';
const ANNOUNCEMENTS_KEY = 'stockflow_local_announcements';
const ANNOUNCEMENT_READS_KEY = 'stockflow_local_announcement_reads';

// Pre-seed mock data helper
const preseedLocalDB = () => {
  if (typeof window === 'undefined') return;

  // 1. Seed Products
  if (!localStorage.getItem(PRODUCTS_KEY)) {
    const defaultProducts = [
      { id: 'p1', name: 'Handuk Mandi Dewasa (XL)', category: 'Towels', stock_quantity: 45, min_stock: 15, unit_cost: 45000, created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString() },
      { id: 'p2', name: 'Handuk Wajah Gym (Standard)', category: 'Towels', stock_quantity: 120, min_stock: 30, unit_cost: 15000, created_at: new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString() },
      { id: 'p3', name: 'Sabun Cair Sanitizer (5L)', category: 'Consumables', stock_quantity: 8, min_stock: 10, unit_cost: 32000, created_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString() },
      { id: 'p4', name: 'Cairan Pembersih Lantai Lavender', category: 'Consumables', stock_quantity: 22, min_stock: 5, unit_cost: 25000, created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString() },
      { id: 'p5', name: 'Keset Kaki Microfiber Gym', category: 'Linens', stock_quantity: 3, min_stock: 8, unit_cost: 30000, created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString() },
      { id: 'p6', name: 'Tisu Gulung Toilet Premium', category: 'Consumables', stock_quantity: 140, min_stock: 40, unit_cost: 6500, created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString() },
    ];
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(defaultProducts));
  }

  // 2. Seed Transactions for the last 7 days (used for charts!)
  if (!localStorage.getItem(TRANSACTIONS_KEY)) {
    const defaultTransactions = [];
    const now = new Date();
    
    // Generates a nice wave of In/Out flows
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      
      // Seed some receipts
      defaultTransactions.push({
        id: `tx-in-${i}`,
        product_id: i % 2 === 0 ? 'p1' : 'p3',
        type: 'in' as const,
        quantity: Math.floor(Math.random() * 20) + 10,
        unit_cost: i % 2 === 0 ? 45000 : 32000,
        timestamp: new Date(date.getTime() - 4 * 3600 * 1000).toISOString(),
        user_name: 'Candra Admin',
        note: 'Stok masuk bulanan reguler'
      });

      // Seed some outflows
      defaultTransactions.push({
        id: `tx-out-${i}`,
        product_id: i % 2 === 0 ? 'p2' : 'p6',
        type: 'out' as const,
        quantity: Math.floor(Math.random() * 25) + 5,
        unit_cost: i % 2 === 0 ? 15000 : 6500,
        timestamp: new Date(date.getTime() + 2 * 3600 * 1000).toISOString(),
        user_name: 'Staff Gym',
        note: 'Pengambilan harian untuk operasional'
      });
    }
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(defaultTransactions));
  }

  // 3. Seed Laundry Records
  if (!localStorage.getItem(LAUNDRY_KEY)) {
    const defaultLaundry = [
      {
        id: 'l1',
        item_name: 'Handuk Mandi Dewasa (XL)',
        quantity_out: 40,
        quantity_in: 40,
        unit_cost: 3500,
        total_cost: 140000,
        status: 'returned' as const,
        sent_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        returned_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        operator_name: 'Candra Admin',
        product_id: 'p1',
        note: 'Pencucian kilat wangi lavender',
        created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'l2',
        item_name: 'Handuk Wajah Gym (Standard)',
        quantity_out: 85,
        quantity_in: 0,
        unit_cost: 2000,
        total_cost: 170000,
        status: 'out' as const,
        sent_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        returned_at: null,
        operator_name: 'Staff Gym',
        product_id: 'p2',
        note: 'Pembersihan steril noda keringat',
        created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
      }
    ];
    localStorage.setItem(LAUNDRY_KEY, JSON.stringify(defaultLaundry));
  }

  // 4. Seed Restock Requests
  if (!localStorage.getItem(RESTOCK_KEY)) {
    const defaultRestock = [
      {
        id: 'r1',
        item_name: 'Sabun Cair Sanitizer (5L)',
        product_id: 'p3',
        quantity: 15,
        requested_by: 'Staff Gym',
        user_id: 'u2',
        status: 'pending' as const,
        created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        updated_by: null
      },
      {
        id: 'r2',
        item_name: 'Keset Kaki Microfiber Gym',
        product_id: 'p5',
        quantity: 10,
        requested_by: 'Candra Admin',
        user_id: 'u1',
        status: 'approved' as const,
        created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        updated_by: 'Candra Admin'
      }
    ];
    localStorage.setItem(RESTOCK_KEY, JSON.stringify(defaultRestock));
  }

  // 5. Seed Users
  if (!localStorage.getItem(USERS_KEY)) {
    const defaultUsers = [
      { id: 'u1', email: 'candrarusmanndoko@gmail.com', full_name: 'Candra Rusman', role: 'admin', created_at: new Date().toISOString() },
      { id: 'u2', email: 'operator@stockflow.com', full_name: 'Staff Gym Attendance', role: 'operator', created_at: new Date().toISOString() }
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
  }

  // 6. Seed Announcements
  if (!localStorage.getItem(ANNOUNCEMENTS_KEY)) {
    const defaultAnnouncements = [
      {
        id: 'ann-1',
        title: 'Pemeliharaan Sistem & SOP Pengeluaran Stok Baru',
        content: 'Perhatian untuk seluruh staf Gym Attendance & Engineering: Mulai minggu ini, setiap pencatatan stok keluar wajib menyertakan foto/dokumen serah terima. Selain itu, pemeliharaan server database cloud akan dilakukan pada hari Minggu pukul 23:00 WIB.',
        type: 'urgent',
        target_role: 'all',
        is_active: true,
        created_by: 'Candra Rusman (Super Admin)',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'ann-2',
        title: 'Jadwal Kalibrasi Alat Mesin Laundry & Perangkat Gym',
        content: 'Tim Engineering dijadwalkan melakukan inspeksi rutin pada mesin cuci komersial dan sistem filtrasi air pada hari Rabu pagi. Mohon koordinasi dengan tim operasional lantai.',
        type: 'maintenance',
        target_role: 'engineering',
        is_active: true,
        created_by: 'Super Admin',
        created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      }
    ];
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(defaultAnnouncements));
  }

  // 7. Seed Announcement Reads History
  if (!localStorage.getItem(ANNOUNCEMENT_READS_KEY)) {
    const defaultReads = [
      {
        id: 'read-1',
        announcement_id: 'ann-1',
        user_id: 'u2',
        user_name: 'Staff Gym Attendance',
        user_email: 'operator@stockflow.com',
        user_role: 'operator',
        read_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
      },
      {
        id: 'read-2',
        announcement_id: 'ann-2',
        user_id: 'u3',
        user_name: 'Budi Santoso (Eng)',
        user_email: 'engineering@stockflow.com',
        user_role: 'engineering',
        read_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
      }
    ];
    localStorage.setItem(ANNOUNCEMENT_READS_KEY, JSON.stringify(defaultReads));
  }
};

// Execute preseed on import
if (typeof window !== 'undefined') {
  preseedLocalDB();
}

// Custom mock chain query builder class for complete offline operations
class MockSupabaseQueryBuilder {
  private key: string;
  private filters: Array<(item: any) => boolean> = [];
  private orderField: string = '';
  private orderAsc: boolean = true;
  private singleResult: boolean = false;

  constructor(tableName: string) {
    if (tableName === 'products') this.key = PRODUCTS_KEY;
    else if (tableName === 'transactions') this.key = TRANSACTIONS_KEY;
    else if (tableName === 'laundry_records') this.key = LAUNDRY_KEY;
    else if (tableName === 'restock_requests') this.key = RESTOCK_KEY;
    else if (tableName === 'users' || tableName === 'user_sync') this.key = USERS_KEY;
    else if (tableName === 'warehouse_transfers') this.key = TRANSFERS_KEY;
    else if (tableName === 'announcements') this.key = ANNOUNCEMENTS_KEY;
    else if (tableName === 'announcement_reads') this.key = ANNOUNCEMENT_READS_KEY;
    else this.key = tableName;
  }

  private getData(): any[] {
    const str = localStorage.getItem(this.key);
    return str ? JSON.parse(str) : [];
  }

  private saveData(data: any[]) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  select(columns: string = '*') {
    // In our simplified mock, we return the full objects
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push(item => item[field] === value);
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push(item => item[field] >= value);
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push(item => item[field] <= value);
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}) {
    this.orderField = field;
    this.orderAsc = options.ascending !== false;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  // Terminal actions in query chains
  async then(resolve: (value: any) => void) {
    let data = this.getData();

    // Apply filters
    this.filters.forEach(filter => {
      data = data.filter(filter);
    });

    // Apply sorting
    if (this.orderField) {
      data.sort((a, b) => {
        const aVal = a[this.orderField];
        const bVal = b[this.orderField];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return this.orderAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return this.orderAsc ? aVal - bVal : bVal - aVal;
        }
        return 0;
      });
    }

    // Attach joint tables (e.g. products inside transactions)
    if (this.key === TRANSACTIONS_KEY) {
      const products = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
      data = data.map(tx => ({
        ...tx,
        products: products.find((p: any) => p.id === tx.product_id) || null
      }));
    } else if (this.key === RESTOCK_KEY) {
      const products = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
      data = data.map(req => ({
        ...req,
        products: products.find((p: any) => p.id === req.product_id) || null
      }));
    }

    if (this.singleResult) {
      resolve({ data: data[0] || null, error: null });
    } else {
      resolve({ data, error: null });
    }
  }

  async insert(items: any[]) {
    const data = this.getData();
    const newItems = items.map(item => {
      const id = item.id || `local-${Math.random().toString(36).substring(2, 9)}`;
      const created_at = item.created_at || new Date().toISOString();
      const updated_at = item.updated_at || created_at;
      return { id, created_at, updated_at, ...item };
    });

    const updatedData = [...data, ...newItems];
    this.saveData(updatedData);

    // If transaction is recorded, update product stock locally!
    if (this.key === TRANSACTIONS_KEY) {
      const products = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
      newItems.forEach(tx => {
        const product = products.find((p: any) => p.id === tx.product_id);
        if (product) {
          if (tx.type === 'in') {
            product.stock_quantity += tx.quantity;
            if (tx.unit_cost > 0) product.unit_cost = tx.unit_cost;
          } else {
            product.stock_quantity = Math.max(0, product.stock_quantity - tx.quantity);
          }
        }
      });
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    }

    return {
      data: this.singleResult ? newItems[0] : newItems,
      error: null,
      select: () => ({
        single: async () => ({ data: newItems[0], error: null })
      })
    };
  }

  async update(updateObj: any) {
    let data = this.getData();
    let updatedCount = 0;

    data = data.map(item => {
      // Check if item matches current query filters
      let matches = true;
      this.filters.forEach(filter => {
        if (!filter(item)) matches = false;
      });

      if (matches) {
        updatedCount++;
        return { ...item, ...updateObj, updated_at: new Date().toISOString() };
      }
      return item;
    });

    this.saveData(data);

    // Trigger local updates for laundry dispatches or restocks
    if (this.key === LAUNDRY_KEY && updateObj.status === 'returned') {
      // Find the laundry record
      let dataCheck = this.getData();
      this.filters.forEach(f => { dataCheck = dataCheck.filter(f); });
      const record = dataCheck[0];
      if (record && record.product_id) {
        const products = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
        const p = products.find((prod: any) => prod.id === record.product_id);
        if (p) {
          p.stock_quantity += updateObj.quantity_in || record.quantity_out;
          localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));

          // Also record a transaction for the returned stock
          const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
          transactions.push({
            id: `tx-laundry-${Date.now()}`,
            product_id: record.product_id,
            type: 'in',
            quantity: updateObj.quantity_in || record.quantity_out,
            unit_cost: record.unit_cost,
            timestamp: new Date().toISOString(),
            user_name: 'System laundry',
            note: `Pengembalian laundry batch ${record.item_name}`
          });
          localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
        }
      }
    }

    return { data, error: null };
  }

  async delete() {
    let data = this.getData();
    let originalCount = data.length;

    // We filter OUT anything that matches the filters (to delete them)
    data = data.filter(item => {
      let matches = true;
      this.filters.forEach(filter => {
        if (!filter(item)) matches = false;
      });
      return !matches; // Delete item if it matches the deletion criteria
    });

    this.saveData(data);
    return { data, error: null };
  }
}

// Complete mock client matching Supabase structure
export const mockSupabase = {
  from(tableName: string) {
    return new MockSupabaseQueryBuilder(tableName);
  },
  auth: {
    async getSession() {
      if (typeof window === 'undefined') return { data: { session: null }, error: null };
      
      const loggedInUserStr = localStorage.getItem('stockflow_active_user');
      if (loggedInUserStr) {
        try {
          const user = JSON.parse(loggedInUserStr);
          return { data: { session: { user } }, error: null };
        } catch (e) {
          return { data: { session: null }, error: null };
        }
      }
      return { data: { session: null }, error: null };
    },
    onAuthStateChange(callback: (event: string, session: any) => void) {
      // Register custom auth change listener in storage
      const listener = () => {
        const userStr = localStorage.getItem('stockflow_active_user');
        const session = userStr ? { user: JSON.parse(userStr) } : null;
        callback('SIGNED_IN', session);
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('stockflow-auth-change', listener);
      }

      return {
        data: {
          subscription: {
            unsubscribe() {
              if (typeof window !== 'undefined') {
                window.removeEventListener('stockflow-auth-change', listener);
              }
            }
          }
        }
      };
    },
    async signInWithPassword({ email, password }: any) {
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const foundUser = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
      
      if (foundUser) {
        // Construct standard Auth User object
        const authUser = {
          id: foundUser.id,
          email: foundUser.email,
          user_metadata: {
            full_name: foundUser.full_name,
            role: foundUser.role
          }
        };
        localStorage.setItem('stockflow_active_user', JSON.stringify(authUser));
        window.dispatchEvent(new Event('stockflow-auth-change'));
        return { data: { user: authUser }, error: null };
      }

      // If not pre-seeded, register dynamically
      const authUser = {
        id: `u-${Math.random().toString(36).substring(2, 9)}`,
        email: email,
        user_metadata: {
          full_name: email.split('@')[0],
          role: email.includes('admin') || email === 'candrarusmanndoko@gmail.com' ? 'admin' : 'operator'
        }
      };
      
      // Save to users list
      users.push({
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata.full_name,
        role: authUser.user_metadata.role,
        created_at: new Date().toISOString()
      });
      localStorage.setItem(USERS_KEY, JSON.stringify(users));

      localStorage.setItem('stockflow_active_user', JSON.stringify(authUser));
      window.dispatchEvent(new Event('stockflow-auth-change'));
      return { data: { user: authUser }, error: null };
    },
    async signUp({ email, password, options }: any) {
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const full_name = options?.data?.full_name || email.split('@')[0];
      const role = email.includes('admin') || email === 'candrarusmanndoko@gmail.com' ? 'admin' : 'operator';

      const authUser = {
        id: `u-${Math.random().toString(36).substring(2, 9)}`,
        email,
        user_metadata: { full_name, role }
      };

      users.push({
        id: authUser.id,
        email: authUser.email,
        full_name,
        role,
        created_at: new Date().toISOString()
      });

      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      localStorage.setItem('stockflow_active_user', JSON.stringify(authUser));
      window.dispatchEvent(new Event('stockflow-auth-change'));
      return { data: { user: authUser }, error: null };
    },
    async signOut() {
      localStorage.removeItem('stockflow_active_user');
      window.dispatchEvent(new Event('stockflow-auth-change'));
      return { error: null };
    }
  }
};

// Main Export Client
export const supabase = isRealSupabaseConfigured ? realSupabase : (mockSupabase as any);
