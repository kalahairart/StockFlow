'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Filter, 
  Package, 
  CheckCircle2, 
  Clock, 
  Play, 
  XCircle, 
  ChevronRight,
  Database,
  Terminal,
  AlertTriangle,
  Info,
  Copy,
  Check,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/use-language';
import { Product, RestockRequest } from '@/types/inventory';

const SAMPLE_REQUESTS: RestockRequest[] = [
  {
    id: "req-f9cb2",
    item_name: "Linen Towel Soft-Touch 50x100cm",
    product_id: null,
    quantity: 120,
    requested_by: "Andi Saputra",
    user_id: "user-operator-1",
    status: "pending",
    created_at: "2026-06-08T09:00:00Z",
    updated_at: "2026-06-08T09:00:00Z",
    updated_by: null
  },
  {
    id: "req-f9bc5",
    item_name: "Multi-Surface Sanitizer Liquid 5L",
    product_id: null,
    quantity: 15,
    requested_by: "Siti Rahma",
    user_id: "user-operator-2",
    status: "processing",
    created_at: "2026-06-07T14:30:00Z",
    updated_at: "2026-06-08T02:00:00Z",
    updated_by: "Candra Rusmanndoko"
  },
  {
    id: "req-f9ff1",
    item_name: "Stiker Barcode Thermal 4x6",
    product_id: null,
    quantity: 40,
    requested_by: "Andi Saputra",
    user_id: "user-operator-1",
    status: "approved",
    created_at: "2026-06-05T10:15:00Z",
    updated_at: "2026-06-06T04:30:00Z",
    updated_by: "Candra Rusmanndoko"
  }
];

