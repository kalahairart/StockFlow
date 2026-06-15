'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  RefreshCw, 
  AlertTriangle, 
  Package, 
  TrendingUp, 
  CheckCircle,
  ExternalLink,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { Product } from '@/types/inventory';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';

export default function LowStockPage() {
  const { isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    fetchLowStockInventory();
  }, []);

  const fetchLowStockInventory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching inventory for low-stock warnings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = useMemo(() => {
    // Only category of items in low stock
    const lowStockItems = products.filter(p => p.stock_quantity <= p.min_stock);
    const cats = Array.from(new Set(lowStockItems.map(p => p.category)));
    return ['all', ...cats];
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => {
      const isLow = p.stock_quantity <= p.min_stock;
      if (!isLow) return false;

      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  // Total deficit to reach target minimum stock
  const deficitStats = useMemo(() => {
    let totalDeficit = 0;
    let criticalCount = 0;
    let outOfStockCount = 0;

    lowStockProducts.forEach(p => {
      const diff = p.min_stock - p.stock_quantity;
      if (diff > 0) {
        totalDeficit += diff;
      }
      if (p.stock_quantity === 0) {
        outOfStockCount++;
      } else {
        criticalCount++;
      }
    });

    return {
      totalDeficit,
      criticalCount,
      outOfStockCount,
      totalCount: lowStockProducts.length
    };
  }, [lowStockProducts]);

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link 
              href="/inventory"
              className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-400 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              {language === 'id' ? 'Kembali ke Inventaris' : 'Back to Inventory'}
            </Link>
            <div className="h-1 w-1 bg-slate-700 rounded-full" />
            <span className="text-[9px] sm:text-[10px] font-bold text-rose-500 uppercase tracking-[0.3em] animate-pulse">
              {language === 'id' ? 'Sinyal Bahaya Stok' : 'Depletion Wave Alert'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {language === 'id' ? 'Laporan Stok Menipis' : 'Low Stock & Depleted Alerts'}
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xl leading-relaxed">
            {language === 'id'
              ? 'Halaman terpusat katalog produk yang stok fisiknya berada pada atau di bawah batas minimum yang ditentukan.'
              : 'Centralized catalog of assets whose physical units have fallen at or below designated threshold configuration.'}
          </p>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={fetchLowStockInventory}
            className="p-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all hover:bg-slate-800 shrink-0 cursor-pointer flex items-center justify-center"
            title={language === 'id' ? 'Mulai ulang' : 'Refresh database'}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Link
            href="/restock-requests"
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-3 rounded-2xl transition-all shadow-xl shadow-indigo-900/40 active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Plus size={14} />
            <span>{language === 'id' ? 'BUAT PERMINTAAN RESTOCK' : 'PROPOSE PURCHASE ORDER'}</span>
          </Link>
        </div>
      </div>

      {/* Aggregate Warning Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-[#111114]/80 backdrop-blur-xl border border-white/5 p-5 rounded-3xl">
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">
            {language === 'id' ? 'TOTAL PRODUK MENIPIS' : 'DEPLETED SKUS'}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-rose-500 tracking-tight mt-1.5">
            {deficitStats.totalCount} <span className="text-xs text-slate-400 ml-1 font-bold">{language === 'id' ? 'Item SKU' : 'SKU Items'}</span>
          </p>
        </div>

        <div className="bg-[#111114]/80 backdrop-blur-xl border border-white/5 p-5 rounded-3xl">
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">
            {language === 'id' ? 'HABIS TOTAL (STOK 0)' : 'OUT OF STOCK (0 UNITS)'}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-red-500 tracking-tight mt-1.5">
            {deficitStats.outOfStockCount} <span className="text-xs text-slate-400 ml-1 font-bold">{language === 'id' ? 'Item' : 'Items'}</span>
          </p>
        </div>

        <div className="bg-[#111114]/80 backdrop-blur-xl border border-white/5 p-5 rounded-3xl">
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">
            {language === 'id' ? 'KRITIS (DI BAWAH MINIMAL)' : 'CRITICAL (BELOW MIN)'}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-amber-500 tracking-tight mt-1.5">
            {deficitStats.criticalCount} <span className="text-xs text-slate-400 ml-1 font-bold">{language === 'id' ? 'Item' : 'Items'}</span>
          </p>
        </div>

        <div className="bg-[#111114]/80 backdrop-blur-xl border border-white/5 p-5 rounded-3xl">
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">
            {language === 'id' ? 'KEBUTUHAN ESTIMASI RESTOCK' : 'ESTIMATED RESTOCK DEFICIT'}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-indigo-400 tracking-tight mt-1.5">
            + {deficitStats.totalDeficit} <span className="text-xs text-slate-400 ml-1 font-bold">{language === 'id' ? 'Unit Tambahan' : 'Units Needed'}</span>
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-4 bg-[#111114]/50 backdrop-blur-sm p-4 rounded-3xl border border-white/5">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder={language === 'id' ? 'Cari item menipis...' : 'Search depleted SKU or title...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-5 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div className="flex items-center gap-2 min-w-[200px]">
            <Filter size={18} className="text-slate-500 ml-2" />
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 bg-slate-950 border border-white/5 rounded-2xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer capitalize"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'all' ? (language === 'id' ? 'Semua Kategori' : 'All Categories') : cat}</option>
              ))}
            </select>
        </div>
      </div>

      {/* Main Alerts Table & Content Grid */}
      <div className="flex-1 min-h-[500px] flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'id' ? 'Memindai Batas Kritis...' : 'SCANNING FOR CRITICAL CRITERIA...'}</p>
          </div>
        ) : lowStockProducts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-[#111114]/30 rounded-3xl border border-dashed border-white/5">
            <CheckCircle size={48} className="text-emerald-500 mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-slate-300">{language === 'id' ? 'Semua Stok Aman!' : 'All Stock Safe!'}</h3>
            <p className="text-slate-500 text-sm mt-2 max-w-sm">
              {language === 'id' 
                ? 'Tidak ada barang di inventaris yang kapasitasnya di bawah ambang batas minimal saat ini.'
                : 'Excellent! No items are currently resting below their minimum threshold limits.'}
            </p>
          </div>
        ) : (
          <div className="bg-[#111114]/50 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01] text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    <th className="p-4 sm:p-5">{language === 'id' ? 'Nama & SKU Produk' : 'Product Descriptor'}</th>
                    <th className="p-4 sm:p-5">{language === 'id' ? 'Kategori' : 'Category'}</th>
                    <th className="p-4 sm:p-5 text-center">{language === 'id' ? 'Sisa Stok Saat Ini' : 'Current Stocks'}</th>
                    <th className="p-4 sm:p-5 text-center">{language === 'id' ? 'Batas Minimum Kelayakan' : 'Set Min. Threshold'}</th>
                    <th className="p-4 sm:p-5">{language === 'id' ? 'Pengukur Tingkat Kritis' : 'Deficit Gauge'}</th>
                    <th className="p-4 sm:p-5 text-right">{language === 'id' ? 'Aksi Tindakan' : 'Corrective Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  <AnimatePresence mode="popLayout">
                    {lowStockProducts.map((product) => {
                      const isOutOfStock = product.stock_quantity === 0;
                      const ratio = Math.max(0, Math.min(100, product.min_stock > 0 ? (product.stock_quantity / product.min_stock) * 100 : 0));
                      const progressColor = isOutOfStock
                        ? 'bg-red-500'
                        : product.stock_quantity < (product.min_stock * 0.5)
                        ? 'bg-orange-500' 
                        : 'bg-amber-400';

                      return (
                        <motion.tr 
                          key={product.id}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="p-4 sm:p-5">
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 rounded-xl shrink-0 ${isOutOfStock ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                <Package size={15} />
                              </div>
                              <div className="min-w-0">
                                <Link 
                                  href={`/products/${product.id}`} 
                                  className="text-white font-bold tracking-tight hover:text-indigo-400 transition-colors block truncate max-w-[150px] sm:max-w-none"
                                >
                                  {product.name}
                                </Link>
                                <p className="text-[9px] sm:text-[10px] text-slate-600 font-mono tracking-widest mt-0.5 truncate font-bold">
                                  ID: {product.id.slice(0, 8).toUpperCase()}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 sm:p-5">
                            <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-white/5 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                              {product.category}
                            </span>
                          </td>
                          <td className="p-4 sm:p-5 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className={`font-mono font-black text-base px-2.5 py-0.5 rounded-lg ${
                                isOutOfStock ? 'text-red-500 bg-red-500/10' : 'text-amber-500 bg-amber-500/10'
                              }`}>
                                {product.stock_quantity}
                              </span>
                              {isOutOfStock && (
                                <span className="text-[8px] text-red-400 font-black tracking-widest mt-1 uppercase">HABIS / EMPTY</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 sm:p-5 text-center">
                            <span className="font-mono text-slate-400 font-bold">
                              {product.min_stock}
                            </span>
                          </td>
                          <td className="p-4 sm:p-5 min-w-[150px]">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
                                <span className={isOutOfStock ? 'text-red-500' : 'text-amber-400'}>
                                  {isOutOfStock ? (language === 'id' ? 'KOSONG TOTAL' : '0% CAP') : `${Math.round(ratio)}%`}
                                </span>
                                <span className="text-slate-500 font-mono">
                                  {product.stock_quantity} / {product.min_stock}
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                <div 
                                  className={`h-full ${progressColor} transition-all duration-500 rounded-full`}
                                  style={{ width: `${ratio}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-4 sm:p-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link 
                                href={`/products/${product.id}`}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold rounded-lg border border-white/5 transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                              >
                                <span>{language === 'id' ? 'DETAIL' : 'VIEW DETAILS'}</span>
                                <ExternalLink size={10} />
                              </Link>
                              
                              <Link 
                                href="/restock-requests"
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                              >
                                {language === 'id' ? 'AJUKAN RESTOCK' : 'PROPOSE RESTOCK'}
                              </Link>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-white/5 bg-white/[0.01] flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              <div>
                {language === 'id'
                  ? `Sistem menyaring ${lowStockProducts.length} item kritis dari total keseluruhan inventaris.`
                  : `Filtering ${lowStockProducts.length} depleted units out of total active system mesh.`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
