'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, 
  Shield, 
  TrendingDown, 
  User, 
  Mail, 
  Search, 
  ArrowLeft, 
  Clock, 
  Calendar, 
  DollarSign, 
  Package, 
  FileSpreadsheet, 
  ChevronRight, 
  ChevronDown, 
  Lock, 
  RefreshCw 
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { supabase } from '@/lib/supabase';
import { Transaction, Product } from '@/types/inventory';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';

// Import Recharts components for the visual operator performance comparison
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  last_active: string;
}

interface OperatorStats {
  operatorName: string;
  email?: string;
  userId?: string;
  role?: string;
  outgoingTransactionCount: number;
  totalQuantityOut: number;
  totalValueOut: number;
  lastTransactionDate: string;
  recentTransactions: (Transaction & { products: Product | null })[];
}

interface ChartItem {
  name: string;
  quantity: number;
}

// Custom tooltip renderer for the Recharts BarChart component matching the application dark theme
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div id="chart-custom-tooltip" className="bg-[#0f0f12] border border-white/10 p-4 rounded-2xl shadow-2xl">
        <p id="tooltip-operator-name" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{payload[0].payload.name}</p>
        <p id="tooltip-operator-qty" className="text-sm font-mono font-black text-indigo-400 mt-1">
          {payload[0].value.toLocaleString('id-ID')} Pcs
        </p>
      </div>
    );
  }
  return null;
};

