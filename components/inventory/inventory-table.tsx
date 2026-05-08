'use client';

import { Product } from '@/types/inventory';
import { MoreHorizontal, AlertTriangle, ChevronLeft, ChevronRight, Package, ShieldCheck, ArrowUpDown, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo } from 'react';
import Link from 'next/link';

interface InventoryTableProps {
  products: Product[];
  onDelete?: (id: string) => void;
  viewMode?: 'table' | 'grid';
}

type SortKey = 'name' | 'category' | 'stock_quantity';
type SortOrder = 'asc' | 'desc';

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <div className="flex items-center gap-1">
        <button 
          onClick={onConfirm}
          className="px-3 py-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-lg transition-all active:scale-95"
        >
          CONFIRM
        </button>
        <button 
          onClick={() => setIsConfirming(false)}
          className="px-3 py-1.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-lg transition-all border border-white/5"
        >
          ESC
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={() => setIsConfirming(true)}
      className="px-3 py-1.5 bg-rose-500/5 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold rounded-lg transition-all border border-rose-500/10 active:scale-95"
    >
      DELETE
    </button>
  );
}

export default function InventoryTable({ products, onDelete, viewMode = 'table' }: InventoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const sortedProducts = useMemo(() => {
    const list = [...products].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
    return list;
  }, [products, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedProducts.slice(start, start + itemsPerPage);
  }, [sortedProducts, currentPage, itemsPerPage]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  if (viewMode === 'grid') {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {paginatedProducts.map((product) => {
              const isCritical = product.stock_quantity <= product.min_stock;
              return (
                <motion.div
                  layout
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`bg-[#111114]/50 backdrop-blur-sm border border-white/5 rounded-3xl p-6 flex flex-col gap-5 hover:bg-white/[0.02] transition-colors relative group overflow-hidden ${isCritical ? 'ring-1 ring-rose-500/20' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-2xl border ${isCritical ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-slate-800/40 border-white/5 text-slate-400'}`}>
                      <Package size={20} />
                    </div>
                    <DeleteButton onConfirm={() => onDelete?.(product.id)} />
                  </div>

                  <div>
                    <Link href={`/products/${product.id}`} className="text-lg font-bold text-white tracking-tight hover:text-indigo-400 transition-colors line-clamp-1">
                      {product.name}
                    </Link>
                    <p className="text-[10px] text-slate-600 font-mono tracking-widest mt-1 uppercase">ID: {product.id.slice(0, 8)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Stock</p>
                      <p className={`text-xl font-mono font-black ${isCritical ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {product.stock_quantity}
                      </p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Threshold</p>
                      <p className="text-xl font-mono font-black text-slate-300">{product.min_stock}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/5">
                    <div className="flex flex-col">
                      <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Classification</p>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{product.category}</span>
                    </div>
                    <Link 
                      href={`/products/${product.id}`}
                      className="p-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 rounded-xl transition-all"
                    >
                      <ExternalLink size={16} />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        
        {/* Pagination Controls */}
        <div className="mt-4 border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">
          <p>Page <span className="text-white">{currentPage}</span> of <span className="text-white">{totalPages || 1}</span> | Matches: <span className="text-white">{products.length}</span></p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-white/5 rounded-xl hover:bg-white/5 transition-all disabled:opacity-20"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button 
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${currentPage === page ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'hover:bg-white/5 text-slate-400'}`}
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
    );
  }

  return (
    <div className="flex-1 bg-[#111114]/50 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/5">
              <th className="p-4 sm:p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] w-[40%] sm:w-auto">
                <button onClick={() => toggleSort('name')} className="flex items-center gap-2 hover:text-white transition-colors">
                  Item
                  <ArrowUpDown size={12} className={sortKey === 'name' ? 'text-indigo-400' : ''} />
                </button>
              </th>
              <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] hidden md:table-cell">
                <button onClick={() => toggleSort('category')} className="flex items-center gap-2 hover:text-white transition-colors">
                  Category
                  <ArrowUpDown size={12} className={sortKey === 'category' ? 'text-indigo-400' : ''} />
                </button>
              </th>
              <th className="p-4 sm:p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                <button onClick={() => toggleSort('stock_quantity')} className="flex items-center gap-2 hover:text-white transition-colors">
                  Qty
                  <ArrowUpDown size={12} className={sortKey === 'stock_quantity' ? 'text-indigo-400' : ''} />
                </button>
              </th>
              <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] hidden lg:table-cell">Unit Cost</th>
              <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] hidden sm:table-cell">Status</th>
              <th className="p-4 sm:p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-right">Ops</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03] text-sm text-slate-300">
            <AnimatePresence mode="popLayout">
              {paginatedProducts.map((product) => {
                const isCritical = product.stock_quantity <= product.min_stock;
                return (
                  <motion.tr 
                    layout
                    key={product.id} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`group transition-all duration-300 ${isCritical ? 'bg-rose-500/[0.03] hover:bg-rose-500/[0.08]' : 'hover:bg-white/[0.02]'}`}
                  >
                    <td className="p-4 sm:p-5">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`p-2 rounded-lg sm:p-2.5 sm:rounded-xl border ${isCritical ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-slate-800/40 border-white/5 text-slate-400'} hidden xs:block`}>
                          <Package size={14} className="sm:w-4 sm:h-4" />
                        </div>
                        <div className="min-w-0">
                          <Link href={`/products/${product.id}`} className="text-white font-bold tracking-tight hover:text-indigo-400 transition-colors block truncate max-w-[120px] sm:max-w-none">
                            {product.name}
                          </Link>
                          <p className="text-[9px] sm:text-[10px] text-slate-600 font-mono tracking-widest mt-0.5 truncate">ID: {product.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 hidden md:table-cell">
                      <span className="px-3 py-1 rounded-lg bg-slate-800/40 text-slate-400 font-bold text-[10px] uppercase tracking-wider border border-white/5">
                        {product.category}
                      </span>
                    </td>
                    <td className="p-4 sm:p-5">
                      <div className="flex flex-col gap-1">
                        <span className={`font-mono text-sm sm:text-base font-bold ${isCritical ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {product.stock_quantity.toLocaleString()}
                        </span>
                        <div className="w-16 sm:w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isCritical ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${Math.min((product.stock_quantity / (product.min_stock || 1)) * 20, 100)}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-5 hidden lg:table-cell">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.unit_cost || 0)}
                      </span>
                    </td>
                    <td className="p-5 hidden sm:table-cell">
                      {isCritical ? (
                        <div className="flex items-center gap-2 text-rose-500 text-[9px] sm:text-[10px] font-black uppercase tracking-tighter bg-rose-500/10 px-2 sm:px-2.5 py-1.5 rounded-lg border border-rose-500/20 w-fit">
                          <AlertTriangle size={12} className="animate-pulse" />
                          <span className="hidden md:inline">Crit. Threshold</span>
                          <span className="md:hidden">CRIT</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-500 text-[9px] sm:text-[10px] font-black uppercase tracking-tighter bg-emerald-500/10 px-2 sm:px-2.5 py-1.5 rounded-lg border border-emerald-500/20 w-fit">
                          <ShieldCheck size={12} />
                          <span className="hidden md:inline">Nominal Stock</span>
                          <span className="md:hidden">NOM</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 sm:p-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                         <Link 
                          href={`/products/${product.id}`}
                          className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition-all border border-white/5 active:scale-95 flex items-center gap-1.5"
                          title="Details"
                         >
                          <span className="hidden xs:inline">DETAILS</span>
                          <ExternalLink size={10} />
                        </Link>
                        <DeleteButton onConfirm={() => onDelete?.(product.id)} />
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      
      {/* Footer Controls */}
      <div className="mt-auto border-t border-white/5 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">
        <p className="order-2 sm:order-1 text-center sm:text-left">Telemetry: <span className="text-slate-300">Active Monitoring</span> | Page: <span className="text-white">{currentPage}/{totalPages || 1}</span></p>
        <div className="flex items-center gap-2 order-1 sm:order-2">
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
  );
}
