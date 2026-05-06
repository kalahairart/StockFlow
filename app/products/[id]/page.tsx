'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Package, 
  ArrowLeft, 
  History, 
  TrendingUp, 
  AlertTriangle, 
  Calendar,
  Tag,
  Box,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Product, Transaction } from '@/types/inventory';
import { motion } from 'motion/react';
import StatCard from '@/components/dashboard/stat-card';
import ProductModal from '@/components/inventory/product-modal';
import { Edit2 } from 'lucide-react';

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchProductDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch Product Info
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      
      if (productError) throw productError;
      setProduct(productData);

      // Fetch ALL Transactions for this product
      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .eq('product_id', id)
        .order('timestamp', { ascending: false });

      if (transError) throw transError;
      setTransactions(transData || []);

    } catch (err) {
      console.error('Error fetching product details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchProductDetails();
    }
  }, [id, fetchProductDetails]);

  const handleUpdateProduct = async (data: any) => {
    try {
      const { error } = await supabase
        .from('products')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      await fetchProductDetails();
    } catch (err) {
      alert('Update failed: ' + (err as Error).message);
    }
  };

  const handleDeleteProduct = async () => {
    if (!confirm('Permanent Deletion Warning: This will erase the SKU and all its transaction history. This action is irreversible. Proceed?')) return;
    
    try {
      // First delete associated transactions
      const { error: transError } = await supabase
        .from('transactions')
        .delete()
        .eq('product_id', id);
      
      if (transError) throw transError;

      // Then delete the product
      const { error: productError } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (productError) throw productError;
      router.push('/inventory');
    } catch (err) {
      alert('Delete failed: ' + (err as Error).message);
    }
  };

  const handleDeleteTransaction = async (transId: string) => {
    if (!confirm('Permanently remove this transaction from the ledger? Reverting stock...')) return;
    
    try {
      // THE TRIGGER IN THE DB WILL AUTOMATICALLY REVERT stock_quantity ON DELETE
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transId);

      if (deleteError) throw new Error(deleteError.message);
      
      await fetchProductDetails();
    } catch (err) {
      alert('Delete failed: ' + (err as Error).message);
    }
  };

  const metrics = useMemo(() => {
    if (!product) return null;
    
    const stockIn = transactions
      .filter(t => t.type === 'in')
      .reduce((acc, t) => acc + t.quantity, 0);
    
    const stockOut = transactions
      .filter(t => t.type === 'out')
      .reduce((acc, t) => acc + t.quantity, 0);

    return {
      stockIn,
      stockOut,
      netChange: stockIn - stockOut,
      isLow: product.stock_quantity <= product.min_stock
    };
  }, [product, transactions]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-500/20" />
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] animate-pulse">Accessing Data Vault...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
        <div className="p-6 bg-rose-500/10 rounded-full border border-rose-500/20">
          <AlertTriangle size={48} className="text-rose-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white tracking-tight">Resource Not Found</h2>
          <p className="text-slate-500 text-sm mt-2">The requested SKU does not exist in the active mesh.</p>
        </div>
        <button 
          onClick={() => router.back()}
          className="bg-slate-900 border border-slate-800 text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Command
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Navigation & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.back()}
            className="p-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl hover:bg-slate-800 transition-all group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
               <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">SKU Profile</span>
               <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${metrics?.isLow ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {metrics?.isLow ? 'Critical Low' : 'Stable Ops'}
               </span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{product.name}</h1>
          </div>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={() => setIsEditModalOpen(true)}
                className="bg-slate-900 border border-slate-800 text-slate-300 px-5 py-3 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
            >
                <Edit2 size={16} />
                Edit Metadata
            </button>
            <button 
              onClick={handleDeleteProduct}
              className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-5 py-3 rounded-2xl text-xs font-bold hover:bg-rose-500/20 transition-all active:scale-95 flex items-center gap-2"
            >
              <Trash2 size={16} />
              Terminate SKU
            </button>
            <div className="px-5 py-3 bg-[#111114] border border-white/5 rounded-2xl flex flex-col justify-center">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Inventory ID</span>
                <span className="text-xs font-mono text-slate-300 font-bold">{product.id}</span>
            </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Current Stock" 
          value={product.stock_quantity.toLocaleString()} 
          icon={Box} 
          color="bg-indigo-500"
        />
        <StatCard 
          title="Min Threshold" 
          value={product.min_stock.toLocaleString()} 
          icon={AlertTriangle} 
          color="bg-slate-700"
        />
        <StatCard 
          title="Lifetime Stock In" 
          value={metrics?.stockIn.toLocaleString() || "0"} 
          icon={ArrowUpCircle} 
          color="bg-emerald-500"
        />
        <StatCard 
          title="Lifetime Stock Out" 
          value={metrics?.stockOut.toLocaleString() || "0"} 
          icon={ArrowDownCircle} 
          color="bg-rose-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Basic Info Panel */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#111114]/50 backdrop-blur-sm border border-white/5 rounded-3xl p-8 space-y-8">
                <div className="flex items-center gap-3 pb-6 border-b border-white/5">
                    <History size={20} className="text-indigo-400" />
                    <h3 className="font-bold text-white tracking-tight uppercase text-sm">Specification Mesh</h3>
                </div>
                
                <div className="space-y-6">
                    <InfoRow icon={Tag} label="Classification" value={product.category} />
                    <InfoRow icon={Calendar} label="Registered On" value={new Date(product.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })} />
                    <InfoRow icon={Box} label="Operator" value={product.created_by || 'System Ledger'} />
                    <InfoRow icon={Clock} label="Operational Area" value="Obsidian 1 Warehouse" />
                </div>
            </div>
        </div>

        {/* Transactions Panel */}
        <div className="lg:col-span-2">
            <div className="bg-[#111114]/50 backdrop-blur-sm border border-white/5 rounded-3xl flex flex-col h-full overflow-hidden">
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <History size={20} className="text-slate-400" />
                        <h3 className="font-bold text-white tracking-tight uppercase text-sm">Action Ledger</h3>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        Total Records: {transactions.length}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[500px] scrollbar-thin">
                    {transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 text-center">
                            <Clock size={32} className="text-slate-700 mb-4" />
                            <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">No transactional history recorded</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.03]">
                            {transactions.map((t) => {
                                const operatorMatch = t.note?.match(/^\[Operator: (.*?)\]/);
                                const operator = t.user_name || (operatorMatch ? operatorMatch[1] : 'System');
                                const cleanNote = t.note?.replace(/^\[Operator: .*?\]\s?/, '') || '';

                                return (
                                    <motion.div 
                                        key={t.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="p-6 hover:bg-white/[0.02] transition-all flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-2xl border ${
                                                t.type === 'in' 
                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                            }`}>
                                                {t.type === 'in' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white tracking-tight">
                                                    {t.type === 'in' ? 'Resource Replenishment' : 'Inventory Extraction'}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-mono text-slate-500">
                                                        {new Date(t.timestamp).toLocaleString()}
                                                    </span>
                                                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">•</span>
                                                    <span className="text-[10px] text-indigo-400/70 font-bold uppercase tracking-tight">
                                                        {operator}
                                                    </span>
                                                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">•</span>
                                                    <span className="text-[10px] text-slate-500 font-bold truncate max-w-[200px]">
                                                        Ref: {cleanNote || 'Internal Sync'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    <div className="flex items-center gap-6">
                                      <div className="text-right">
                                          <p className={`text-xl font-mono font-black ${
                                              t.type === 'in' ? 'text-emerald-400' : 'text-rose-400'
                                          }`}>
                                              {t.type === 'in' ? '+' : '-'}{t.quantity}
                                          </p>
                                          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Units</p>
                                      </div>
                                      <button 
                                        onClick={() => handleDeleteTransaction(t.id)}
                                        className="p-2 text-slate-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      <ProductModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleUpdateProduct}
        title="Edit SKU Metadata"
        initialData={{
            name: product.name,
            category: product.category,
            stock_quantity: product.stock_quantity,
            min_stock: product.min_stock
        }}
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="flex items-start gap-4 group">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5 text-slate-500 group-hover:text-indigo-400 group-hover:border-indigo-500/20 transition-all">
                <Icon size={16} />
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-0.5">{label}</p>
                <p className="text-sm font-bold text-white tracking-tight break-all">{value}</p>
            </div>
        </div>
    );
}