export default function OutgoingActivityPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const [activeOperators, setActiveOperators] = useState<OperatorStats[]>([]);
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOperator, setExpandedOperator] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchAndProcessStats = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch registered users from administrative service cache
      let registeredUsers: UserItem[] = [];
      try {
        const userRes = await fetch('/api/admin/users');
        const userData = await userRes.json();
        if (userData.success) {
          registeredUsers = userData.users || [];
        }
      } catch (err) {
        console.warn('Failed to retrieve system users roster, using standard logs match:', err);
      }

      // 2. Fetch all Outgoing (Type = 'out') Transactions and their corresponding product details
      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .select('*, products(*)')
        .eq('type', 'out')
        .order('timestamp', { ascending: false });

      if (transError) {
        console.error('Failed to retrieve transactions:', transError);
        return;
      }

      const transactions = (transData || []) as (Transaction & { products: Product | null })[];

      // 3. Process and group transactions by operator
      const operatorsMap: { [key: string]: OperatorStats } = {};

      transactions.forEach((tx) => {
        // Extract operator name from standard [Operator: XX] note token, or fallback to user_name / System
        const operatorMatch = tx.note?.match(/^\[Operator: (.*?)\]/);
        const name = tx.user_name || (operatorMatch ? operatorMatch[1] : 'System');
        const normalizedKey = name.trim().toLowerCase();

        // Calculate transaction subtotal value
        const itemVal = (tx.quantity || 0) * (tx.unit_cost || tx.products?.unit_cost || 0);

        if (!operatorsMap[normalizedKey]) {
          operatorsMap[normalizedKey] = {
            operatorName: name,
            outgoingTransactionCount: 0,
            totalQuantityOut: 0,
            totalValueOut: 0,
            lastTransactionDate: tx.timestamp,
            recentTransactions: []
          };
        }

        const op = operatorsMap[normalizedKey];
        op.outgoingTransactionCount += 1;
        op.totalQuantityOut += tx.quantity || 0;
        op.totalValueOut += itemVal;

        // Since query is ordered from newest to oldest, the first encounter sets the latest activity date
        if (new Date(tx.timestamp) > new Date(op.lastTransactionDate)) {
          op.lastTransactionDate = tx.timestamp;
        }

        // Keep a list of their recent 5 transactions for detail drawer view
        if (op.recentTransactions.length < 5) {
          op.recentTransactions.push(tx);
        }
      });

      // 4. Enrich operator stats with registered system metadata (emails / user UUIDs)
      const enrichedStats: OperatorStats[] = Object.values(operatorsMap).map((op) => {
        // Try exact match on name (normalized) or lookup via transaction user_id
        const systemAccount = registeredUsers.find((u) => 
          u.full_name.trim().toLowerCase() === op.operatorName.trim().toLowerCase() ||
          (op.recentTransactions[0]?.user_id && u.id === op.recentTransactions[0]?.user_id)
        );

        if (systemAccount) {
          return {
            ...op,
            email: systemAccount.email,
            userId: systemAccount.id,
            role: systemAccount.role
          };
        }
        return op;
      });

      // Sorted by transaction volume/count desc
      enrichedStats.sort((a, b) => b.outgoingTransactionCount - a.outgoingTransactionCount);
      setActiveOperators(enrichedStats);

      // 5. Calculate Top 5 active operators over the last 30 days for Recharts
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const thirtyDaysMap: { [key: string]: { name: string; quantity: number } } = {};

      transactions.forEach((tx) => {
        const txDate = new Date(tx.timestamp);
        if (txDate >= thirtyDaysAgo) {
          const operatorMatch = tx.note?.match(/^\[Operator: (.*?)\]/);
          const name = tx.user_name || (operatorMatch ? operatorMatch[1] : 'System');
          const normalizedKey = name.trim().toLowerCase();

          if (!thirtyDaysMap[normalizedKey]) {
            thirtyDaysMap[normalizedKey] = {
              name: name,
              quantity: 0
            };
          }
          thirtyDaysMap[normalizedKey].quantity += tx.quantity || 0;
        }
      });

      const top5ChartData = Object.values(thirtyDaysMap)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      setChartData(top5ChartData);
    } catch (err) {
      console.error('Error fetching/aggregating dispatch stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchAndProcessStats();
    }
  }, [authLoading, isAdmin]);

  const exportActivityReport = () => {
    if (activeOperators.length === 0) {
      alert('Tidak ada data aktivitas operator untuk diekspor.');
      return;
    }

    const headers = ['Operator Name', 'Linked Email', 'Auth UUID', 'Outgoing Transactions Count', 'Total Items Dispatched', 'Total Value (IDR)', 'Last Active Timestamp'];
    const rows = activeOperators.map((op) => [
      op.operatorName,
      op.email || 'N/A',
      op.userId || 'N/A',
      op.outgoingTransactionCount,
      op.totalQuantityOut,
      op.totalValueOut,
      op.lastTransactionDate
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.id = 'download-activity-link';
    link.setAttribute('href', url);
    link.setAttribute('download', `operator_dispatch_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading) {
    return (
      <div id="loading-container" className="flex-1 flex flex-col items-center justify-center space-y-4">
        <div id="loader-spinner" className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p id="loader-label" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verifying Authority...</p>
      </div>
    );
  }

  // Guard Clause for unauthorized roles
  if (!isAdmin) {
    return (
      <div id="unauthorized-container" className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto text-center">
        <div id="lock-icon-wrapper" className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl mb-6">
          <Lock id="lock-icon" size={32} />
        </div>
        <h1 id="unauthorized-title" className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2">Akses Ditolak / Access Denied</h1>
        <p id="unauthorized-desc" className="text-sm text-slate-500 mb-6 leading-relaxed">
          Halaman ini berisi laporan aktivitas pengeluaran staf yang sangat rahasia. Hanya dapat diakses oleh Administrator Sistem.
        </p>
        <Link 
          id="back-to-home-link"
          href="/"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/40 uppercase tracking-widest flex items-center gap-2"
        >
          <ArrowLeft id="back-arrow-icon" size={14} />
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const filteredOperators = activeOperators.filter(op =>
    op.operatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (op.email && op.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (op.userId && op.userId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Compute stats metrics
  const totalOutgoingTransactions = activeOperators.reduce((acc, curr) => acc + curr.outgoingTransactionCount, 0);
  const totalItemsOut = activeOperators.reduce((acc, curr) => acc + curr.totalQuantityOut, 0);
  const totalValueOut = activeOperators.reduce((acc, curr) => acc + curr.totalValueOut, 0);
  const mostActiveOperator = activeOperators.length > 0 ? activeOperators[0].operatorName : 'N/A';

  return (
    <div id="outgoing-activity-page" className="flex flex-col gap-8 h-full">
      {/* Header */}
      <div id="page-header" className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mr-2">
        <div id="header-text-container">
          <div id="module-sub-header" className="flex items-center gap-3 mb-2">
            <span id="module-label" className="text-[9px] sm:text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">Module 07 / Authorized Monitoring</span>
            <div id="header-separator-dot" className="h-1 w-1 bg-slate-700 rounded-full" />
            <span id="role-status-label" className="text-[9px] sm:text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em] flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              <Shield size={10} /> Admin Only
            </span>
          </div>
          <h1 id="page-title" className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Activity id="activity-icon" size={28} className="text-indigo-400" />
            {language === 'id' ? 'Aktivitas Pengeluaran Barang' : 'Outgoing Operator Report'}
          </h1>
        </div>

        <div id="actions-container" className="flex items-center gap-2 sm:gap-3">
          <button 
            id="refresh-data-btn"
            onClick={fetchAndProcessStats}
            disabled={isLoading}
            className="p-2 sm:p-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all hover:bg-slate-800 shrink-0 disabled:opacity-40"
          >
            <RefreshCw id="refresh-icon" size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          <button 
            id="export-activity-btn"
            onClick={exportActivityReport}
            className="px-4 py-2.5 bg-slate-900 border border-white/5 hover:border-white/10 text-slate-200 hover:text-white text-xs font-bold rounded-2xl transition-all flex items-center gap-2 uppercase tracking-wider"
          >
            <FileSpreadsheet id="spreadsheet-icon" size={15} className="text-emerald-500" />
            {language === 'id' ? 'Ekspor Laporan' : 'Export Report'}
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div id="metrics-grid" className="grid grid-cols-1 md:grid-cols-4 gap-6 mr-2">
        <div id="metric-card-total-tx" className="bg-[#111114]/50 border border-white/5 rounded-3xl p-6 flex items-center gap-4 shadow-xl">
          <div id="total-tx-icon-wrapper" className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
            <TrendingDown id="trending-down-icon" size={24} />
          </div>
          <div id="total-tx-content">
            <p id="total-tx-label" className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {language === 'id' ? 'Total Transaksi Keluar' : 'Total Dispatch Transacts'}
            </p>
            <p id="total-tx-value" className="text-2.5xl font-mono font-black text-white mt-0.5">{totalOutgoingTransactions}</p>
          </div>
        </div>

        <div id="metric-card-total-items" className="bg-[#111114]/50 border border-white/5 rounded-3xl p-6 flex items-center gap-4 shadow-xl">
          <div id="total-items-icon-wrapper" className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
            <Package id="package-icon-metric" size={24} />
          </div>
          <div id="total-items-content">
            <p id="total-items-label" className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {language === 'id' ? 'Total Barang Keluar (Units)' : 'Total Dispatch Qty'}
            </p>
            <p id="total-items-value" className="text-2.5xl font-mono font-black text-white mt-0.5">{totalItemsOut}</p>
          </div>
        </div>

        <div id="metric-card-total-value" className="bg-[#111114]/50 border border-white/5 rounded-3xl p-6 flex items-center gap-4 shadow-xl">
          <div id="total-val-icon-wrapper" className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
            <DollarSign id="dollar-icon-metric" size={24} />
          </div>
          <div id="total-val-content">
            <p id="total-val-label" className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {language === 'id' ? 'Total Nilai Nominal Keluar' : 'Total Dispatched Value'}
            </p>
            <p id="total-val-value" className="text-xl font-mono font-black text-emerald-400 mt-0.5">
              Rp {totalValueOut.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        <div id="metric-card-most-active" className="bg-[#111114]/50 border border-white/5 rounded-3xl p-6 flex items-center gap-4 shadow-xl">
          <div id="most-active-icon-wrapper" className="p-3.5 bg-[#4F46E5]/10 border border-[#4F46E5]/25 text-[#6366F1] rounded-2xl">
            <User id="user-icon-metric" size={24} />
          </div>
          <div id="most-active-content" className="min-w-0 flex-1">
            <p id="most-active-label" className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {language === 'id' ? 'Operator Teraktif' : 'Most Active Operator'}
            </p>
            <p id="most-active-value" className="text-sm font-bold text-white truncate mt-1">
              {mostActiveOperator}
            </p>
          </div>
        </div>
      </div>

      {/* Recharts Bar Chart Container */}
      <div id="operator-activity-chart-card" className="bg-[#111114]/50 border border-white/5 rounded-3xl p-6 mr-2 shadow-xl">
        <div id="chart-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 id="chart-card-title" className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Activity id="chart-title-icon" size={16} className="text-indigo-400" />
              {language === 'id' ? 'Volume Pengeluaran Operator (30 Hari Terakhir)' : 'Operator Dispatch Volume (Last 30 Days)'}
            </h2>
            <p id="chart-card-subtitle" className="text-[11px] text-slate-500 mt-1">
              {language === 'id' ? 'Komparasi 5 operator teraktif berdasarkan total kuantitas barang yang dikeluarkan' : 'Comparison of the top 5 most active operators by total quantities dispatched'}
            </p>
          </div>
          <div id="chart-timeframe-tag" className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-[9px] text-indigo-400 font-bold uppercase tracking-wider rounded-xl self-start sm:self-auto">
            30 Days Window
          </div>
        </div>

        {isLoading ? (
          <div id="chart-loading-state" className="h-[280px] flex flex-col items-center justify-center space-y-3">
            <div id="chart-loader" className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p id="chart-loader-text" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Generating Chart...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div id="chart-empty-state" className="h-[280px] flex flex-col items-center justify-center text-center bg-slate-950/20 rounded-2.5xl border border-dashed border-white/5">
            <TrendingDown id="empty-chart-icon" size={28} className="text-slate-700 mb-2" />
            <p id="empty-chart-text" className="text-xs text-slate-500">
              {language === 'id' ? 'Tidak ada data transaksi pengeluaran dalam 30 hari terakhir.' : 'No outgoing transactions registered in the last 30 days.'}
            </p>
          </div>
        ) : (
          <div id="responsive-chart-wrapper" className="h-[280px] w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818CF8" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#475569" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#94A3B8', fontWeight: 500 }}
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#94A3B8' }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
                  <Bar 
                    dataKey="quantity" 
                    fill="url(#barGradient)" 
                    radius={[8, 8, 0, 0]} 
                    maxBarSize={50}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="url(#barGradient)" className="transition-all hover:opacity-100 opacity-80" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* Control Panel: Search */}
      <div id="control-bar" className="flex flex-col sm:flex-row items-center justify-between gap-4 mr-2">
        <div id="search-input-wrapper" className="relative w-full sm:max-w-md">
          <div id="search-icon-pos" className="absolute inset-y-0 left-0 pl-1.5 ml-2.5 flex items-center pointer-events-none text-slate-600">
            <Search id="search-bar-icon" size={16} />
          </div>
          <input
            id="operator-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'id' ? 'Cari operator berdasarkan nama, email, atau UUID...' : 'Search operators by name, email or UUID...'}
            className="w-full bg-[#111114]/50 border border-white/5 pl-11 pr-4 py-3 sm:py-3.5 text-xs text-white placeholder-slate-600 rounded-2xl focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
          />
        </div>
      </div>

      {/* Main Roster list */}
      <div id="main-roster-section" className="flex-1 min-h-[400px] flex flex-col mr-2">
        {isLoading ? (
          <div id="aggregating-loader" className="flex-1 flex flex-col items-center justify-center space-y-4">
            <div id="spinner-running" className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p id="spinner-text" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aggregating Dispatch Logs...</p>
          </div>
        ) : filteredOperators.length === 0 ? (
          <div id="no-operators-fallback" className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-[#111114]/30 rounded-3xl border border-dashed border-white/5">
            <Activity id="no-act-icon" size={48} className="text-slate-700 mb-4" />
            <h3 id="no-act-title" className="text-lg font-bold text-slate-300">
              {language === 'id' ? 'Tidak ada operator aktif ditemukan.' : 'No active dispatchers found.'}
            </h3>
            <p id="no-act-desc" className="text-slate-500 text-xs mt-2 max-w-sm">
              {language === 'id' 
                ? 'Tidak ada operator yang tercatat melakukan transaksi pengeluaran barang dalam basis data log.' 
                : 'No accounts have processed database removals (transactions of dispatch/out status) yet.'}
            </p>
          </div>
        ) : (
          <div id="operators-accordion-list" className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredOperators.map((op, idx) => {
                const isExpanded = expandedOperator === op.operatorName;
                const initials = op.operatorName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

                return (
                  <motion.div
                    layout
                    id={`op-card-${idx}`}
                    key={op.operatorName}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="bg-[#111114]/50 border border-white/5 hover:border-white/10 rounded-3xl overflow-hidden shadow-xl transition-all"
                  >
                    {/* Header Row */}
                    <div 
                      id={`op-card-header-${idx}`}
                      onClick={() => setExpandedOperator(isExpanded ? null : op.operatorName)}
                      className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.01] transition-all"
                    >
                      <div id={`op-info-col-${idx}`} className="flex items-center gap-4 min-w-0">
                        {/* Profile initials circle */}
                        <div id={`op-avatar-${idx}`} className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                          {initials || <User size={18} />}
                        </div>
                        <div id={`op-text-${idx}`} className="min-w-0">
                          <span id={`op-name-${idx}`} className="text-white font-black tracking-tight text-base sm:text-lg block">
                            {op.operatorName}
                          </span>
                          
                          <div id={`op-sub-info-${idx}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
                            {op.email && (
                              <span id={`op-email-${idx}`} className="flex items-center gap-1 font-mono text-slate-400">
                                <Mail size={11} className="text-slate-600" />
                                {op.email}
                              </span>
                            )}
                            {op.email && <span id={`op-sep-${idx}`} className="h-1 w-1 bg-slate-800 rounded-full hidden sm:block" />}
                            <span id={`op-last-act-${idx}`} className="flex items-center gap-1 font-mono">
                              <Clock id={`op-clock-icon-${idx}`} size={11} className="text-slate-600" />
                              {language === 'id' ? 'Aktif Terakhir:' : 'Last Dispatch:'}{' '}
                              {new Date(op.lastTransactionDate).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stat summary counters */}
                      <div id={`op-stats-summary-${idx}`} className="flex items-center gap-6 sm:gap-8 justify-between w-full sm:w-auto shrink-0 border-t border-white/5 sm:border-t-0 pt-4 sm:pt-0">
                        <div id={`op-stat-tx-${idx}`} className="text-left sm:text-right">
                          <span id={`op-stat-tx-lbl-${idx}`} className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">
                            {language === 'id' ? 'Banyak Transaksi' : 'Transacts Count'}
                          </span>
                          <span id={`op-stat-tx-val-${idx}`} className="text-base font-mono font-bold text-white mt-0.5 block">
                            {op.outgoingTransactionCount}x
                          </span>
                        </div>

                        <div id={`op-stat-qty-${idx}`} className="text-left sm:text-right">
                          <span id={`op-stat-qty-lbl-${idx}`} className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">
                            {language === 'id' ? 'Jumlah Volume' : 'Total Units'}
                          </span>
                          <span id={`op-stat-qty-val-${idx}`} className="text-base font-mono font-bold text-indigo-400 mt-0.5 block">
                            {op.totalQuantityOut} Pcs
                          </span>
                        </div>

                        <div id={`op-stat-val-${idx}`} className="text-left sm:text-right">
                          <span id={`op-stat-val-lbl-${idx}`} className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">
                            {language === 'id' ? 'Nilai Nominal' : 'Cost Value'}
                          </span>
                          <span id={`op-stat-val-val-${idx}`} className="text-sm font-mono font-extrabold text-emerald-400 mt-0.5 block">
                            Rp {op.totalValueOut.toLocaleString('id-ID')}
                          </span>
                        </div>

                        <div id={`op-arrow-wrapper-${idx}`} className="p-2 sm:p-2.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all self-center">
                          {isExpanded ? <ChevronDown id={`chevron-down-${idx}`} size={16} /> : <ChevronRight id={`chevron-right-${idx}`} size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Drawer with Recent 5 Outgoing Records */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          id={`op-drawer-${idx}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="border-t border-white/5 bg-slate-950/25 overflow-hidden"
                        >
                          <div id={`op-drawer-content-${idx}`} className="p-6">
                            <h4 id={`op-drawer-title-${idx}`} className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Calendar id={`cal-icon-drawer-${idx}`} size={12} className="text-indigo-400" />
                              {language === 'id' ? `Daftar Transaksi Terakhir oleh ${op.operatorName}` : `Recent Dispatches of ${op.operatorName}`}
                            </h4>

                            <div id={`op-transactions-list-${idx}`} className="space-y-3">
                              {op.recentTransactions.map((tx, tIdx) => {
                                const cleanNote = tx.note?.replace(/^\[Operator: .*?\]\s?/, '') || '';
                                const lineValue = (tx.quantity || 0) * (tx.unit_cost || tx.products?.unit_cost || 0);

                                return (
                                  <div
                                    id={`tx-log-row-${idx}-${tIdx}`}
                                    key={tx.id}
                                    className="bg-slate-900/40 border border-white/5 hover:border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                                  >
                                    <div id={`tx-log-left-${idx}-${tIdx}`} className="flex items-center gap-3">
                                      <div id={`tx-log-icon-${idx}-${tIdx}`} className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                                        <TrendingDown size={14} />
                                      </div>
                                      <div>
                                        <span id={`tx-log-prod-${idx}-${tIdx}`} className="text-xs font-bold text-white block">
                                          {tx.products?.name || 'Unknown Item'}
                                        </span>
                                        <span id={`tx-log-sku-${idx}-${tIdx}`} className="text-[9px] font-mono text-slate-600 block mt-0.5 uppercase tracking-wider">
                                          ID: {tx.product_id}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Middle info */}
                                    <div id={`tx-log-middle-${idx}-${tIdx}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 sm:mt-0">
                                      {cleanNote && (
                                        <div id={`tx-log-note-wrapper-${idx}-${tIdx}`} className="max-w-xs">
                                          <span id={`tx-log-note-title-${idx}-${tIdx}`} className="text-[9px] text-slate-600 font-bold uppercase tracking-widest block">Catatan / Note</span>
                                          <span id={`tx-log-note-text-${idx}-${tIdx}`} className="text-[11px] text-slate-400 font-medium line-clamp-1 italic">
                                            &ldquo;{cleanNote}&rdquo;
                                          </span>
                                        </div>
                                      )}

                                      <div id={`tx-log-date-wrapper-${idx}-${tIdx}`}>
                                        <span id={`tx-log-date-title-${idx}-${tIdx}`} className="text-[9px] text-slate-600 font-bold uppercase tracking-widest block">Tanggal / Date</span>
                                        <span id={`tx-log-date-text-${idx}-${tIdx}`} className="text-[11px] text-slate-400 font-mono font-medium block">
                                          {new Date(tx.timestamp).toLocaleString(language === 'id' ? 'id-ID' : 'en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Right values */}
                                    <div id={`tx-log-right-${idx}-${tIdx}`} className="flex items-center gap-6 justify-between sm:justify-end sm:text-right shrink-0 border-t border-white/[0.02] sm:border-t-0 pt-2 sm:pt-0">
                                      <div id={`tx-log-qty-wrapper-${idx}-${tIdx}`}>
                                        <span id={`tx-log-qty-title-${idx}-${tIdx}`} className="text-[9px] text-slate-600 font-bold uppercase tracking-widest block">Dispatched</span>
                                        <span id={`tx-log-qty-text-${idx}-${tIdx}`} className="text-xs font-mono font-bold text-white block mt-0.5">
                                          -{tx.quantity} Pcs
                                        </span>
                                      </div>
                                      
                                      <div id={`tx-log-val-wrapper-${idx}-${tIdx}`}>
                                        <span id={`tx-log-val-title-${idx}-${tIdx}`} className="text-[9px] text-slate-600 font-bold uppercase tracking-widest block">Value</span>
                                        <span id={`tx-log-val-text-${idx}-${tIdx}`} className="text-xs font-mono font-extrabold text-rose-400 block mt-0.5">
                                          Rp {lineValue.toLocaleString('id-ID')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
