'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction, Product } from '@/types/inventory';
import { History, ArrowUpCircle, ArrowDownCircle, Search, Calendar, FileText, Package, Trash2, Download, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { useLanguage } from '@/hooks/use-language';

export default function TransactionsPage() {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<(Transaction & { products: Product })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchTransactions();
  }, []);

  const exportToCSV = (type: 'weekly' | 'monthly' | 'all') => {
    const now = new Date();
    let filtered = transactions;

    if (type === 'weekly') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = transactions.filter(t => new Date(t.timestamp) >= oneWeekAgo);
    } else if (type === 'monthly') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = transactions.filter(t => new Date(t.timestamp) >= oneMonthAgo);
    }

    if (filtered.length === 0) {
      alert('No transactions found for the selected period.');
      return;
    }

    const headers = ['ID', 'Product', 'Type', 'Quantity', 'Date', 'Time', 'Operator', 'Note'];
    const rows = filtered.map(t => {
      const operatorMatch = t.note?.match(/^\[Operator: (.*?)\]/);
      const operator = t.user_name || (operatorMatch ? operatorMatch[1] : 'System');
      const cleanNote = t.note?.replace(/^\[Operator: .*?\]\s?/, '') || '';
      
      return [
        t.id,
        t.products?.name || 'Unknown',
        t.type === 'in' ? 'RECEIVE' : 'DISPATCH',
        t.quantity,
        new Date(t.timestamp).toLocaleDateString(),
        new Date(t.timestamp).toLocaleTimeString(),
        operator,
        cleanNote.replace(/,/g, ';')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${type}_${now.toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDropdownOpen(false);
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, products(*)')
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Permanent Deletion: This transaction log will be removed from the audit trail and stock will be reverted. Proceed?')) return;
    
    try {
      // THE TRIGGER IN THE DB WILL AUTOMATICALLY REVERT stock_quantity ON DELETE
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (deleteError) throw new Error(deleteError.message);

      setTransactions(transactions.filter(t => t.id !== id));
    } catch (err) {
      alert('Delete failed: ' + (err as Error).message);
    }
  };

  const filteredTransactions = transactions.filter(t => 
    t.products?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.slice(0, 8).includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[9px] sm:text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">Module 03 / Audit Ledger</span>
            <div className="h-1 w-1 bg-slate-700 rounded-full" />
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Permanent History</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{t.transactions.title}</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="relative flex-1 sm:flex-none">
            <button 
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 text-[10px] sm:text-xs font-bold px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl hover:bg-slate-800 transition-all active:scale-95"
            >
              <Download size={16} className="text-indigo-400" />
              <span className="hidden xs:inline">{t.transactions.exportLedger.toUpperCase()}</span>
              <span className="xs:hidden">EXPORT</span>
              <ChevronDown size={14} className={`transition-transform ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isExportDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-[#111114] border border-white/5 rounded-2xl shadow-2xl p-2 z-50 overflow-hidden"
                >
                  <button 
                    onClick={() => exportToCSV('weekly')}
                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                  >
                    {t.transactions.weeklySummary}
                  </button>
                  <button 
                    onClick={() => exportToCSV('monthly')}
                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                  >
                    {t.transactions.monthlyAudit}
                  </button>
                  <div className="h-px bg-white/5 my-1" />
                  <button 
                    onClick={() => exportToCSV('all')}
                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/5 rounded-xl transition-all"
                  >
                    {t.transactions.historicalDump}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-3 bg-[#111114] border border-white/5 rounded-2xl flex flex-col justify-center">
              <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">Volume</span>
              <span className="text-xs sm:text-sm font-mono text-slate-100 font-black">{transactions.length} ACTIONS</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
        <input 
          type="text" 
          placeholder={t.common.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#111114]/50 border border-white/5 rounded-3xl pl-16 pr-8 py-5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 backdrop-blur-sm"
        />
      </div>

      {/* Transaction List */}
      <div className="bg-[#111114]/50 backdrop-blur-sm border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
      <tr className="bg-white/[0.02] border-b border-white/5">
        <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-left hidden lg:table-cell">Hash</th>
        <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-left">{t.inventory.table.toUpperCase()}</th>
        <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-left hidden sm:table-cell">{t.transactions.type.toUpperCase()}</th>
        <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-left">{t.common.quantity.toUpperCase()}</th>
        <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-left">{t.common.date.toUpperCase()}</th>
        <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-left hidden sm:table-cell">{t.transactions.operator.toUpperCase()}</th>
        <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-left hidden md:table-cell">{t.common.note.toUpperCase()}</th>
        <th className="p-4 sm:p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-right">{t.common.action.toUpperCase()}</th>
      </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-20 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                    {t.transactions.loadingVault}
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-20 text-center text-slate-600 font-bold uppercase tracking-widest text-[10px]">
                    {t.transactions.noLogs}
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const operatorMatch = tx.note?.match(/^\[Operator: (.*?)\]/);
                  const operator = tx.user_name || (operatorMatch ? operatorMatch[1] : 'System');
                  const cleanNote = tx.note?.replace(/^\[Operator: .*?\]\s?/, '') || '';

                  return (
                    <motion.tr 
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-white/[0.01] transition-colors group"
                    >
                      <td className="p-4 sm:p-6 hidden lg:table-cell">
                        <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-indigo-400 transition-colors">
                          #{tx.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 sm:p-6">
                        <Link href={`/products/${tx.product_id}`} className="flex items-center gap-2 sm:gap-3 hover:text-indigo-400 transition-colors">
                          <div className="w-8 h-8 bg-slate-900 rounded-lg hidden xs:flex items-center justify-center border border-white/5">
                            <Package size={14} className="text-slate-500" />
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate max-w-[80px] sm:max-w-none">{tx.products?.name}</span>
                        </Link>
                      </td>
                      <td className="p-4 sm:p-6 hidden sm:table-cell">
                        <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                          tx.type === 'in' ? 'text-emerald-500' : 'text-rose-500'
                        }`}>
                          {tx.type === 'in' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                          <span className="hidden lg:inline">{tx.type === 'in' ? t.transactions.receive : t.transactions.dispatch}</span>
                        </div>
                      </td>
                      <td className="p-4 sm:p-6">
                        <span className={`text-base sm:text-lg font-mono font-black ${
                          tx.type === 'in' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {tx.type === 'in' ? '+' : '-'}{tx.quantity}
                        </span>
                      </td>
                      <td className="p-4 sm:p-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] sm:text-xs font-bold text-slate-300 whitespace-nowrap">{new Date(tx.timestamp).toLocaleDateString()}</span>
                          <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono hidden sm:inline">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="p-4 sm:p-6 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                            <span className="text-[8px] font-bold text-indigo-400 capitalize">{operator[0]}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 truncate max-w-[80px]">{operator}</span>
                        </div>
                      </td>
                      <td className="p-4 sm:p-6 hidden md:table-cell">
                        <p className="text-xs text-slate-500 italic max-w-[150px] truncate">
                          {cleanNote || 'No notes'}
                        </p>
                      </td>
                      <td className="p-4 sm:p-6 text-right">
                        <button 
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="mt-8 border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <p>
            Audit Trail Protocol: <span className="text-indigo-400">RFC-5424 Active</span>
          </p>
          <p>
            Showing: <span className="text-white">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredTransactions.length)}</span> of <span className="text-white">{filteredTransactions.length}</span> Records
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 border border-white/5 rounded-xl hover:bg-white/5 transition-all disabled:opacity-20 flex items-center gap-2 px-4 group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="hidden xs:inline text-[8px]">{t.transactions.previous}</span>
          </button>

          <div className="flex gap-1 overflow-x-auto max-w-[120px] sm:max-w-none no-scrollbar px-2">
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
            className="p-2 border border-white/5 rounded-xl hover:bg-white/5 transition-all disabled:opacity-20 flex items-center gap-2 px-4 group"
          >
            <span className="hidden xs:inline text-[8px]">{t.transactions.next}</span>
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
