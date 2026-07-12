'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { useLanguage } from '../../hooks/use-language';
import { supabase, isRealSupabaseConfigured } from '../../lib/supabase';
import { Product, Transaction } from '../../types';
import { 
  ArrowRightLeft, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Building2, 
  FileText, 
  Sparkles, 
  RefreshCw, 
  Info,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  PackagePlus,
  HelpCircle,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

// Define local interfaces for the transfer record
interface WarehouseTransfer {
  id: string;
  document_number: string;
  product_id: string; // 'custom' if custom item
  item_name: string;
  category: string;
  quantity: number;
  source_warehouse: string;
  arrival_date: string;
  operator_name: string;
  status: 'received' | 'pending' | 'quarantine';
  note: string;
  created_at: string;
}

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default function WarehouseTransfersPage() {
  const { user, isAdmin } = useAuth();
  const { language, t } = useLanguage();

  // Core Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [useLocalStorageFallback, setUseLocalStorageFallback] = useState(false);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCustomItem, setIsCustomItem] = useState(false);
  
  // Prefilled operator name based on current logged in user
  const currentOperatorName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator';

  const [formData, setFormData] = useState({
    product_id: '',
    custom_item_name: '',
    category: 'Gudang',
    quantity: 1,
    source_warehouse: 'Custom...',
    custom_source_warehouse: '',
    document_number: '',
    arrival_date: new Date().toISOString().split('T')[0],
    operator_name: currentOperatorName,
    status: 'received' as 'received' | 'pending' | 'quarantine',
    note: ''
  });

  // Unique Sound Synth trigger for acoustic micro-cues
  const playBeep = (freq = 600, duration = 0.1, type: 'sine' | 'square' = 'sine') => {
    if (typeof window === 'undefined') return;
    try {
      // Check user setting for audio alarms in localStorage
      const soundSetting = localStorage.getItem('stockflow_setting_sound_alerts');
      if (soundSetting === 'false') return;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context blocked or not supported
    }
  };

  // Generate clean, deterministic shipping document numbers
  const generateDocumentNumber = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `TRF-${year}-${randomNum}`;
  };

  // Initialize form document number and operator name once user is authenticated
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      document_number: generateDocumentNumber(),
      operator_name: currentOperatorName
    }));
  }, [currentOperatorName]);

  // Fetch initial data
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch products list
      let activeProducts: Product[] = [];
      if (isRealSupabaseConfigured) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true });
        if (error) throw error;
        activeProducts = data || [];
      } else {
        // Fallback to local storage
        const storedProducts = localStorage.getItem('stockflow_local_products') || localStorage.getItem('products');
        if (storedProducts) {
          activeProducts = JSON.parse(storedProducts);
        }
      }
      setProducts(activeProducts);

      // Pre-select first product if available
      if (activeProducts.length > 0) {
        setFormData(prev => ({ ...prev, product_id: activeProducts[0].id }));
      }

      // 2. Fetch warehouse transfers
      let loadedTransfers: WarehouseTransfer[] = [];
      let fallbackTriggered = false;

      if (isRealSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('warehouse_transfers')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (error) {
            // Table might not exist yet, we catch the error gracefully
            console.warn('warehouse_transfers table error, falling back to localStorage:', error);
            fallbackTriggered = true;
          } else {
            loadedTransfers = (data || []).map((item: any) => ({
              ...item,
              product_id: item.product_id || 'custom'
            }));
          }
        } catch (dbErr) {
          console.warn('Supabase query failed, falling back to localStorage:', dbErr);
          fallbackTriggered = true;
        }
      } else {
        fallbackTriggered = true;
      }

      if (fallbackTriggered) {
        setUseLocalStorageFallback(true);
        const storedTransfers = localStorage.getItem('stockflow_local_warehouse_transfers');
        if (storedTransfers) {
          loadedTransfers = JSON.parse(storedTransfers);
        } else {
          // Seed initial data if totally empty
          loadedTransfers = [
            {
              id: 'trf-1',
              document_number: 'TRF-2026-88341',
              product_id: activeProducts[0]?.id || 'custom',
              item_name: activeProducts[0]?.name || 'Handuk Kimono Premium',
              category: activeProducts[0]?.category || 'Linen',
              quantity: 50,
              source_warehouse: 'Gudang Pusat (HQ)',
              arrival_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              operator_name: 'Candra Rusman',
              status: 'received',
              note: 'Stok darurat untuk akhir pekan',
              created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 'trf-2',
              document_number: 'TRF-2026-44129',
              product_id: 'custom',
              item_name: 'Gantungan Baju Kayu (Wood)',
              category: 'Aksesoris',
              quantity: 120,
              source_warehouse: 'Gudang Cabang Utara',
              arrival_date: new Date().toISOString().split('T')[0],
              operator_name: 'System',
              status: 'pending',
              note: 'Barang kustom belum teregistrasi sebagai SKU',
              created_at: new Date().toISOString()
            }
          ];
          localStorage.setItem('stockflow_local_warehouse_transfers', JSON.stringify(loadedTransfers));
        }
      }

      setTransfers(loadedTransfers);
    } catch (err) {
      console.error('Error initializing warehouse transfers component:', err);
      toast.error('Gagal memuat beberapa komponen data.');
    } finally {
      setIsLoading(false);
    }
  };

  // Category listing for custom entries
  const defaultCategories = ['Linen', 'Aksesoris', 'Cairan Kimia', 'Perlengkapan Mandi', 'Lainnya'];

  // All source warehouses list for statistics and filters
  const sourceWarehouses = useMemo(() => {
    const list = Array.from(new Set(transfers.map(t => t.source_warehouse)));
    return ['all', ...list.filter(w => w)];
  }, [transfers]);

  // Compute stats metrics
  const stats = useMemo(() => {
    const totalCount = transfers.length;
    const totalQuantity = transfers.reduce((sum, t) => sum + t.quantity, 0);
    const receivedCount = transfers.filter(t => t.status === 'received').length;
    const pendingCount = transfers.filter(t => t.status === 'pending').length;
    const quarantineCount = transfers.filter(t => t.status === 'quarantine').length;

    return {
      totalCount,
      totalQuantity,
      receivedCount,
      pendingCount,
      quarantineCount
    };
  }, [transfers]);

  // Filter transfers matching search criteria
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const matchesSearch = 
        t.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.document_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.operator_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.note?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesWarehouse = warehouseFilter === 'all' || t.source_warehouse === warehouseFilter;
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

      return matchesSearch && matchesWarehouse && matchesStatus;
    });
  }, [transfers, searchQuery, warehouseFilter, statusFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage);
  const paginatedTransfers = filteredTransfers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle Form Input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Submit transfer form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);

    try {
      // Determine final values based on custom item toggle
      let finalItemId = isCustomItem ? 'custom' : formData.product_id;
      let finalItemName = '';
      let finalCategory = '';

      if (isCustomItem) {
        if (!formData.custom_item_name.trim()) {
          throw new Error(language === 'id' ? 'Nama barang kustom wajib diisi.' : 'Custom item name is required.');
        }
        finalItemName = formData.custom_item_name.trim();
        finalCategory = formData.category;
      } else {
        const selectedProd = products.find(p => p.id === formData.product_id);
        if (!selectedProd) {
          throw new Error(language === 'id' ? 'Silakan pilih produk inventaris.' : 'Please select an inventory product.');
        }
        finalItemName = selectedProd.name;
        finalCategory = selectedProd.category;
      }

      const finalSourceWarehouse = formData.source_warehouse === 'Custom...' 
        ? (formData.custom_source_warehouse.trim() || 'Gudang Eksternal')
        : formData.source_warehouse;

      // Construct transfer entity
      const newTransfer: WarehouseTransfer = {
        id: generateUUID(),
        document_number: formData.document_number || generateDocumentNumber(),
        product_id: finalItemId,
        item_name: finalItemName,
        category: finalCategory,
        quantity: Number(formData.quantity) || 1,
        source_warehouse: finalSourceWarehouse,
        arrival_date: formData.arrival_date,
        operator_name: currentOperatorName,
        status: formData.status,
        note: formData.note.trim(),
        created_at: new Date().toISOString()
      };

      // Perform updates to product stock if RECEIVED
      const isReceived = formData.status === 'received';

      if (isRealSupabaseConfigured) {
        // --- LIVE CLOUD ROUTE ---
        
        // 1. If received & registered product, record as Standard Transaction (which triggers live stock update trigger!)
        if (isReceived && finalItemId !== 'custom') {
          const { error: transError } = await supabase
            .from('transactions')
            .insert([{
              product_id: finalItemId,
              type: 'in',
              quantity: newTransfer.quantity,
              unit_cost: 0, // warehouse transfers do not modify cost base by default
              user_id: user?.id,
              note: `[Transfer Gudang] Asal: ${newTransfer.source_warehouse} | No: ${newTransfer.document_number} | Operator: ${newTransfer.operator_name}`
            }]);
          
          if (transError) throw new Error(`Stock transaction insertion failed: ${transError.message}`);
        }

        // 2. Insert into warehouse_transfers table if supported, otherwise save to local fallback
        if (!useLocalStorageFallback) {
          const dbTransfer = {
            ...newTransfer,
            product_id: newTransfer.product_id === 'custom' ? null : newTransfer.product_id
          };
          const { error: dbError } = await supabase
            .from('warehouse_transfers')
            .insert([dbTransfer]);
          
          if (dbError) {
            console.warn('Failing to insert into warehouse_transfers table, caching in localStorage...', dbError);
            // Save to localStorage so they never lose trace
            const localCopy = [newTransfer, ...transfers];
            localStorage.setItem('stockflow_local_warehouse_transfers', JSON.stringify(localCopy));
            setUseLocalStorageFallback(true);
          }
        } else {
          const localCopy = [newTransfer, ...transfers];
          localStorage.setItem('stockflow_local_warehouse_transfers', JSON.stringify(localCopy));
        }

      } else {
        // --- MOCK LOCALSTORAGE ROUTE ---

        // 1. Update mock product stock if received
        if (isReceived && finalItemId !== 'custom') {
          const storedProducts = localStorage.getItem('stockflow_local_products') || localStorage.getItem('products');
          if (storedProducts) {
            const localProds: Product[] = JSON.parse(storedProducts);
            const prodIdx = localProds.findIndex(p => p.id === finalItemId);
            if (prodIdx !== -1) {
              localProds[prodIdx].stock_quantity += newTransfer.quantity;
              localStorage.setItem('stockflow_local_products', JSON.stringify(localProds));
              localStorage.setItem('products', JSON.stringify(localProds));
            }
          }

          // 2. Insert mock transaction log
          const storedTx = localStorage.getItem('stockflow_local_transactions') || localStorage.getItem('transactions') || '[]';
          const localTxs: any[] = JSON.parse(storedTx);
          localTxs.unshift({
            id: `tx-${Date.now()}`,
            product_id: finalItemId,
            type: 'in',
            quantity: newTransfer.quantity,
            unit_cost: 0,
            timestamp: new Date().toISOString(),
            user_name: newTransfer.operator_name,
            note: `[Transfer Gudang] Asal: ${newTransfer.source_warehouse} | No: ${newTransfer.document_number}`
          });
          localStorage.setItem('stockflow_local_transactions', JSON.stringify(localTxs));
          localStorage.setItem('transactions', JSON.stringify(localTxs));
        }

        // 3. Save transfer record
        const localTransfers = [newTransfer, ...transfers];
        localStorage.setItem('stockflow_local_warehouse_transfers', JSON.stringify(localTransfers));
      }

      toast.success(
        language === 'id' 
          ? 'Transfer barang dari gudang lain berhasil dicatat!' 
          : 'Warehouse transfer successfully recorded!',
        {
          description: isReceived && finalItemId !== 'custom'
            ? (language === 'id' ? 'Stok produk diperbarui secara otomatis.' : 'Product stock levels incremented automatically.')
            : (language === 'id' ? 'Catatan disimpan dalam arsip logs.' : 'Log saved to archive traces.')
        }
      );

      // Play victory sound
      playBeep(523.25, 0.08);
      setTimeout(() => playBeep(659.25, 0.12), 80);

      // Reset form and close
      setFormData(prev => ({
        ...prev,
        custom_item_name: '',
        quantity: 1,
        custom_source_warehouse: '',
        document_number: generateDocumentNumber(),
        note: ''
      }));
      setIsFormOpen(false);
      setIsCustomItem(false);

      // Re-fetch data to render updated levels
      await fetchInitialData();

      // Dispatch event to update other parts of the dashboard
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('stockflow-settings-updated'));
      }
    } catch (err: any) {
      console.error('Error submitting transfer:', err);
      toast.error(err.message || 'Gagal menyimpan catatan transfer.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Delete a transfer log record
  const handleDeleteTransfer = async (id: string) => {
    if (!isAdmin) {
      toast.error(
        language === 'id' 
          ? 'Hanya Administrator yang dapat menghapus riwayat transfer.' 
          : 'Only Administrators are authorized to clear transfer records.'
      );
      return;
    }

    const confirmMsg = language === 'id'
      ? 'Apakah Anda yakin ingin menghapus catatan transfer ini secara permanen dari log? Tindakan ini tidak akan membatalkan revisi stok yang sudah ditambahkan.'
      : 'Are you sure you want to delete this transfer log permanently? This will not revert the inventory stock that was already updated.';

    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return;

    try {
      if (isRealSupabaseConfigured && !useLocalStorageFallback) {
        const { error } = await supabase
          .from('warehouse_transfers')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } else {
        const localList = transfers.filter(t => t.id !== id);
        localStorage.setItem('stockflow_local_warehouse_transfers', JSON.stringify(localList));
      }

      toast.success(language === 'id' ? 'Catatan transfer dihapus.' : 'Transfer log removed.');
      playBeep(300, 0.15, 'square');
      await fetchInitialData();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus catatan.');
    }
  };

  // Export Transfers to CSV spreadsheet
  const handleExportCSV = () => {
    if (filteredTransfers.length === 0) {
      toast.error(language === 'id' ? 'Tidak ada data transfer untuk diekspor.' : 'No transfer data to export.');
      return;
    }

    const headers = [
      language === 'id' ? 'ID' : 'ID',
      language === 'id' ? 'Nomor Dokumen' : 'Document Number',
      language === 'id' ? 'Barang' : 'Item Name',
      language === 'id' ? 'Kategori' : 'Category',
      language === 'id' ? 'Gudang Asal' : 'Source Warehouse',
      language === 'id' ? 'Jumlah' : 'Quantity',
      language === 'id' ? 'Tanggal Masuk' : 'Arrival Date',
      language === 'id' ? 'Operator' : 'Operator',
      language === 'id' ? 'Status' : 'Status',
      language === 'id' ? 'Keterangan' : 'Note'
    ];

    const rows = filteredTransfers.map(t => [
      t.id,
      t.document_number,
      t.item_name,
      t.category,
      t.source_warehouse,
      t.quantity,
      t.arrival_date,
      t.operator_name,
      t.status.toUpperCase(),
      (t.note || '').replace(/,/g, ';')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `warehouse_transfers_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    playBeep(880, 0.1);
    toast.success(language === 'id' ? 'Riwayat transfer berhasil diekspor!' : 'Transfer history exported successfully!');
  };

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-16">
      
      {/* Header Info Block */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[9px] sm:text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">Module 10 / Logistics Sync</span>
            <div className="h-1 w-1 bg-slate-700 rounded-full" />
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">
              {language === 'id' ? 'Aliran Barang Masuk' : 'Inbound Ledger Flow'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {language === 'id' ? 'Transfer Barang Masuk' : 'Inbound Warehouse Transfers'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
            {language === 'id' 
              ? 'Formulir pencatatan barang masuk dari gudang eksternal / cabang lain. Stok produk inventaris terdaftar akan disesuaikan otomatis.' 
              : 'Log and track inventory arrivals transferred from auxiliary warehouses. Registered inventory will automatically adjust.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 text-[10px] sm:text-xs font-bold px-4 py-2.5 sm:py-3.5 rounded-2xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <Download size={14} className="text-indigo-400" />
            <span>{language === 'id' ? 'EKSPOR LAPORAN' : 'EXPORT REPORT'}</span>
          </button>

          <button 
            onClick={() => {
              setIsFormOpen(true);
              playBeep(700, 0.05);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-xs font-bold px-5 py-2.5 sm:py-3.5 rounded-2xl transition-all shadow-xl shadow-indigo-950/50 active:scale-95 cursor-pointer"
          >
            <Plus size={15} />
            <span>{language === 'id' ? 'CATAT BARANG MASUK' : 'RECORD TRANSFER IN'}</span>
          </button>
        </div>
      </div>

      {/* Stats Bento Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111114]/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === 'id' ? 'Total Transaksi' : 'Total Batches'}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-white">{stats.totalCount}</span>
            <span className="text-[10px] text-slate-400 font-mono">logs</span>
          </div>
        </div>

        <div className="bg-[#111114]/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === 'id' ? 'Total Volume Item' : 'Total Units'}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-emerald-400">+{stats.totalQuantity}</span>
            <span className="text-[10px] text-slate-400 font-mono">items</span>
          </div>
        </div>

        <div className="bg-[#111114]/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === 'id' ? 'Status Diterima' : 'Received (Stocked)'}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-white">{stats.receivedCount}</span>
            <span className="text-[10px] text-emerald-500 font-bold font-mono">✔ OK</span>
          </div>
        </div>

        <div className="bg-[#111114]/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{language === 'id' ? 'Tertunda / Karantina' : 'Transit / Quarantine'}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-amber-500">{stats.pendingCount + stats.quarantineCount}</span>
            <span className="text-[10px] text-amber-400 font-bold font-mono">⚡ PENDING</span>
          </div>
        </div>
      </div>

      {/* Database Connection Fallback Information Panel */}
      {useLocalStorageFallback && (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-slate-400 leading-relaxed">
          <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-white uppercase tracking-wider text-[10px]">
              {language === 'id' ? '💡 INFO INTEGRASI STORAGE' : '💡 STORAGE INTEGRATION DETAILS'}
            </p>
            <p>
              {language === 'id'
                ? 'Catatan log transfer disimpan secara aman di browser lokal. Namun, jika Anda memilih untuk menyelaraskan dengan produk inventaris resmi, sistem ini secara otomatis mendaftarkan aliran stok di tabel transaksi Supabase!'
                : 'Transfer log trace is written locally. However, if you bind arrivals to a registered SKU, stock levels and permanent transaction histories are still updated in Supabase cloud.'}
            </p>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-[#111114]/50 backdrop-blur-sm p-4 rounded-3xl border border-white/5">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
          <input 
            type="text" 
            placeholder={language === 'id' ? 'Cari berdasarkan item, nomor dokumen, operator...' : 'Search by item, document code, operator...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-11 pr-5 py-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Warehouse Filter */}
          <div className="flex items-center gap-2 min-w-[160px] flex-1 sm:flex-none">
            <Building2 size={16} className="text-slate-500 ml-1 shrink-0" />
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="flex-1 bg-slate-950 border border-white/5 rounded-2xl px-4 py-3 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
            >
              <option value="all">
                {language === 'id' ? 'Semua Gudang Asal' : 'All Source Warehouses'}
              </option>
              {sourceWarehouses.filter(w => w !== 'all').map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 min-w-[140px] flex-1 sm:flex-none">
            <Filter size={16} className="text-slate-500 ml-1 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 bg-slate-950 border border-white/5 rounded-2xl px-4 py-3 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
            >
              <option value="all">{language === 'id' ? 'Semua Status' : 'All Statuses'}</option>
              <option value="received">{language === 'id' ? 'Diterima' : 'Received'}</option>
              <option value="pending">{language === 'id' ? 'Dalam Perjalanan' : 'In Transit'}</option>
              <option value="quarantine">{language === 'id' ? 'Karantina' : 'Quarantined'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Grid View */}
      <div className="bg-[#111114]/20 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-slate-900/10 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-4 px-6">{language === 'id' ? 'No. Dokumen / SJ' : 'Doc No / Invoice'}</th>
                <th className="py-4 px-6">{language === 'id' ? 'Nama Barang / Kategori' : 'Item Name / Category'}</th>
                <th className="py-4 px-6">{language === 'id' ? 'Gudang Asal' : 'Source'}</th>
                <th className="py-4 px-6 text-center">{language === 'id' ? 'Volume' : 'Qty'}</th>
                <th className="py-4 px-6">{language === 'id' ? 'Tanggal Masuk' : 'Arrival Date'}</th>
                <th className="py-4 px-6">{language === 'id' ? 'Status' : 'Status'}</th>
                <th className="py-4 px-6">{language === 'id' ? 'Petugas' : 'Operator'}</th>
                {isAdmin && <th className="py-4 px-6 text-right">{language === 'id' ? 'Aksi' : 'Action'}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw size={24} className="text-indigo-500 animate-spin" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Scanning logistics logs...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedTransfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto p-6">
                      <div className="p-4 bg-indigo-500/5 rounded-full border border-indigo-500/10 text-indigo-400 mb-4 animate-pulse">
                        <ArrowRightLeft size={32} />
                      </div>
                      <h4 className="text-sm font-bold text-slate-300">
                        {language === 'id' ? 'Riwayat Transfer Kosong' : 'No Transfer Logs'}
                      </h4>
                      <p className="text-slate-500 text-[11px] mt-1">
                        {language === 'id' 
                          ? 'Tidak ada riwayat transfer barang masuk yang cocok dengan kriteria filter saat ini.' 
                          : 'No inbound warehouse transfer record satisfies the current filter constraints.'}
                      </p>
                      {(searchQuery || warehouseFilter !== 'all' || statusFilter !== 'all') && (
                        <button 
                          onClick={() => {
                            setSearchQuery('');
                            setWarehouseFilter('all');
                            setStatusFilter('all');
                          }}
                          className="mt-4 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-indigo-400 rounded-xl font-bold text-[10px] tracking-wider uppercase"
                        >
                          {language === 'id' ? 'Reset Pencarian' : 'Clear Search filters'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.01] transition-colors group">
                    {/* Doc Number */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-slate-500" />
                        <span className="font-mono text-xs font-bold text-white tracking-tight">{t.document_number}</span>
                      </div>
                    </td>

                    {/* Item details */}
                    <td className="py-4 px-6">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {t.item_name}
                          {t.product_id === 'custom' && (
                            <span className="text-[8px] px-1.5 py-0.2 bg-purple-500/15 border border-purple-500/20 text-purple-400 rounded-full uppercase tracking-wider font-bold">
                              Kustom
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium capitalize">{t.category}</div>
                      </div>
                    </td>

                    {/* Source */}
                    <td className="py-4 px-6 font-medium text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-slate-500 shrink-0" />
                        <span className="truncate max-w-[130px]">{t.source_warehouse}</span>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-4 px-6 text-center">
                      <span className="px-2.5 py-1 bg-slate-900 text-emerald-400 font-mono font-black border border-white/5 rounded-lg text-xs">
                        +{t.quantity}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-4 px-6 text-slate-400 font-medium font-mono text-[11px]">
                      {t.arrival_date}
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                        t.status === 'received' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : t.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {t.status === 'received' ? <CheckCircle2 size={10} /> : t.status === 'pending' ? <Clock size={10} /> : <AlertTriangle size={10} />}
                        {t.status === 'received' ? (language === 'id' ? 'Diterima' : 'Received') : t.status === 'pending' ? (language === 'id' ? 'Perjalanan' : 'In Transit') : (language === 'id' ? 'Karantina' : 'Quarantine')}
                      </span>
                    </td>

                    {/* Operator */}
                    <td className="py-4 px-6 text-slate-400 text-[11px] font-medium">
                      <div className="flex items-center gap-1">
                        <User size={12} className="text-slate-500" />
                        <span>{t.operator_name}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleDeleteTransfer(t.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>
              {language === 'id' ? 'Halaman' : 'Page'} {currentPage} {language === 'id' ? 'dari' : 'of'} {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-lg disabled:opacity-30 cursor-pointer text-slate-300"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-lg disabled:opacity-30 cursor-pointer text-slate-300"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Modal Form */}
      <AnimatePresence>
        {isFormOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="fixed inset-0 bg-black z-40 cursor-pointer"
            />

            {/* Form Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-lg bg-[#0F0F12] border-l border-white/5 p-6 sm:p-8 z-50 shadow-2xl flex flex-col h-full overflow-hidden"
            >
              {/* Header drawer */}
              <div className="flex items-center justify-between border-b border-white/5 pb-5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                    <ArrowRightLeft size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-md">
                      {language === 'id' ? 'Form Transfer Barang' : 'Record Inbound Transfer'}
                    </h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                      {formData.document_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded-xl border border-white/5 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                >
                  {language === 'id' ? 'Tutup' : 'Close'}
                </button>
              </div>

              {/* Form scrollable content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-6 space-y-6 pr-1">
                
                {/* 1. Standard SKU vs Custom Switch */}
                <div className="bg-slate-900/30 p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <HelpCircle size={13} className="text-indigo-400" />
                      {language === 'id' ? 'Tipe Registrasi Barang:' : 'Item Registry Mode:'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomItem(!isCustomItem);
                        playBeep(450, 0.05);
                      }}
                      className="px-2 py-1 bg-indigo-600/10 hover:bg-indigo-600/25 text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded border border-indigo-500/20 cursor-pointer"
                    >
                      {isCustomItem 
                        ? (language === 'id' ? 'Ganti ke Produk SKU' : 'Switch to SKU Item')
                        : (language === 'id' ? 'Ganti ke Barang Kustom' : 'Switch to Custom Item')}
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {isCustomItem
                      ? (language === 'id' 
                        ? 'Mode Barang Kustom: Untuk mencatat log kedatangan barang baru yang belum didaftarkan sebagai SKU di daftar inventaris utama Anda.'
                        : 'Custom Mode: Records log entries for external arrivals of materials not yet fully registered inside the core inventory SKU grid.')
                      : (language === 'id'
                        ? 'Mode SKU Resmi: Memilih dari inventaris terdaftar. Jumlah stok produk akan bertambah otomatis begitu transfer selesai diterima.'
                        : 'Official SKU Mode: Choose from registered stock items. Inventory quantity levels will adapt and increment automatically.')}
                  </p>
                </div>

                {/* 2. Product Picker */}
                {!isCustomItem ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <PackageCheck size={14} className="text-indigo-400" />
                      {language === 'id' ? 'Pilih Produk Inventaris:' : 'Select Inventory Product:'}
                    </label>
                    <select
                      name="product_id"
                      value={formData.product_id}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {products.length === 0 ? (
                        <option value="">{language === 'id' ? 'Belum ada produk di inventaris' : 'No products loaded'}</option>
                      ) : (
                        products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.category}) - Stok: {p.stock_quantity}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Custom Item Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <PackagePlus size={14} className="text-purple-400" />
                        {language === 'id' ? 'Nama Barang Kustom:' : 'Custom Item Name:'}
                      </label>
                      <input
                        type="text"
                        name="custom_item_name"
                        value={formData.custom_item_name}
                        onChange={handleInputChange}
                        placeholder={language === 'id' ? 'Contoh: Hanger Kayu Retro' : 'e.g., Wooden Retro Hanger'}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
                        required={isCustomItem}
                      />
                    </div>

                    {/* Custom Item Category */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {language === 'id' ? 'Kategori Barang:' : 'Category:'}
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-semibold focus:outline-none focus:border-purple-500 cursor-pointer"
                      >
                        {defaultCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* 3. Quantity & Arrival Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Quantity */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {language === 'id' ? 'Jumlah (Kuantitas):' : 'Volume Quantity:'}
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      max="10000"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  {/* Arrival Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={13} className="text-indigo-400" />
                      {language === 'id' ? 'Tanggal Masuk:' : 'Arrival Date:'}
                    </label>
                    <input
                      type="date"
                      name="arrival_date"
                      value={formData.arrival_date}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                      required
                    />
                  </div>
                </div>

                {/* 4. Source Warehouse */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Source Warehouse Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 size={13} className="text-indigo-400" />
                      {language === 'id' ? 'Gudang Asal:' : 'Source Warehouse:'}
                    </label>
                    <select
                      name="source_warehouse"
                      value={formData.source_warehouse}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="Custom...">{language === 'id' ? 'Lainnya (Ketik Manual)...' : 'Other (Type Manual)...'}</option>
                    </select>
                  </div>

                  {/* Custom Source Input */}
                  {formData.source_warehouse === 'Custom...' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {language === 'id' ? 'Ketik Gudang Asal:' : 'Enter Source Warehouse:'}
                      </label>
                      <input
                        type="text"
                        name="custom_source_warehouse"
                        value={formData.custom_source_warehouse}
                        onChange={handleInputChange}
                        placeholder="e.g., Gudang Cabang Bandung"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* 5. Document Number & Operator */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Document / Invoice No */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {language === 'id' ? 'Nomor Dokumen / Surat Jalan:' : 'Document No / Invoice:'}
                    </label>
                    <input
                      type="text"
                      name="document_number"
                      value={formData.document_number}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono font-bold focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  {/* Operator */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={13} className="text-amber-500" />
                      {language === 'id' ? 'Petugas Input (Terkunci Otomatis):' : 'Input Operator (Auto Locked):'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="operator_name"
                        value={currentOperatorName}
                        readOnly
                        className="w-full bg-slate-900/50 border border-amber-500/10 rounded-xl px-4 py-3 text-amber-400 text-xs font-bold cursor-not-allowed"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-md font-bold uppercase tracking-wider">
                        {language === 'id' ? 'AUDIT OK' : 'VERIFIED'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 6. Receipt Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {language === 'id' ? 'Status Penerimaan Barang:' : 'Arrival Receipt Status:'}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Received */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, status: 'received' }));
                        playBeep(650, 0.05);
                      }}
                      className={`px-3 py-3 rounded-xl border text-[10px] font-bold uppercase transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        formData.status === 'received'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
                      }`}
                    >
                      <CheckCircle2 size={14} />
                      <span>{language === 'id' ? 'Diterima' : 'Received'}</span>
                    </button>

                    {/* Pending / In Transit */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, status: 'pending' }));
                        playBeep(550, 0.05);
                      }}
                      className={`px-3 py-3 rounded-xl border text-[10px] font-bold uppercase transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        formData.status === 'pending'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
                      }`}
                    >
                      <Clock size={14} />
                      <span>{language === 'id' ? 'Perjalanan' : 'In Transit'}</span>
                    </button>

                    {/* Quarantine */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, status: 'quarantine' }));
                        playBeep(450, 0.05);
                      }}
                      className={`px-3 py-3 rounded-xl border text-[10px] font-bold uppercase transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        formData.status === 'quarantine'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
                      }`}
                    >
                      <AlertTriangle size={14} />
                      <span>{language === 'id' ? 'Karantina' : 'Quarantine'}</span>
                    </button>
                  </div>
                  {formData.status !== 'received' && (
                    <p className="text-[9px] text-amber-500 font-medium leading-normal mt-1 flex items-start gap-1">
                      <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                      <span>
                        {language === 'id'
                          ? 'Perhatian: Stok produk tidak akan bertambah secara otomatis kecuali status diset ke "Diterima".'
                          : 'Attention: Inventory quantities will not modify until status is changed to "Received".'}
                      </span>
                    </p>
                  )}
                </div>

                {/* 7. Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {language === 'id' ? 'Keterangan Tambahan / Catatan:' : 'Additional Remarks / Notes:'}
                  </label>
                  <textarea
                    name="note"
                    value={formData.note}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder={language === 'id' ? 'Contoh: Dikirim dengan truk box nomor polisi B 1234 CD...' : 'e.g., Shipped in delivery van plate no B 1234 CD...'}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

              </form>

              {/* Form submit footer */}
              <div className="border-t border-white/5 pt-5 flex items-center justify-between shrink-0 bg-[#0F0F12]">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-3 bg-slate-900 hover:bg-slate-800 border border-white/5 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {language === 'id' ? 'Batal' : 'Cancel'}
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitLoading}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-950/40 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  <span>{language === 'id' ? 'Simpan Log Transfer' : 'Save Transfer Log'}</span>
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
