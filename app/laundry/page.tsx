'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  WashingMachine, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Calendar,
  User,
  Coins,
  Package,
  History,
  Box,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Layers,
  Shirt,
  Info,
  Check,
  RefreshCw,
  FolderMinus,
  CheckSquare
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { LaundryRecord, Product } from '@/types/inventory';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/use-language';

interface DispatchItem {
  name: string;
  qty_out: number;
  unit_cost: number;
  product_id: string; // linked product
  enabled: boolean;
}

interface ReturnItem {
  name: string;
  qty_out: number;
  qty_in: number;
  qty_returning_now: number; // current return input
  unit_cost: number;
  product_id: string | null;
}

export default function LaundryPage() {
  const { user, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  
  const [records, setRecords] = useState<LaundryRecord[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals & Expansion
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LaundryRecord | null>(null);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // New multi-item dispatch state
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>([]);
  const [globalNote, setGlobalNote] = useState('');
  const [deductStock, setDeductStock] = useState(true);

  // Return items intermediate state
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnDeductStock, setReturnDeductStock] = useState(true);

  useEffect(() => {
    fetchRecords();
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;
      setInventoryProducts(data || []);
    } catch (err) {
      console.error('Inventory fetch error:', err);
    }
  };

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('laundry_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Preset prices and items generator
  const initializeDispatchForm = () => {
    const defaultPresets = [
      { name: 'Bath Towel', unit_cost: 3000, key: 'bath' },
      { name: 'Pool Towel', unit_cost: 4000, key: 'pool' },
      { name: 'Baju', unit_cost: 5000, key: 'baju' },
      { name: 'Kain Lap', unit_cost: 1500, key: 'lap' },
      { name: 'Kimono', unit_cost: 6000, key: 'kimono' }
    ];

    const mappedPresets: DispatchItem[] = defaultPresets.map(preset => {
      // Find matching product in inventory based on substrings
      const match = inventoryProducts.find(p => 
        p.name.toLowerCase().includes(preset.key) || 
        (preset.key === 'lap' && p.name.toLowerCase().includes('kain')) ||
        (preset.key === 'baju' && p.name.toLowerCase().includes('pakaian'))
      );

      return {
        name: preset.name,
        qty_out: 0,
        unit_cost: match ? Number(match.unit_cost) || preset.unit_cost : preset.unit_cost,
        product_id: match ? match.id : '',
        enabled: false
      };
    });

    setDispatchItems(mappedPresets);
    setGlobalNote('');
    setDeductStock(true);
    setIsModalOpen(true);
  };

  const addCustomItemRow = () => {
    setDispatchItems([
      ...dispatchItems,
      {
        name: language === 'id' ? 'Barang Custom' : 'Custom Linen Item',
        qty_out: 1,
        unit_cost: 2000,
        product_id: '',
        enabled: true
      }
    ]);
  };

  const handleCreateGroupDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Extract checked and active items
    const activeItems = dispatchItems.filter(item => item.enabled && item.qty_out > 0);
    
    if (activeItems.length === 0) {
      toast.error(
        language === 'id' 
          ? 'Pilih minimal satu jenis barang dengan jumlah keluar > 0' 
          : 'Please select at least one item type with a quantity out > 0.'
      );
      return;
    }

    try {
      const operatorName = user?.user_metadata?.full_name || user?.email || 'System';
      
      // Calculate sums
      const totalQuantityOut = activeItems.reduce((acc, item) => acc + item.qty_out, 0);
      const totalCombinedCost = activeItems.reduce((acc, item) => acc + (item.qty_out * item.unit_cost), 0);
      const averageUnitCost = totalQuantityOut > 0 ? totalCombinedCost / totalQuantityOut : 0;
      
      // Build a nice concise display title summarizing active ingredients
      const summarizedName = activeItems
        .map(item => `${item.name} (${item.qty_out} Pcs)`)
        .join(', ');

      // Build structured detail inside the notes list
      const notePayload = {
        is_multi_item: true,
        deduct_stock: deductStock,
        user_note: globalNote,
        items: activeItems.map(item => ({
          name: item.name,
          qty_out: item.qty_out,
          qty_in: 0,
          unit_cost: item.unit_cost,
          product_id: item.product_id || null
        }))
      };

      const { data: recordData, error } = await supabase
        .from('laundry_records')
        .insert([{
          item_name: summarizedName.length > 250 ? summarizedName.slice(0, 247) + '...' : summarizedName,
          quantity_out: totalQuantityOut,
          quantity_in: 0,
          unit_cost: averageUnitCost,
          total_cost: totalCombinedCost,
          status: 'out',
          sent_at: new Date().toISOString(),
          operator_name: operatorName,
          product_id: activeItems[0]?.product_id || null, // represent main linked product
          note: JSON.stringify(notePayload)
        }])
        .select();

      if (error) throw error;

      // Deep Stock integration: subtract available stock immediately if mapped & preferred
      if (deductStock) {
        const transactionsToInsert = activeItems
          .filter(item => item.product_id)
          .map(item => ({
            product_id: item.product_id,
            type: 'out' as const,
            quantity: item.qty_out,
            unit_cost: item.unit_cost,
            timestamp: new Date().toISOString(),
            user_id: user?.id || null,
            user_name: operatorName,
            note: `[Laundry Dispatch] Sent ${item.qty_out} ${item.name} for sanitation cleaning`
          }));

        if (transactionsToInsert.length > 0) {
          const { error: txErr } = await supabase
            .from('transactions')
            .insert(transactionsToInsert);
          
          if (txErr) {
            console.error('Dispatch transaction error:', txErr);
          }
        }
      }

      toast.success(
        language === 'id' 
          ? `Batch Laundry Dikirim: ${totalQuantityOut} Unit` 
          : `Laundry Batch Dispatched: ${totalQuantityOut} units`,
        {
          description: language === 'id' 
            ? 'Pencatatan pengiriman laundry berhasil terekam.' 
            : 'Activity entered into the sanitization tracking cycle.'
        }
      );

      // Re-fetch datasets
      setIsModalOpen(false);
      await fetchRecords();
      await fetchInventory();
    } catch (err: any) {
      toast.error('Failed to create laundry dispatch: ' + err.message);
    }
  };

  // Set up returns state when modal opens
  const openReturnModal = (record: LaundryRecord) => {
    setSelectedRecord(record);
    
    let isMulti = false;
    let fallbackItems: ReturnItem[] = [];
    let deductStockOnReturn = true;

    if (record.note) {
      try {
        const parsed = JSON.parse(record.note);
        if (parsed && typeof parsed === 'object' && parsed.is_multi_item) {
          isMulti = true;
          deductStockOnReturn = parsed.deduct_stock !== false;
          fallbackItems = parsed.items.map((item: any) => ({
            name: item.name,
            qty_out: item.qty_out,
            qty_in: item.qty_in || 0,
            qty_returning_now: item.qty_out - (item.qty_in || 0), // default to max full return
            unit_cost: item.unit_cost || 0,
            product_id: item.product_id || null
          }));
        }
      } catch (e) {
        // legacy ignore
      }
    }

    if (!isMulti) {
      fallbackItems = [{
        name: record.item_name,
        qty_out: record.quantity_out,
        qty_in: record.quantity_in,
        qty_returning_now: record.quantity_out - record.quantity_in,
        unit_cost: record.unit_cost,
        product_id: record.product_id
      }];
    }

    setReturnItems(fallbackItems);
    setReturnDeductStock(deductStockOnReturn);
    setIsReturnModalOpen(true);
  };

  const handleReturnActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    // Validate quantities
    const overReturned = returnItems.some(item => {
      const remaining = item.qty_out - item.qty_in;
      return item.qty_returning_now > remaining || item.qty_returning_now < 0;
    });

    if (overReturned) {
      toast.error(
        language === 'id' 
          ? 'Kuantitas pengembalian melebihi jumlah barang yang belum kembali.' 
          : 'Return quantities cannot exceed outstanding items out.'
      );
      return;
    }

    const totalReturningNow = returnItems.reduce((acc, item) => acc + item.qty_returning_now, 0);
    if (totalReturningNow === 0) {
      toast.error(
        language === 'id' 
          ? 'Masukkan jumlah barang yang akan dikembalikan.' 
          : 'Please enter a return quantity > 0 for at least one item.'
      );
      return;
    }

    try {
      const operatorName = user?.user_metadata?.full_name || user?.email || 'System';
      
      // Calculate returned totals
      const updatedItems = returnItems.map(item => ({
        ...item,
        qty_in: item.qty_in + item.qty_returning_now
      }));

      const totalQuantityIn = updatedItems.reduce((acc, item) => acc + item.qty_in, 0);
      const isCompleted = updatedItems.every(item => item.qty_in >= item.qty_out);
      const newStatus = isCompleted ? 'returned' as const : 'partial' as const;

      // Build updated JSON note if multi item
      let updatedNote = selectedRecord.note;
      try {
        if (selectedRecord.note) {
          const parsed = JSON.parse(selectedRecord.note);
          if (parsed && typeof parsed === 'object' && parsed.is_multi_item) {
            parsed.items = updatedItems.map(item => ({
              name: item.name,
              qty_out: item.qty_out,
              qty_in: item.qty_in,
              unit_cost: item.unit_cost,
              product_id: item.product_id
            }));
            updatedNote = JSON.stringify(parsed);
          }
        }
      } catch (e) {
        // legacy, keep simple
      }

      const { error } = await supabase
        .from('laundry_records')
        .update({
          quantity_in: totalQuantityIn,
          status: newStatus,
          returned_at: new Date().toISOString(),
          note: updatedNote
        })
        .eq('id', selectedRecord.id);

      if (error) throw error;

      // Integrate Returns returning to warehouse stock
      if (returnDeductStock) {
        // Create an inventory transaction 'in' for each returning line
        const transactionsToInsert = returnItems
          .filter(item => item.product_id && item.qty_returning_now > 0)
          .map(item => ({
            product_id: item.product_id as string,
            type: 'in' as const,
            quantity: item.qty_returning_now,
            unit_cost: item.unit_cost,
            timestamp: new Date().toISOString(),
            user_id: user?.id || null,
            user_name: operatorName,
            note: `[Laundry Return] Restored ${item.qty_returning_now} ${item.name} from sanitation cycle`
          }));

        if (transactionsToInsert.length > 0) {
          const { error: txErr } = await supabase
            .from('transactions')
            .insert(transactionsToInsert);
          
          if (txErr) console.error('Return transaction error:', txErr);
        }
      }

      toast.success(
        language === 'id' 
          ? 'Pengembalian Laundry Berhasil Dicatatkan!' 
          : 'Laundry Return Registered!',
        {
          description: language === 'id' 
            ? `Berhasil mengembalikan ${totalReturningNow} jenis unit ke kasir inventaris.` 
            : `Successfully restocked ${totalReturningNow} units back into catalog.`
        }
      );

      setIsReturnModalOpen(false);
      setSelectedRecord(null);
      await fetchRecords();
      await fetchInventory();
    } catch (err: any) {
      toast.error('Failed to log returns: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast.error(
        language === 'id' ? 'Akses Ditolak' : 'Access Denied', 
        {
          description: language === 'id' 
            ? 'Hanya administrator yang memiliki wewenang untuk menghapus log laundry.' 
            : 'Only administrators have authority to delete laundry logs.',
        }
      );
      return;
    }
    
    try {
      const { error } = await supabase
        .from('laundry_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success(
        language === 'id' ? 'Data Berhasil Dihapus' : 'Record Deleted', 
        {
          description: language === 'id' 
            ? 'Log operasional laundry telah dihapus dari riwayat sistem.' 
            : 'Laundry operation record has been cleared from system history.',
        }
      );
      setDeleteTargetId(null);
      await fetchRecords();
    } catch (err: any) {
      toast.error(
        language === 'id' ? 'Gagal Menghapus Data' : 'Delete Failed',
        {
          description: err.message
        }
      );
    }
  };

  const stats = useMemo(() => {
    return {
      totalItemsOut: records.reduce((acc, r) => acc + (r.status !== 'returned' ? r.quantity_out - r.quantity_in : 0), 0),
      warehouseStock: inventoryProducts
        .filter(p => {
          const cat = p.category?.toLowerCase() || '';
          return cat === 'towel' || cat === 'linen' || cat === 'clothing' || cat === 'laundry' || cat === 'apparel';
        })
        .reduce((acc, p) => acc + (p.stock_quantity || 0), 0),
      totalCost: records.reduce((acc, r) => acc + (Number(r.total_cost) || 0), 0),
      pendingBatches: records.filter(r => r.status !== 'returned').length
    };
  }, [records, inventoryProducts]);

  const totalPages = Math.ceil(records.length / itemsPerPage);
  const paginatedRecords = records.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Return icons based on custom preset names
  const getItemIcon = (name: string) => {
    const lName = name.toLowerCase();
    if (lName.includes('towel') || lName.includes('handuk')) return Layers;
    if (lName.includes('baju') || lName.includes('shirt') || lName.includes('pakaian')) return Shirt;
    if (lName.includes('lap') || lName.includes('rag') || lName.includes('cloth')) return CheckSquare;
    if (lName.includes('kimono') || lName.includes('bathrobe')) return Shirt;
    return Package;
  };

  return (
    <div className="min-h-screen bg-[#050505] p-4 sm:p-8 pt-20">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <WashingMachine className="text-indigo-400" size={24} />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
                Laundry <span className="text-indigo-500">Ops</span>
              </h1>
            </div>
            <p className="text-slate-500 font-medium text-sm tracking-wide">
              {t.laundry.subtitle}
            </p>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={initializeDispatchForm}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 group cursor-pointer"
            >
              <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
              {t.laundry.newBatch.toUpperCase()}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard 
            icon={Box} 
            label={language === 'id' ? 'Stok Linen Gudang' : 'Linen Store Stock'} 
            value={stats.warehouseStock.toString()} 
            color="text-blue-400"
            bgColor="bg-blue-500/10"
          />
          <StatCard 
            icon={ArrowUpRight} 
            label={t.laundry.itemsInCycle} 
            value={stats.totalItemsOut.toString()} 
            color="text-indigo-400"
            bgColor="bg-indigo-500/10"
          />
          <StatCard 
            icon={Coins} 
            label={t.laundry.totalExpenditure} 
            value={`Rp ${stats.totalCost.toLocaleString()}`} 
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
          />
          <StatCard 
            icon={Clock} 
            label={t.laundry.pendingBatches} 
            value={stats.pendingBatches.toString()} 
            color="text-amber-400"
            bgColor="bg-amber-500/10"
          />
        </div>

        {/* Info Box about multi-item */}
        <div className="bg-indigo-950/20 border border-indigo-500/15 rounded-2xl p-4 flex items-start gap-3">
          <Info className="text-indigo-400 flex-shrink-0 mt-0.5" size={16} />
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest">
              {language === 'id' ? 'Sistem Inventori Multi-Item Terintegrasi' : 'Integrated Multi-Product Tracking'}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              {language === 'id' 
                ? 'Sistem laundry telah diperbarui. Sekarang Anda dapat mengirim dan menerima multi-barang sekaligus (Bath Towel, Pool Towel, Kimono, dll) secara terpadu. Klik record pada tabel untuk melihat rincian progres per item.' 
                : 'Sanitation flow now registers compound items in a single dispatch batch. Toggle rows inside the audit ledger to track real-time status details of each material.'}
            </p>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-slate-900/30 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{t.inventory.table.toUpperCase()}</th>
                  <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{t.common.status.toUpperCase()}</th>
                  <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{t.common.quantity.toUpperCase()} (Out/In)</th>
                  <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] hidden md:table-cell">{t.common.totalCost.toUpperCase()}</th>
                  <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] hidden sm:table-cell">{t.common.date.toUpperCase()}</th>
                  <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-right">{t.common.action.toUpperCase()}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence mode="popLayout">
                  {isLoading ? (
                    Array(3).fill(0).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={6} className="p-8 h-12 bg-white/[0.01]" />
                      </tr>
                    ))
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <History size={40} className="text-slate-700" />
                          <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">{language === 'id' ? 'Tidak ada riwayat laundry ditemukan' : 'No laundry history found'}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((record) => {
                      // Attempt parse JSON
                      let itemsBreakdown = null;
                      try {
                        if (record.note) {
                          const parsed = JSON.parse(record.note);
                          if (parsed && typeof parsed === 'object' && parsed.is_multi_item) {
                            itemsBreakdown = parsed;
                          }
                        }
                      } catch (e) {
                        // fallback
                      }

                      const isExpanded = expandedRecordId === record.id;
                      
                      return (
                        <React.Fragment key={record.id}>
                          <tr 
                            className={`hover:bg-white/[0.015] border-b border-white/5 transition-colors cursor-pointer group ${isExpanded ? 'bg-indigo-950/5' : ''}`}
                            onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                          >
                            <td className="p-4 sm:p-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                  <WashingMachine size={14} className="text-indigo-400" />
                                </div>
                                <div className="max-w-xs sm:max-w-md">
                                  <p className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                                    {itemsBreakdown 
                                      ? (language === 'id' ? 'Gabungan: ' : 'Consolidated: ') + itemsBreakdown.items.map((i: any) => i.name).join(', ') 
                                      : record.item_name
                                    }
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] text-slate-500 font-mono">Op: {record.operator_name || 'System'}</p>
                                    <span className="text-[9px] text-slate-600 font-mono">• ID: #{record.id.slice(0,6).toUpperCase()}</span>
                                    {itemsBreakdown && (
                                      <span className="text-[9px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20">
                                        Multi-Item
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            
                            <td className="p-4 sm:p-6">
                              <StatusBadge status={record.status} />
                            </td>

                            <td className="p-4 sm:p-6">
                              <div className="flex flex-col">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-base font-mono font-black text-white">{record.quantity_in}</span>
                                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">/ {record.quantity_out} UNITS</span>
                                </div>
                                <div className="w-20 bg-white/5 h-1 rounded-full overflow-hidden mt-1 md:block hidden">
                                  <div 
                                    className={`h-full ${record.status === 'returned' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${Math.min(100, Math.round((record.quantity_in / record.quantity_out) * 100))}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="p-4 sm:p-6 hidden md:table-cell">
                              <p className="text-xs font-bold text-emerald-400">Rp {Number(record.total_cost).toLocaleString()}</p>
                              <p className="text-[9px] text-slate-600 font-medium">@{Number(record.unit_cost).toLocaleString()}/unit avg</p>
                            </td>

                            <td className="p-4 sm:p-6 hidden sm:table-cell">
                              <div className="space-y-1">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                    <ArrowUpRight size={10} className="text-rose-500" />
                                    {new Date(record.sent_at).toLocaleDateString()}
                                  </div>
                                </div>
                                {record.returned_at && (
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                      <ArrowDownLeft size={10} className="text-emerald-500" />
                                      {new Date(record.returned_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="p-4 sm:p-6 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                {record.status !== 'returned' && (
                                  <button 
                                    onClick={() => openReturnModal(record)}
                                    className="p-2 text-indigo-400 hover:bg-indigo-500/10 hover:text-white rounded-lg transition-all border border-indigo-500/20 cursor-pointer"
                                    title={language === 'id' ? 'Proses Pengembalian' : 'Receive Items'}
                                  >
                                    <ArrowDownLeft size={16} />
                                  </button>
                                )}
                                {isAdmin && (
                                  <button 
                                    onClick={() => setDeleteTargetId(record.id)}
                                    className="p-2 text-slate-600 hover:text-rose-500 transition-colors cursor-pointer"
                                    title={language === 'id' ? 'Hapus Record' : 'Delete Record'}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Breakdown Details */}
                          {isExpanded && (
                            <tr className="bg-slate-950/40">
                              <td colSpan={6} className="p-4 sm:p-6">
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="bg-[#09090b] border border-white/5 rounded-2xl p-5 space-y-4">
                                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <ClipboardList size={14} />
                                        {language === 'id' ? 'RINCIAN MANIFES DOSSIER' : 'ITEMIZED MANIFEST DOSSIER'}
                                      </span>
                                      <span className="text-[9px] font-mono text-slate-500 font-bold">
                                        MASTER BATCH RECORD: {record.id}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {itemsBreakdown ? (
                                        itemsBreakdown.items.map((item: any, itmIdx: number) => {
                                          const pct = item.qty_out > 0 ? Math.round((item.qty_in / item.qty_out) * 100) : 0;
                                          const matchingProduct = inventoryProducts.find(p => p.id === item.product_id);
                                          const ItemIcon = getItemIcon(item.name);
                                          
                                          return (
                                            <div key={itmIdx} className="bg-slate-900/40 border border-white/5 p-4 rounded-xl space-y-3">
                                              <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                                                    <ItemIcon size={14} />
                                                  </div>
                                                  <div>
                                                    <h5 className="text-xs font-bold text-white leading-none">{item.name}</h5>
                                                    <p className="text-[9px] text-slate-500 font-medium italic mt-1">
                                                      {matchingProduct ? `Stock: ${matchingProduct.name}` : 'Unlinked Plain Item'}
                                                    </p>
                                                  </div>
                                                </div>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pct === 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                                  {pct}% {language === 'id' ? 'Kembali' : 'Returned'}
                                                </span>
                                              </div>

                                              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono py-1.5 bg-black/30 rounded-lg">
                                                <div>
                                                  <span className="text-slate-500 block uppercase text-[8px]">{language === 'id' ? 'Keluar' : 'Out'}</span>
                                                  <span className="font-bold text-white">{item.qty_out} pcs</span>
                                                </div>
                                                <div>
                                                  <span className="text-slate-500 block uppercase text-[8px]">{language === 'id' ? 'Masuk' : 'In'}</span>
                                                  <span className="font-bold text-emerald-400">{item.qty_in || 0} pcs</span>
                                                </div>
                                                <div>
                                                  <span className="text-slate-500 block uppercase text-[8px]">{language === 'id' ? 'Biaya' : 'Cost'}</span>
                                                  <span className="font-bold text-amber-500">Rp {item.unit_cost.toLocaleString()}</span>
                                                </div>
                                              </div>

                                              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                  className={`h-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                  style={{ width: `${pct}%` }}
                                                />
                                              </div>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        // Legacy record layout
                                        <div className="col-span-full p-4 bg-slate-900/40 border border-white/5 rounded-xl flex items-center justify-between">
                                          <div>
                                            <p className="text-xs font-bold text-white">{record.item_name}</p>
                                            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold font-mono">LEGACY STANDALONE LOG</span>
                                          </div>
                                          <div className="text-right font-mono text-xs">
                                            <span className="text-slate-400 block">Out: {record.quantity_out} / In: {record.quantity_in}</span>
                                            <span className="text-emerald-400 block font-bold">Total: Rp {record.total_cost.toLocaleString()}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {(globalNote || itemsBreakdown?.user_note || record.note) && (
                                      <div className="text-[11px] text-slate-400 border-t border-white/5 pt-3 mt-2">
                                        <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px]">Catatan Vendor / Keterangan Tambahan:</span>
                                        <p className="mt-1 bg-[#151515] p-3 rounded-xl border border-white/5 italic">
                                          {itemsBreakdown ? itemsBreakdown.user_note || '-' : record.note}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">
            <p>Module 04: <span className="text-slate-300">Sanitation Flow Audit</span> | Page <span className="text-white">{currentPage}/{totalPages || 1}</span></p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-white/5 rounded-xl hover:bg-white/5 transition-all disabled:opacity-20 pointer-events-auto"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex gap-1 overflow-x-auto max-w-[120px] no-scrollbar">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button 
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[32px] h-8 flex items-center justify-center rounded-xl transition-all ${currentPage === page ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'hover:bg-white/5 text-slate-400'}`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 border border-white/5 rounded-xl hover:bg-white/5 transition-all disabled:opacity-20 pointer-events-auto"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Group / Multi-Item Input Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-10"
            >
              <div className="p-6 sm:p-8 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-xl font-black text-white italic uppercase flex items-center gap-3">
                  <ArrowUpRight className="text-indigo-400" size={24} />
                  KIRIM <span className="text-indigo-500">BATCH LAUNDRY</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-widest">
                  {language === 'id' ? 'Pilih dan penuhi jumlah kirim handuk, kain lap, baju, atau kimono' : 'Fill and dispatch towel, clothes, laundry rags or kimonos'}
                </p>
              </div>

              <form onSubmit={handleCreateGroupDispatch} className="p-6 sm:p-8 space-y-6">
                
                {/* Scrollable list of category inputs */}
                <div className="space-y-3.5 max-h-[42vh] overflow-y-auto pr-2 custom-scrollbar">
                  {dispatchItems.map((item, idx) => {
                    const ItemIcon = getItemIcon(item.name);
                    const parsedSubtotal = (item.qty_out || 0) * (item.unit_cost || 0);
                    
                    return (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-2xl border transition-all ${
                          item.enabled 
                            ? 'bg-indigo-950/20 border-indigo-500/30 shadow-indigo-500/5' 
                            : 'bg-black/30 border-white/5 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={item.enabled}
                              onChange={(e) => {
                                const updated = [...dispatchItems];
                                updated[idx].enabled = e.target.checked;
                                if (e.target.checked && updated[idx].qty_out === 0) {
                                  updated[idx].qty_out = 10; // smart default quantity
                                }
                                setDispatchItems(updated);
                              }}
                              className="rounded border-white/10 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer h-4 w-4"
                            />
                            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                              <ItemIcon size={14} />
                            </div>
                            
                            {/* Allow editing of custom item row names directly */}
                            {idx >= 5 ? (
                              <input 
                                type="text"
                                className="bg-transparent border-b border-indigo-500/30 focus:border-indigo-400 font-extrabold text-xs text-white focus:outline-none py-0.5 leading-none"
                                value={item.name}
                                onChange={(e) => {
                                  const updated = [...dispatchItems];
                                  updated[idx].name = e.target.value;
                                  setDispatchItems(updated);
                                }}
                              />
                            ) : (
                              <span className="text-xs font-black text-white">{item.name}</span>
                            )}
                          </label>

                          {item.enabled && (
                            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                              Subtotal: Rp {parsedSubtotal.toLocaleString()}
                            </span>
                          )}
                        </div>

                        {item.enabled && (
                          <div className="grid grid-cols-3 gap-3 pt-1">
                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                {language === 'id' ? 'Kuantitas Keluar' : 'Qty Out'}
                              </label>
                              <input
                                type="number"
                                required
                                min="1"
                                className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                                value={item.qty_out || ''}
                                onChange={(e) => {
                                  const updated = [...dispatchItems];
                                  updated[idx].qty_out = Math.max(1, parseInt(e.target.value) || 0);
                                  setDispatchItems(updated);
                                }}
                              />
                            </div>

                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                {language === 'id' ? 'Biaya/Pcs (Rp)' : 'Cost/Pcs (Rp)'}
                              </label>
                              <input
                                type="number"
                                required
                                min="0"
                                className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                                value={item.unit_cost || ''}
                                onChange={(e) => {
                                  const updated = [...dispatchItems];
                                  updated[idx].unit_cost = Math.max(0, parseInt(e.target.value) || 0);
                                  setDispatchItems(updated);
                                }}
                              />
                            </div>

                            <div>
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                {language === 'id' ? 'Tautkan Stok' : 'Link Storage'}
                              </label>
                              <select
                                className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-[10px] text-white focus:outline-none focus:border-indigo-500"
                                value={item.product_id}
                                onChange={(e) => {
                                  const updated = [...dispatchItems];
                                  updated[idx].product_id = e.target.value;
                                  
                                  // Update unit cost if mapped item possesses one
                                  const prod = inventoryProducts.find(p => p.id === e.target.value);
                                  if (prod && prod.unit_cost) {
                                    updated[idx].unit_cost = Number(prod.unit_cost);
                                    updated[idx].name = idx >= 5 ? prod.name : updated[idx].name;
                                  }
                                  
                                  setDispatchItems(updated);
                                }}
                              >
                                <option value="">-- {language === 'id' ? 'Tanpa Link' : 'No Sync'} --</option>
                                {inventoryProducts.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.stock_quantity} {language === 'id' ? 'tersedia' : 'pcs'})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Grid controls to extend custom items list */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <button
                    type="button"
                    onClick={addCustomItemRow}
                    className="px-4 py-2 bg-slate-950 border border-white/5 hover:border-indigo-500/20 rounded-xl text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    + {language === 'id' ? 'Tambah Barang Lain' : 'Add Custom Line'}
                  </button>

                  <div className="flex items-center gap-2">
                    <input
                      id="deduct-stock-cb"
                      type="checkbox"
                      checked={deductStock}
                      onChange={(e) => setDeductStock(e.target.checked)}
                      className="rounded border-white/10 text-indigo-600 focus:ring-indigo-500 bg-slate-100 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="deduct-stock-cb" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer">
                      {language === 'id' ? 'Potong stok gudang saat dikirim' : 'Deduct warehouse stock on dispatch'}
                    </label>
                  </div>
                </div>

                {/* Additional Manifest Notes */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                    {language === 'id' ? 'Catatan Manifes & Vendor' : 'Vendor & Manifest Notes'}
                  </label>
                  <textarea 
                    placeholder={language === 'id' ? 'Masukkan info tambahan / instruksi vendor laundry...' : 'Vendor directions or specific instructions...'}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors min-h-[60px] resize-none"
                    value={globalNote}
                    onChange={(e) => setGlobalNote(e.target.value)}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4 border-t border-white/5">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3.5 bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 rounded-2xl font-bold text-xs transition-all tracking-widest uppercase cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs transition-all shadow-lg shadow-indigo-500/20 tracking-widest uppercase cursor-pointer"
                  >
                    {t.laundry.confirmDispatch}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unified Return Modal */}
      <AnimatePresence>
        {isReturnModalOpen && selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsReturnModalOpen(false);
                setSelectedRecord(null);
              }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-10"
            >
              <div className="p-6 sm:p-8 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-xl font-black text-white italic uppercase flex items-center gap-3">
                  <ArrowDownLeft className="text-emerald-400" size={24} />
                  PENERIMAAN <span className="text-emerald-500">LAPORAN KEMBALI</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-widest">
                  {language === 'id' ? 'Catat kuantitas yang berhasil dibersihkan kembali ke gudang' : 'Log clean quantities received back in store'}
                </p>
              </div>

              <form onSubmit={handleReturnActionSubmit} className="p-6 sm:p-8 space-y-6">
                
                <div className="space-y-3.5 max-h-[42vh] overflow-y-auto pr-2 custom-scrollbar">
                  {returnItems.map((item, idx) => {
                    const remaining = item.qty_out - item.qty_in;
                    const ItemIcon = getItemIcon(item.name);

                    return (
                      <div key={idx} className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1 px-1.5 bg-indigo-500/10 rounded text-indigo-400">
                              <ItemIcon size={12} />
                            </div>
                            <span className="text-xs font-extrabold text-white">{item.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {language === 'id' ? `Total Kirk: ${item.qty_out} | Sedia Kembali: ${item.qty_in}` : `Total sent: ${item.qty_out} | Already back: ${item.qty_in}`}
                          </span>
                        </div>

                        {remaining > 0 ? (
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                              {language === 'id' ? 'Diterima Kembali:' : 'Returning Now:'}
                            </span>
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              required
                              className="flex-1 bg-slate-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-center text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                              value={item.qty_returning_now}
                              onChange={(e) => {
                                const val = Math.min(remaining, Math.max(0, parseInt(e.target.value) || 0));
                                const updated = [...returnItems];
                                updated[idx].qty_returning_now = val;
                                setReturnItems(updated);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...returnItems];
                                updated[idx].qty_returning_now = remaining;
                                setReturnItems(updated);
                              }}
                              className="px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 rounded-lg text-[10px] font-black text-slate-300 transition-colors cursor-pointer"
                            >
                              MAX ({remaining})
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest pl-1">
                            <Check size={12} />
                            {language === 'id' ? 'Semua Handuk/Barang Telah Kembali' : 'Fully Returned to Storage'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = returnItems.map(item => ({
                        ...item,
                        qty_returning_now: item.qty_out - item.qty_in
                      }));
                      setReturnItems(updated);
                    }}
                    className="px-4 py-2 bg-slate-950 border border-white/5 hover:border-emerald-500/20 rounded-xl text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    {language === 'id' ? 'Terima Semua Unit Sisa' : 'Receive All Outstanding'}
                  </button>

                  <div className="flex items-center gap-2">
                    <input
                      id="return-stock-cb"
                      type="checkbox"
                      checked={returnDeductStock}
                      onChange={(e) => setReturnDeductStock(e.target.checked)}
                      className="rounded border-white/10 text-indigo-600 focus:ring-indigo-500 bg-slate-100 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="return-stock-cb" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer">
                      {language === 'id' ? 'Pindahkan otomatis kembali ke stok katalog' : 'Automatically restore storage balance'}
                    </label>
                  </div>
                </div>

                {/* Bottom stats summary return */}
                <div className="p-4 bg-[#0a0a0d] border border-white/5 rounded-2xl flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === 'id' ? 'TOTAL BARANG KEMBALI SEKARANG' : 'TOTAL RETURNING NOW'}</span>
                  <span className="text-base font-mono font-black text-emerald-400">
                    {returnItems.reduce((acc, i) => acc + i.qty_returning_now, 0)} Pcs
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4 border-t border-white/5">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsReturnModalOpen(false);
                      setSelectedRecord(null);
                    }}
                    className="flex-1 px-6 py-3.5 bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 rounded-2xl font-bold text-xs transition-all tracking-widest uppercase cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 tracking-widest uppercase cursor-pointer"
                  >
                    {t.laundry.finalizeReturn}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTargetId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTargetId(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-10 p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-center gap-3 text-rose-500">
                <AlertCircle size={24} />
                <h3 className="text-lg font-black uppercase tracking-tight italic">
                  {language === 'id' ? 'KONFIRMASI HAPUS' : 'CONFIRM DELETION'}
                </h3>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-300">
                  {language === 'id' 
                    ? 'Apakah Anda yakin ingin menghapus data laundry ini secara permanen dari sistem?' 
                    : 'Are you sure you want to permanently delete this laundry record?'}
                </p>
                <div className="text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 select-none">
                  ⚠️ {language === 'id' 
                    ? 'Tindakan ini tidak dapat dibatalkan dan akan menghapus rekaman permanen dari log audit.' 
                    : 'This action is irreversible and will remove the permanent record from audit logs.'}
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setDeleteTargetId(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 rounded-xl font-bold text-xs transition-all tracking-widest uppercase cursor-pointer"
                >
                  {language === 'id' ? 'BATAL' : 'CANCEL'}
                </button>
                <button 
                  type="button"
                  onClick={() => handleDelete(deleteTargetId)}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-rose-500/20 tracking-widest uppercase cursor-pointer"
                >
                  {language === 'id' ? 'HAPUS' : 'DELETE'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bgColor }: any) {
  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden group">
      <div className="relative z-10 space-y-4">
        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center border border-white/5`}>
          <Icon className={color} size={18} />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{label}</p>
          <p className={`text-2xl font-black ${color} tracking-tighter mt-1 leading-none`}>{value}</p>
        </div>
      </div>
      <Icon className={`absolute -right-4 -bottom-4 opacity-[0.03] transition-transform group-hover:scale-110 duration-500 ${color}`} size={110} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const styles = {
    out: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    partial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    returned: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  };

  const icons = {
    out: <ArrowUpRight size={12} />,
    partial: <Clock size={12} />,
    returned: <CheckCircle2 size={12} />
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black tracking-widest uppercase ${styles[status as keyof typeof styles]}`}>
      {icons[status as keyof typeof icons]}
      {status === 'returned' ? t.laundry.returned : status === 'partial' ? t.laundry.pending : t.laundry.pending}
    </div>
  );
}