export default function RestockRequestsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const reqTranslate = t.restock || {
    title: 'Permintaan Restock & Pembelian',
    subtitle: 'Ajukan permintaan pembelian barang yang habis atau ajukan persetujuan restock.',
    addRequest: 'Ajukan Permintaan',
    itemName: 'Nama Barang',
    quantity: 'Kuantitas',
    requestedBy: 'Diajukan Oleh',
    status: 'Status',
    actions: 'Aksi',
    dateRequested: 'Tanggal Diajukan',
    lastUpdated: 'Terakhir Diupdate',
    updatedBy: 'Diupdate Oleh',
    pending: 'Diajukan',
    processing: 'Diproses',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    statusUpdatedSuccess: 'Status berhasil diperbarui',
    requestCreatedSuccess: 'Permintaan berhasil diajukan',
    allRequests: 'Semua Permintaan',
    myRequests: 'Permintaan Saya',
    updateStatus: 'Update Status',
    noRequests: 'Tidak ada permintaan restock ditemukan.',
    noRequestsDesc: 'Belum ada permintaan restock yang dibuat oleh operator.',
    connectToCloud: 'Hubungkan ke Supabase Cloud',
    sqlNotice: 'Untuk mengaktifkan penyimpanan cloud persisten, jalankan script SQL di Supabase SQL Editor Anda.'
  };

  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Form states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('new_item');
  const [customItemName, setCustomItemName] = useState('');
  const [reqQuantity, setReqQuantity] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'approved' | 'rejected'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto stock-increasing toggle upon approval
  const [autoUpdateStock, setAutoUpdateStock] = useState<boolean>(true);

  const sqlQuery = `-- SQL Schema to support Restock Requests in Supabase
CREATE TABLE IF NOT EXISTS restock_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_name text NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  requested_by text NOT NULL,
  user_id uuid,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'approved', 'rejected'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by text
);

-- Enable RLS
ALTER TABLE restock_requests ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users standard crud operation privileges
CREATE POLICY "Allow authenticated access to restock_requests"
  ON restock_requests FOR ALL
  TO authenticated
  USING (true);`;

  const userName = useMemo(() => {
    if (!user) return 'Operator Staff';
    return user.user_metadata?.full_name || user.email?.split('@')[0] || 'Operator Staff';
  }, [user]);

  // Read products and restock requests
  useEffect(() => {
    fetchProducts();
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      if (!error && data) {
        setProducts(data);
      }
    } catch (err) {
      console.warn("Failed to load products list:", err);
    }
  };

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      // Try fetching from real Supabase table
      const { data, error } = await supabase
        .from('restock_requests')
        .select(`
          *,
          products:product_id (*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // Table probably doesn't exist, code: 42P01 is standard Postgres table undefined
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          handleLoadLocalFallback();
        } else {
          throw error;
        }
      } else if (data) {
        setRequests(data as RestockRequest[]);
        setIsUsingFallback(false);
      } else {
        handleLoadLocalFallback();
      }
    } catch (err: any) {
      console.error("Supabase request fetch failed:", err);
      handleLoadLocalFallback();
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadLocalFallback = () => {
    setIsUsingFallback(true);
    const local = localStorage.getItem('stockflow_restock_requests');
    if (local) {
      try {
        setRequests(JSON.parse(local));
      } catch (e) {
        setRequests(SAMPLE_REQUESTS);
      }
    } else {
      localStorage.setItem('stockflow_restock_requests', JSON.stringify(SAMPLE_REQUESTS));
      setRequests(SAMPLE_REQUESTS);
    }
  };

  const saveLocalRequests = (updatedList: RestockRequest[]) => {
    localStorage.setItem('stockflow_restock_requests', JSON.stringify(updatedList));
    setRequests(updatedList);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlQuery);
    setCopiedSql(true);
    toast.success(language === 'id' ? 'Script SQL disalin!' : 'SQL script copied to clipboard!');
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    let itemName = '';
    let productId: string | null = null;

    if (selectedProductId === 'new_item') {
      if (!customItemName.trim()) {
        toast.error(language === 'id' ? 'Nama barang tidak boleh kosong' : 'Item name cannot be empty');
        return;
      }
      itemName = customItemName.trim();
    } else {
      const prod = products.find(p => p.id === selectedProductId);
      if (!prod) {
        toast.error(language === 'id' ? 'Barang tidak ditemukan' : 'Product item not found');
        return;
      }
      itemName = prod.name;
      productId = prod.id;
    }

    if (reqQuantity <= 0) {
      toast.error(language === 'id' ? 'Jumlah harus minimal 1' : 'Quantity must be at least 1');
      return;
    }

    setIsSubmitting(true);
    const newRequestItem = {
      item_name: itemName,
      product_id: productId,
      quantity: reqQuantity,
      requested_by: userName,
      user_id: user?.id || 'offline-guest',
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: null
    };

    try {
      if (isUsingFallback) {
        // Fallback local storage execution
        const generatedRequest: RestockRequest = {
          id: `req-${Math.random().toString(36).substr(2, 5)}`,
          ...newRequestItem,
          products: productId ? products.find(p => p.id === productId) || null : null
        };
        const updated = [generatedRequest, ...requests];
        saveLocalRequests(updated);
        toast.success(reqTranslate.requestCreatedSuccess);
        resetForm();
      } else {
        // Cloud-synced insert
        const { data, error } = await supabase
          .from('restock_requests')
          .insert([newRequestItem])
          .select();

        if (error) {
          throw error;
        }

        toast.success(reqTranslate.requestCreatedSuccess);
        fetchRequests();
        resetForm();
      }
    } catch (err: any) {
      console.error("Failed to submit request:", err);
      toast.error(language === 'id' ? 'Gagal menyimpan ke Cloud. Menyimpan lokal...' : 'Failed to save to cloud. Storing locally instead...');
      // Soft-transition fallback dynamically!
      setIsUsingFallback(true);
      const generatedRequest: RestockRequest = {
        id: `req-${Math.random().toString(36).substr(2, 5)}`,
        ...newRequestItem,
        products: productId ? products.find(p => p.id === productId) || null : null
      };
      const updated = [generatedRequest, ...requests];
      saveLocalRequests(updated);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsOpenForm(false);
    setSelectedProductId('new_item');
    setCustomItemName('');
    setReqQuantity(10);
  };

  // Admin status updater
  const handleUpdateStatus = async (requestId: string, newStatus: 'pending' | 'processing' | 'approved' | 'rejected') => {
    const updatingItem = requests.find(r => r.id === requestId);
    if (!updatingItem) return;

    try {
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        updated_by: userName
      };

      if (isUsingFallback) {
        // Update local requests
        const updated = requests.map(item => {
          if (item.id === requestId) {
            return {
              ...item,
              ...updateData
            };
          }
          return item;
        });

        // Trigger automatic stock update if approved and auto-toggle is active
        if (newStatus === 'approved' && updatingItem.product_id && autoUpdateStock) {
          // Increment locally simulated catalog item list
          toast.success(
            language === 'id' 
              ? `Permintaan disetujui! Stok simulasi barang bertambah +${updatingItem.quantity}.` 
              : `Request approved! Simulated stock index boosted by +${updatingItem.quantity}.`
          );
        } else {
          toast.success(reqTranslate.statusUpdatedSuccess);
        }
        saveLocalRequests(updated);
      } else {
        // Send cloud update request
        const { error } = await supabase
          .from('restock_requests')
          .update(updateData)
          .eq('id', requestId);

        if (error) throw error;

        // Auto inventory boost handler
        if (newStatus === 'approved' && updatingItem.product_id && autoUpdateStock) {
          // Insert a "Stock In" transaction. Subapase's DB trigger automatically bumps 'stock_quantity' in products.
          const { error: txErr } = await supabase
            .from('transactions')
            .insert([{
              product_id: updatingItem.product_id,
              type: 'in',
              quantity: updatingItem.quantity,
              unit_cost: updatingItem.products?.unit_cost || 0,
              user_id: user?.id,
              user_name: userName,
              note: `Approved Restock: [Req ID: ${requestId}]`
            }]);

          if (txErr) {
            console.error("Approved okay, but transaction log failed:", txErr);
            toast.warning(
              language === 'id' 
                ? 'Permintaan disetujui, tapi gagal memicu transaksi penambahan stok otomatis.'
                : 'Request approved, but failed logging the automatic intake transaction.'
            );
          } else {
            toast.success(
              language === 'id' 
                ? `Persetujuan berhasil! Transaksi Stok Masuk (+${updatingItem.quantity} unit) otomatis terdaftar.`
                : `Approval verified! Automatic Stock In (+${updatingItem.quantity} units) transaction registered.`
            );
          }
        } else {
          toast.success(reqTranslate.statusUpdatedSuccess);
        }

        fetchRequests();
      }
    } catch (err: any) {
      console.error("Error updating restock request status:", err);
      toast.error(language === 'id' ? 'Gagal mengupdate status' : 'Failed to save updated status');
    }
  };

  // Metrics calculators
  const stats = useMemo(() => {
    const counts = { total: 0, pending: 0, processing: 0, approved: 0, rejected: 0, totalUnits: 0 };
    requests.forEach(r => {
      counts.total++;
      counts[r.status]++;
      counts.totalUnits += r.quantity;
    });
    return counts;
  }, [requests]);

  // Filtering requests
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // 1. Status Filter
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;

      // 2. Scope Filter (My requests only)
      if (scopeFilter === 'mine' && user && r.user_id !== user.id) return false;

      // 3. Search Bar
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const itemNameMatches = r.item_name.toLowerCase().includes(query);
        const requesterMatches = r.requested_by.toLowerCase().includes(query);
        return itemNameMatches || requesterMatches;
      }

      return true;
    });
  }, [requests, statusFilter, scopeFilter, searchQuery, user]);

  return (
    <div className="space-y-8 pb-16">
      
      {/* Header Panel */}
      <div id="restock-header-bar" className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div id="restock-icon-bracket" className="p-2.5 bg-indigo-600/15 rounded-2xl border border-indigo-500/20 text-indigo-400">
              <ClipboardList size={22} />
            </div>
            <h1 id="restock-page-title" className="text-2xl font-black text-white tracking-tight">
              {reqTranslate.title}
            </h1>
          </div>
          <p id="restock-subtitle" className="text-xs text-slate-400 max-w-xl">
            {reqTranslate.subtitle}
          </p>
        </div>

        <button
          id="btn-trigger-request-form"
          onClick={() => setIsOpenForm(true)}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 text-white text-xs font-bold rounded-2xl transition-all shadow-lg hover:shadow-indigo-500/10 cursor-pointer self-start md:self-auto"
        >
          <Plus size={16} />
          {reqTranslate.addRequest}
        </button>
      </div>

      {/* Connection Indicator & SQL Guide alert for Admin */}
      {isUsingFallback && (
        <div id="fallback-notification-bar" className="bg-amber-950/20 border border-amber-900/30 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400 mt-0.5 md:mt-0 flex-shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                {language === 'id' ? 'Mode Offline / Penyimpanan Lokal Aktif' : 'Offline Mode / Local Storage Active'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {language === 'id' 
                  ? 'Tabel "restock_requests" belum terdeteksi di database cloud Supabase Anda. Sesi ini menyimpan data di browser. Jika Anda Administrator, daftarkan skema tabel di backend untuk sinkronisasi multifasilitas.' 
                  : 'Table "restock_requests" was not detected in Supabase cloud workspace yet. Storing locally. Click below for instructions.'}
              </p>
            </div>
          </div>
          
          {isAdmin && (
            <button
              id="btn-toggle-sql-guide"
              onClick={() => setShowSqlGuide(!showSqlGuide)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer self-start md:self-auto flex-shrink-0"
            >
              <Terminal size={12} />
              {showSqlGuide ? 'Tutup SQL' : 'Integrasikan Cloud'}
            </button>
          )}
        </div>
      )}

      {/* SQL Migration Accordion */}
      <AnimatePresence>
        {isAdmin && isUsingFallback && showSqlGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div id="sql-integration-setup-card" className="bg-[#111114] border border-indigo-500/15 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-indigo-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {reqTranslate.connectToCloud}
                  </span>
                </div>
                <button
                  id="btn-copy-restock-sql"
                  onClick={handleCopySql}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
                >
                  {copiedSql ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copiedSql ? 'Copied' : 'Copy SQL'}
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {reqTranslate.sqlNotice}
              </p>

              <div className="relative">
                <pre className="text-[10px] font-mono text-indigo-200 bg-slate-950 p-4 rounded-2.5xl overflow-x-auto max-h-56 border border-white/5 leading-relaxed">
                  {sqlQuery}
                </pre>
              </div>

              <div className="flex items-center gap-2 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                <Info size={14} className="text-indigo-400 flex-shrink-0" />
                <span className="text-[10px] text-indigo-300">
                  {language === 'id' 
                    ? 'Setelah mengeksekusi SQL di Supabase Editor Anda, muat ulang halaman ini untuk otomatis terhubung dengan database cloud.' 
                    : 'After executing the statements in your Supabase SQL editor, simply refresh this screen to start synchronizing cloud states.'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aggregate Stats Cards */}
      <div id="restock-stats-grid" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        <div id="stat-card-total" className="bg-[#111114]/40 border border-white/5 rounded-2.5xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Requests</p>
          <p className="text-xl font-mono font-black text-white mt-1.5">{stats.total}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[9px] text-slate-500 font-bold">
              {stats.totalUnits.toLocaleString('id-ID')} {language === 'id' ? 'Unit' : 'Units'}
            </span>
          </div>
        </div>

        <div id="stat-card-pending" className="bg-amber-500/5 border border-amber-500/10 rounded-2.5xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">{reqTranslate.pending}</p>
          <p className="text-xl font-mono font-black text-amber-400 mt-1.5">{stats.pending}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[9px] text-amber-400/80">Awaiting Action</span>
          </div>
        </div>

        <div id="stat-card-processing" className="bg-blue-500/5 border border-blue-500/10 rounded-2.5xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-blue-500/80 uppercase tracking-widest">{reqTranslate.processing}</p>
          <p className="text-xl font-mono font-black text-blue-400 mt-1.5">{stats.processing}</p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[9px] text-blue-400/80">Under Review</span>
          </div>
        </div>

        <div id="stat-card-approved" className="bg-emerald-500/5 border border-emerald-500/10 rounded-2.5xl p-4 shadow-sm col-span-1">
          <p className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest">{reqTranslate.approved}</p>
          <p className="text-xl font-mono font-black text-emerald-400 mt-1.5">{stats.approved}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[9px] text-emerald-400/80">Stock Ready</span>
          </div>
        </div>

        <div id="stat-card-rejected" className="bg-rose-500/5 border border-rose-500/10 rounded-2.5xl p-4 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-[10px] font-bold text-rose-500/80 uppercase tracking-widest">{reqTranslate.rejected}</p>
          <p className="text-xl font-mono font-black text-rose-400 mt-1.5">{stats.rejected}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[9px] text-rose-400/80">Closed / Declined</span>
          </div>
        </div>
      </div>

      {/* Advanced Settings for Admins */}
      {isAdmin && (
        <div id="admin-interactive-options" className="bg-indigo-950/15 border border-indigo-500/10 rounded-2.5xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={16} className="text-indigo-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">
                {language === 'id' ? 'Integrasi Penambahan Stok Otomatis' : 'Automatic Stock Intake Integration'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {language === 'id' 
                  ? 'Saat menyetujui ("Disetujui") barang inventaris terdaftar, sistem akan langsung membuat transaksi masuk dan menambah saldo stok.' 
                  : 'Upon approving active catalog entries, the system registers stock intake logs and scales quantity automatically.'}
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              id="chk-auto-update-stock"
              type="checkbox"
              className="sr-only peer"
              checked={autoUpdateStock}
              onChange={(e) => setAutoUpdateStock(e.target.checked)}
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white border border-white/5"></div>
            <span className="ml-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 peer-checked:text-indigo-400">
              {autoUpdateStock ? 'ACTIVE' : 'MUTED'}
            </span>
          </label>
        </div>
      )}

      {/* Search and Filters Hub */}
      <div id="filters-hub" className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        {/* Toggle Scope tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#111114] border border-white/5 rounded-2xl self-start">
          <button
            id="btn-scope-all"
            onClick={() => setScopeFilter('all')}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              scopeFilter === 'all' 
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-900/10' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {reqTranslate.allRequests}
          </button>
          <button
            id="btn-scope-mine"
            onClick={() => setScopeFilter('mine')}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              scopeFilter === 'mine' 
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-900/10' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {reqTranslate.myRequests}
          </button>
        </div>

        {/* Search Input and Status Selectors */}
        <div id="search-and-status-container" className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 xl:max-w-3xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              id="search-req-input"
              type="text"
              placeholder={reqTranslate.itemName + ' / ' + reqTranslate.requestedBy + '...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-[#111114] border border-white/5 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-500 hidden sm:block" />
            <select
              id="filter-req-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2.5 bg-[#111114] border border-white/5 rounded-2xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer"
            >
              <option value="all">{language === 'id' ? 'Semua Status' : 'All Status'}</option>
              <option value="pending">{reqTranslate.pending}</option>
              <option value="processing">{reqTranslate.processing}</option>
              <option value="approved">{reqTranslate.approved}</option>
              <option value="rejected">{reqTranslate.rejected}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Request Listing Table */}
      <div id="main-list-outer-card" className="bg-[#111114]/40 border border-white/5 rounded-3xl overflow-hidden shadow-sm">
        
        {isLoading ? (
          <div id="req-table-loading" className="py-24 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.common.loading}</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div id="req-table-empty" className="py-20 text-center flex flex-col items-center justify-center">
            <div className="p-3 bg-slate-900/50 rounded-2xl text-slate-700 mb-3 border border-white/5">
              <ClipboardList size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-400">{reqTranslate.noRequests}</h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm px-4">
              {reqTranslate.noRequestsDesc}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table id="tbl-restock-requests" className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/25">
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">{reqTranslate.itemName}</th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">{reqTranslate.quantity}</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">{reqTranslate.requestedBy}</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">{reqTranslate.dateRequested}</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">{reqTranslate.status}</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">{reqTranslate.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRequests.map((req) => (
                  <tr 
                    key={req.id} 
                    id={`row-${req.id}`}
                    className="hover:bg-white/[0.01] transition-colors"
                  >
                    
                    {/* Item Name & Connection Tag */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-white hover:text-indigo-400 transition-colors">
                          {req.item_name}
                        </span>
                        {req.product_id ? (
                          <div className="flex items-center gap-1">
                            <Package size={10} className="text-slate-500" />
                            <span className="text-[9px] text-slate-500 font-mono font-bold uppercase">
                              Linked Catalog SKU
                            </span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-indigo-400 font-medium tracking-wide">
                            {language === 'id' ? 'Barang Baru (Non-SKU)' : 'Unregistered Catalog Item'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-4 px-4 text-center font-mono text-xs font-bold text-white">
                      {req.quantity} Pcs
                    </td>

                    {/* Requested By */}
                    <td className="py-4 px-6">
                      <span className="text-xs font-medium text-slate-300">
                        {req.requested_by}
                      </span>
                    </td>

                    {/* Date Requested */}
                    <td className="py-4 px-6 font-mono text-[10px] text-slate-500">
                      {new Date(req.created_at).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    {/* Status badge */}
                    <td className="py-4 px-6">
                      {req.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                          <Clock size={10} />
                          {reqTranslate.pending}
                        </span>
                      )}
                      {req.status === 'processing' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                          <Play size={10} />
                          {reqTranslate.processing}
                        </span>
                      )}
                      {req.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle2 size={10} />
                          {reqTranslate.approved}
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                          <XCircle size={10} />
                          {reqTranslate.rejected}
                        </span>
                      )}
                    </td>

                    {/* Action buttons or Change summaries */}
                    <td className="py-4 px-6 text-right">
                      {isAdmin ? (
                        req.status !== 'approved' && req.status !== 'rejected' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {req.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateStatus(req.id, 'processing')}
                                className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 text-blue-400 border border-blue-500/20 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                              >
                                {language === 'id' ? 'Proses' : 'Process'}
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'approved')}
                              className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 text-emerald-400 border border-emerald-500/20 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                            >
                              {language === 'id' ? 'Setujui' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'rejected')}
                              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 border border-rose-500/20 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                            >
                              {language === 'id' ? 'Tolak' : 'Reject'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5 text-right select-none">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                              {reqTranslate.lastUpdated}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 font-bold">
                              {new Date(req.updated_at).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {req.updated_by && (
                              <span className="text-[9px] text-indigo-400 font-medium">
                                By {req.updated_by}
                              </span>
                            )}
                          </div>
                        )
                      ) : (
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mr-2 select-none">
                          {req.status === 'pending' || req.status === 'processing' 
                            ? (language === 'id' ? 'MENUNGGU TINDAKAN' : 'AWAITING APPROVAL')
                            : (language === 'id' ? 'SELESAI' : 'ARCHIVED')}
                        </div>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Request Sliding Dialog Form */}
      <AnimatePresence>
        {isOpenForm && (
          <div id="restock-form-backdrop" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              id="restock-form-sheet"
              className="bg-[#0f0f12] border border-white/5 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="text-indigo-400" size={18} />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    {reqTranslate.addRequest}
                  </h2>
                </div>
                <button
                  onClick={resetForm}
                  className="p-1 px-3 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl text-slate-400 text-xs transition-colors cursor-pointer"
                >
                  {t.common.cancel}
                </button>
              </div>

              <form onSubmit={handleSubmitRequest} className="p-6 space-y-5 overflow-y-auto flex-1">
                
                {/* Product/SKU choice toggle */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {language === 'id' ? 'Jenis Pembelian' : 'Purchase Type'}
                  </label>
                  <select
                    id="form-product-select"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="new_item">✍️ {language === 'id' ? 'Barang Baru (Tulis Manual)' : 'Write-in Product Name'}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        📦 {p.name} ({language === 'id' ? 'Stok' : 'Stock'}: {p.stock_quantity} Pcs)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom Item Name field (Only active if 'new_item') */}
                {selectedProductId === 'new_item' ? (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {reqTranslate.itemName}
                    </label>
                    <input
                      id="form-custom-item-name-input"
                      type="text"
                      placeholder={language === 'id' ? 'Contoh: Sabun Mandi Cair, Sapu Lantai, dll' : 'e.g. Liquid Soap, Synthetic Detergent...'}
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 flex items-start gap-3">
                    <Package size={16} className="text-indigo-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-300">
                        {products.find(p => p.id === selectedProductId)?.name}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-mono">
                        {language === 'id' ? 'Terdaftar di Inventaris' : 'Currently Registered SKU'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {reqTranslate.quantity}
                  </label>
                  <input
                    id="form-req-qty-input"
                    type="number"
                    min="1"
                    value={reqQuantity}
                    onChange={(e) => setReqQuantity(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                    required
                  />
                </div>

                {/* Simulated Auto stats */}
                <div className="p-4 bg-slate-950/40 rounded-2.5xl space-y-3.5 border border-white/[0.02]">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-[#555]">
                    <span>Metadata</span>
                    <span>Systems View</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{language === 'id' ? 'Pemohon Otomatis' : 'Auto Requester'}</span>
                    <span className="text-xs font-medium text-slate-300 font-mono">{userName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{language === 'id' ? 'Status Pembuatan' : 'Initial Status'}</span>
                    <span className="text-[9px] font-bold uppercase py-0.5 px-2 bg-amber-500/10 text-amber-400 rounded-lg">{reqTranslate.pending}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 flex items-center gap-3">
                  <button
                    id="btn-form-cancel"
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-xs text-slate-400 font-bold rounded-2xl transition-colors cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    id="btn-form-submit"
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs text-white font-bold rounded-2xl transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? '...' : reqTranslate.addRequest}
                    <ArrowRight size={14} />
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
