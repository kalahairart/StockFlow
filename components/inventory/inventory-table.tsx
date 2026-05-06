'use client';

import { Product } from '@/types/inventory';
import { MoreHorizontal, AlertTriangle, ChevronLeft, ChevronRight, Package, ShieldCheck, ArrowUpDown, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useMemo } from 'react';
import Link from 'next/link';

interface InventoryTableProps {
  products: Product[];
  onDelete?: (id: string) => void;
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

export default function InventoryTable({ products, onDelete }: InventoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
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
  }, [products, sortKey, sortOrder]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

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
          <tbody className="divide-y divide-white/[0.03] text-sm">
            {sortedProducts.map((product) => {
              const isCritical = product.stock_quantity <= product.min_stock;
              return (
                <motion.tr 
                  key={product.id} 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
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
          </tbody>
        </table>
      </div>
      
      {/* Footer Controls */}
      <div className="mt-auto border-t border-white/5 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">
        <p className="order-2 sm:order-1 text-center sm:text-left">Telemetry: <span className="text-slate-300">Active Monitoring</span> | Entries: <span className="text-white">{products.length}</span></p>
        <div className="flex items-center gap-2 order-1 sm:order-2">
          <button className="p-2 border border-white/5 rounded-xl hover:bg-white/5 transition-all disabled:opacity-20" disabled>
            <ChevronLeft size={16} />
          </button>
          <div className="flex gap-1">
            <button className="w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-900/40">1</button>
            <button className="w-8 h-8 flex items-center justify-center hover:bg-white/5 text-slate-400 rounded-xl">2</button>
          </div>
          <button className="p-2 border border-white/5 rounded-xl hover:bg-white/5 transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
