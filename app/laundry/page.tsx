'use client';

import React, { useState, useEffect } from 'react';
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
  DollarSign,
  Package,
  History,
  Box,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { LaundryRecord, Product } from '@/types/inventory';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/use-language';

export default function LaundryPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [records, setRecords] = useState<LaundryRecord[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LaundryRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    item_name: '',
    product_id: '' as string | null,
    quantity_out: 0,
    unit_cost: 0,
    note: ''
  });

  const [returnQuantity, setReturnQuantity] = useState(0);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const operatorName = user?.user_metadata?.full_name || user?.email || 'System';
      const totalCost = formData.quantity_out * formData.unit_cost;

      const { error } = await supabase
        .from('laundry_records')
        .insert([{
          ...formData,
          sent_at: new Date().toISOString(),
          total_cost: totalCost,
          status: 'out',
          operator_name: operatorName
        }]);

      if (error) {
        if (error.message.includes('product_id')) {
          throw new Error('Database schema update required. Please ensure the latest SQL script from supabase_schema.sql has been executed in the Supabase Dashboard SQL Editor.');
        }
        throw error;
      }

      toast.success(`Dispatch Confirmed: ${formData.item_name}`, {
        description: `Successfully dispatched ${formData.quantity_out} units for sanitation.`,
      });

      // Check if product became critical after dispatch
      if (formData.product_id) {
          const { data: updatedProduct, error: pError } = await supabase
            .from('products')
            .select('*')
            .eq('id', formData.product_id)
            .single();
          
          if (!pError && updatedProduct && updatedProduct.stock_quantity <= updatedProduct.min_stock) {
            toast.error(`Critical Stock Warning: ${updatedProduct.name}`, {
                description: `Remaining warehouse stock: ${updatedProduct.stock_quantity}. threshold: ${updatedProduct.min_stock}`,
                duration: 6000,
            });
          }
      }
      
      setIsModalOpen(false);
      setFormData({ 
        item_name: '', 
        product_id: null, 
        quantity_out: 0, 
        unit_cost: 0, 
        note: ''
      });
      await fetchRecords();
    } catch (err) {
      alert('Failed to register laundry: ' + (err as Error).message);
    }
  };

  const selectedProductStock = formData.product_id 
    ? inventoryProducts.find(p => p.id === formData.product_id)?.stock_quantity || 0
    : null;

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    try {
      const newQuantityIn = selectedRecord.quantity_in + returnQuantity;
      const newStatus = newQuantityIn >= selectedRecord.quantity_out ? 'returned' : 'partial';
      
      const { error } = await supabase
        .from('laundry_records')
        .update({
          quantity_in: newQuantityIn,
          status: newStatus,
          returned_at: newStatus === 'returned' || newQuantityIn > selectedRecord.quantity_in ? new Date().toISOString() : selectedRecord.returned_at
        })
        .eq('id', selectedRecord.id);

      if (error) throw error;

      toast.success(`Return Logged: ${selectedRecord.item_name}`, {
        description: `Successfully received ${returnQuantity} units back into inventory.`,
      });

      // Check if product was critical and is now restored (optional, but let's at least show success)
      if (selectedRecord.product_id) {
          const { data: updatedProduct, error: pError } = await supabase
            .from('products')
            .select('*')
            .eq('id', selectedRecord.product_id)
            .single();
          
          if (!pError && updatedProduct) {
              if (updatedProduct.stock_quantity > updatedProduct.min_stock) {
                  toast.success(`Stock Restored: ${updatedProduct.name}`, {
                      description: `Current quantity: ${updatedProduct.stock_quantity} (Above threshold).`,
                  });
              } else {
                  toast.warning(`Still Critical: ${updatedProduct.name}`, {
                      description: `Current quantity: ${updatedProduct.stock_quantity}. threshold: ${updatedProduct.min_stock}`,
                  });
              }
          }
      }

      setIsReturnModalOpen(false);
      setSelectedRecord(null);
      setReturnQuantity(0);
      await fetchRecords();
    } catch (err) {
      alert('Return failed: ' + (err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanent Deletion: This record will be removed from the audit trail. Proceed?')) return;
    try {
      const { error } = await supabase
        .from('laundry_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Record Deleted', {
        description: 'Laundry operation record cleared from history.',
      });
      await fetchRecords();
    } catch (err) {
      alert('Delete failed: ' + (err as Error).message);
    }
  };

  const stats = {
    totalItemsOut: records.reduce((acc, r) => acc + (r.status !== 'returned' ? r.quantity_out - r.quantity_in : 0), 0),
    warehouseStock: inventoryProducts
      .filter(p => p.category?.toLowerCase() === 'towel')
      .reduce((acc, p) => acc + (p.stock_quantity || 0), 0),
    totalCost: records.reduce((acc, r) => acc + (Number(r.total_cost) || 0), 0),
    pendingBatches: records.filter(r => r.status !== 'returned').length
  };

  const totalPages = Math.ceil(records.length / itemsPerPage);
  const paginatedRecords = records.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 group"
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
            label={t.laundry.totalStock} 
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
            icon={DollarSign} 
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
                      const linkedProduct = inventoryProducts.find(p => p.id === record.product_id);
                      
                      return (
                        <motion.tr 
                          layout
                          key={record.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-white/[0.01] transition-colors group"
                        >
                          <td className="p-4 sm:p-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                <Package size={14} className="text-indigo-400" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white tracking-tight">{record.item_name}</p>
                                <p className="text-[10px] text-slate-500 font-mono italic">Op: {record.operator_name || 'System'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 sm:p-6">
                            <StatusBadge status={record.status} />
                          </td>
                          <td className="p-4 sm:p-6">
                            <div className="flex flex-col">
                              <div className="flex items-baseline gap-1">
                                <span className="text-lg font-mono font-black text-white">{record.quantity_in}</span>
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">/ {record.quantity_out} UNITS</span>
                              </div>
                              {linkedProduct && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Box size={10} className="text-slate-600" />
                                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                    Wh Stock: {linkedProduct.stock_quantity}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4 sm:p-6 hidden md:table-cell">
                            <p className="text-xs font-bold text-emerald-400">Rp {Number(record.total_cost).toLocaleString()}</p>
                            <p className="text-[9px] text-slate-600 font-medium">@{Number(record.unit_cost).toLocaleString()}/unit</p>
                          </td>
                          <td className="p-4 sm:p-6 hidden sm:table-cell">
                            <div className="space-y-1">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                                  <ArrowUpRight size={10} className="text-rose-500" />
                                  {new Date(record.sent_at).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-medium text-slate-600 pl-4">
                                  <Clock size={8} />
                                  {new Date(record.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              {record.returned_at && (
                                <div className="flex flex-col gap-0.5 mt-2">
                                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                                    <ArrowDownLeft size={10} className="text-emerald-500" />
                                    {new Date(record.returned_at).toLocaleDateString()}
                                  </div>
                                  <div className="flex items-center gap-2 text-[9px] font-medium text-slate-600 pl-4">
                                    <Clock size={8} />
                                    {new Date(record.returned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4 sm:p-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {record.status !== 'returned' && (
                                <button 
                                  onClick={() => {
                                    setSelectedRecord(record);
                                    setIsReturnModalOpen(true);
                                  }}
                                  className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-indigo-500/20"
                                >
                                  <ArrowDownLeft size={16} />
                                </button>
                              )}
                              <button 
                                onClick={() => handleDelete(record.id)}
                                className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
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
              className="p-2 border border-white/5 rounded-xl hover:bg-white/5 transition-all disabled:opacity-20"
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
              className="p-2 border border-white/5 rounded-xl hover:bg-white/5 transition-all disabled:opacity-20"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Manual Input Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-xl font-black text-white italic uppercase flex items-center gap-3">
                  <ArrowUpRight className="text-indigo-400" size={24} />
                  {t.laundry.initiateDispatch.split(' ')[0]} <span className="text-indigo-500">{t.laundry.initiateDispatch.split(' ')[1]}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-widest">{language === 'id' ? 'Daftarkan barang untuk pencucian eksternal' : 'Register items for external cleaning'}</p>
              </div>

              <form onSubmit={handleCreate} className="p-8 space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{language === 'id' ? 'Tautkan ke Inventaris (Opsional)' : 'Link to Inventory (Optional)'}</label>
                  <select 
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    value={formData.product_id || ''}
                    onChange={(e) => {
                      const pid = e.target.value || null;
                      const prod = inventoryProducts.find(p => p.id === pid);
                      setFormData({ 
                        ...formData, 
                        product_id: pid, 
                        item_name: prod ? prod.name : formData.item_name,
                        unit_cost: prod ? Number(prod.unit_cost) : formData.unit_cost
                      });
                    }}
                  >
                    <option value="">{language === 'id' ? '-- Item Manual (Tanpa Tautan) --' : '-- Manual Item (No Link) --'}</option>
                    {inventoryProducts
                      .filter(p => p.category?.toLowerCase() === 'towel')
                      .map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{language === 'id' ? 'Nama Barang Target' : 'Target Item Name'}</label>
                  <input 
                    required
                    placeholder="e.g. Bed Sheets XL"
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{t.common.quantity}</label>
                    <div className="relative">
                      <input 
                        type="number"
                        required
                        min="1"
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                        value={formData.quantity_out || ''}
                        onChange={(e) => setFormData({ ...formData, quantity_out: parseInt(e.target.value) })}
                      />
                      {selectedProductStock !== null && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 uppercase">
                          Max: {selectedProductStock}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{t.common.unitCost} (Rp)</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                      value={formData.unit_cost || ''}
                      onChange={(e) => setFormData({ ...formData, unit_cost: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{language === 'id' ? 'Catatan Manifes' : 'Manifest Notes'}</label>
                  <textarea 
                    placeholder={language === 'id' ? 'Referensi vendor atau instruksi khusus...' : 'Reference vendor or specific instructions...'}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-colors min-h-[100px] resize-none"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 rounded-2xl font-bold text-xs transition-all tracking-widest uppercase"
                  >
                    {t.common.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs transition-all shadow-lg shadow-indigo-500/20 tracking-widest uppercase"
                  >
                    {t.laundry.confirmDispatch}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Return Modal */}
      <AnimatePresence>
        {isReturnModalOpen && selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReturnModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-xl font-black text-white italic uppercase flex items-center gap-3">
                  <ArrowDownLeft className="text-emerald-400" size={24} />
                  {t.laundry.recordReturn.split(' ')[0]} <span className="text-emerald-500">{t.laundry.recordReturn.split(' ')[1]}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-widest">{language === 'id' ? 'Tandai barang sebagai diterima kembali di gudang' : 'Mark items as received back in store'}</p>
              </div>

              <form onSubmit={handleReturn} className="p-8 space-y-6">
                <div className="p-4 bg-slate-950 border border-white/5 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{language === 'id' ? 'Pengiriman Awal' : 'Original Dispatch'}</span>
                    <span className="text-xs font-mono font-bold text-white">{selectedRecord.quantity_out} units</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{language === 'id' ? 'Sudah Kembali' : 'Already Returned'}</span>
                    <span className="text-xs font-mono font-bold text-indigo-400">{selectedRecord.quantity_in} units</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 text-center">
                    {language === 'id' ? 'Jumlah Kembali' : 'Return Quantity'}
                  </label>
                  <input 
                    type="number"
                    required
                    min="1"
                    max={selectedRecord.quantity_out - selectedRecord.quantity_in}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-indigo-500/50 transition-colors text-center text-3xl font-mono"
                    value={returnQuantity || ''}
                    onChange={(e) => setReturnQuantity(parseInt(e.target.value))}
                  />
                  <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">
                    {language === 'id' 
                      ? `Sisa untuk dikembalikan: ${selectedRecord.quantity_out - selectedRecord.quantity_in} unit` 
                      : `Remaining to return: ${selectedRecord.quantity_out - selectedRecord.quantity_in} units`}
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsReturnModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 rounded-2xl font-bold text-xs transition-all tracking-widest uppercase"
                  >
                    {t.common.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 tracking-widest uppercase"
                  >
                    {t.laundry.finalizeReturn}
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

function StatCard({ icon: Icon, label, value, color, bgColor }: any) {
  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden group">
      <div className="relative z-10 space-y-4">
        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center border border-white/5`}>
          <Icon className={color} size={18} />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
          <p className={`text-2xl font-black ${color} tracking-tighter mt-1`}>{value}</p>
        </div>
      </div>
      <Icon className={`absolute -right-4 -bottom-4 opacity-5 transition-transform group-hover:scale-110 duration-500 ${color}`} size={120} />
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
