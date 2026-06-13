'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction, Product } from '@/types/inventory';
import { 
  FileSpreadsheet, 
  Search, 
  Calendar, 
  Package, 
  Download, 
  TrendingDown, 
  Shield, 
  Lock, 
  RefreshCw, 
  DollarSign, 
  User, 
  CalendarDays,
  FileText,
  Clock,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
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

export default function LogReportPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const [transactions, setTransactions] = useState<(Transaction & { products: Product })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Current calendar month states
  const currentMonthDateObj = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthDateObj.getMonth()); // 0-based
  const [selectedYear, setSelectedYear] = useState<number>(currentMonthDateObj.getFullYear());
  const [periods, setPeriods] = useState<{ month: number; year: number }[]>([]);

  const monthNamesID = useMemo(() => [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ], []);
  
  const monthNamesEN = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ], []);

  const currentMonthName = useMemo(() => {
    return language === 'id' 
      ? `${monthNamesID[selectedMonth]} ${selectedYear}` 
      : `${monthNamesEN[selectedMonth]} ${selectedYear}`;
  }, [selectedMonth, selectedYear, language, monthNamesID, monthNamesEN]);

  const fetchAvailablePeriods = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('timestamp')
        .eq('type', 'out');

      if (error) throw error;

      if (data && data.length > 0) {
        const periodsMap = new Map<string, { month: number; year: number }>();
        
        data.forEach(item => {
          if (!item.timestamp) return;
          const d = new Date(item.timestamp);
          if (isNaN(d.getTime())) return;
          const m = d.getMonth();
          const y = d.getFullYear();
          const key = `${y}-${m}`;
          periodsMap.set(key, { month: m, year: y });
        });

        const sorted = Array.from(periodsMap.values()).sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        });

        setPeriods(sorted);
      } else {
        setPeriods([{ month: currentMonthDateObj.getMonth(), year: currentMonthDateObj.getFullYear() }]);
      }
    } catch (err) {
      console.error('Error fetching available periods:', err);
    }
  }, [currentMonthDateObj]);

  const fetchCurrentMonthTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const startOfPeriod = new Date(selectedYear, selectedMonth, 1);
      const endOfPeriod = new Date(selectedYear, selectedMonth + 1, 1);
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*, products(*)')
        .eq('type', 'out')
        .gte('timestamp', startOfPeriod.toISOString())
        .lt('timestamp', endOfPeriod.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setTransactions((data as any) || []);
    } catch (err: any) {
      console.error('Error loading log report:', err);
      toast.error(language === 'id' ? 'Gagal memuat log' : 'Failed to retrieve logs');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth, language]);

  useEffect(() => {
    if (isAdmin) {
      fetchAvailablePeriods();
    }
  }, [isAdmin, fetchAvailablePeriods]);

  useEffect(() => {
    if (isAdmin) {
      fetchCurrentMonthTransactions();
    }
  }, [isAdmin, fetchCurrentMonthTransactions]);

  const periodOptions = useMemo(() => {
    const list = periods.length > 0 ? periods : [{ month: currentMonthDateObj.getMonth(), year: currentMonthDateObj.getFullYear() }];
    
    const hasSelected = list.some(p => p.month === selectedMonth && p.year === selectedYear);
    const finalPeriods = hasSelected ? list : [{ month: selectedMonth, year: selectedYear }, ...list];

    return finalPeriods.map(p => {
      const label = language === 'id' 
        ? `${monthNamesID[p.month]} ${p.year}` 
        : `${monthNamesEN[p.month]} ${p.year}`;
      return {
        month: p.month,
        year: p.year,
        label,
        value: `${p.year}-${p.month}`
      };
    });
  }, [periods, selectedMonth, selectedYear, language, monthNamesID, monthNamesEN, currentMonthDateObj]);

  // Filter local state based on search query
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const pName = t.products?.name?.toLowerCase() || '';
      const noteStr = t.note?.toLowerCase() || '';
      const operatorStr = t.user_name?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      
      return pName.includes(query) || noteStr.includes(query) || operatorStr.includes(query);
    });
  }, [transactions, searchQuery]);

  // Aggregate stats calculated exclusively for the current month
  const stats = useMemo(() => {
    const totalTransactions = transactions.length;
    const totalUnits = transactions.reduce((acc, t) => acc + (t.quantity || 0), 0);
    const totalValue = transactions.reduce((acc, t) => {
      const cost = t.unit_cost || t.products?.unit_cost || 0;
      return acc + (t.quantity * cost);
    }, 0);
    
    const avgUnits = totalTransactions > 0 ? Math.round((totalUnits / totalTransactions) * 10) / 10 : 0;

    return {
      totalTransactions,
      totalUnits,
      avgUnits,
      totalValue: new Intl.NumberFormat(language === 'id' ? 'id-ID' : 'en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact'
      }).format(totalValue)
    };
  }, [transactions, language]);

  // Determine daily units dispatched trend for selected month/year
  const chartData = useMemo(() => {
    if (!selectedYear || selectedMonth === undefined) return [];
    
    // Get total number of days in selected month
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    
    const dailyMap = Array.from({ length: totalDays }, (_, index) => {
      const dayNum = index + 1;
      return {
        dayLabel: String(dayNum),
        fullDateLabel: language === 'id'
          ? `${dayNum} ${monthNamesID[selectedMonth]} ${selectedYear}`
          : `${monthNamesEN[selectedMonth]} ${dayNum}, ${selectedYear}`,
        quantity: 0
      };
    });

    transactions.forEach(t => {
      if (!t.timestamp) return;
      const d = new Date(t.timestamp);
      if (isNaN(d.getTime())) return;

      const tMonth = d.getMonth();
      const tYear = d.getFullYear();

      if (tMonth === selectedMonth && tYear === selectedYear) {
        const tDay = d.getDate();
        if (tDay >= 1 && tDay <= totalDays) {
          dailyMap[tDay - 1].quantity += t.quantity || 0;
        }
      }
    });

    return dailyMap;
  }, [transactions, selectedMonth, selectedYear, language, monthNamesID, monthNamesEN]);

  // Custom chart tooltip renderer matching dark theme
  const ChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0f0f12] border border-white/10 p-3.5 rounded-2xl shadow-2xl">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
            {data.fullDateLabel}
          </p>
          <p className="text-sm font-mono font-black text-[#6366f1] mt-1.5">
            {payload[0].value.toLocaleString(language === 'id' ? 'id-ID' : 'en-US')} {language === 'id' ? 'Unit Keluar' : 'Units Out'}
          </p>
        </div>
      );
    }
    return null;
  };

  // Excel compliant export function
  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      toast.error(language === 'id' ? 'Tidak ada data untuk diekspor.' : 'No items match filter keys.');
      return;
    }

    // Set headers for transactions ledger
    const headers = [
      'Transaction ID',
      'SKU / Item Name',
      'Category',
      'Quantity Out',
      'Unit Cost (USD)',
      'Total Value (USD)',
      'Date Dispatched',
      'Time Dispatched',
      'Operator',
      'Note / Description'
    ];

    // Build rows
    const rows = filteredTransactions.map(t => {
      const operatorMatch = t.note?.match(/^\[Operator: (.*?)\]/);
      const operator = t.user_name || (operatorMatch ? operatorMatch[1] : 'System');
      const cleanNote = t.note?.replace(/^\[Operator: .*?\]\s?/, '') || '';
      
      const pName = t.products?.name || 'Deleted Product';
      const pCat = t.products?.category || 'General';
      const uCost = t.unit_cost || t.products?.unit_cost || 0;
      const tCost = t.quantity * uCost;
      const txDate = new Date(t.timestamp);

      return [
        `="${t.id.slice(0, 8)}"`, // Excel safe text escaping for prefixes
        `"${pName.replace(/"/g, '""')}"`,
        `"${pCat.replace(/"/g, '""')}"`,
        t.quantity,
        uCost,
        tCost,
        `="${txDate.toLocaleDateString()}"`,
        `="${txDate.toLocaleTimeString()}"`,
        `"${operator.replace(/"/g, '""')}"`,
        `"${cleanNote.replace(/"/g, '""')}"`
      ];
    });

    // Calculate aggregated item outflow totals
    const itemSummaryMap = new Map<string, { category: string; totalQty: number; totalVal: number }>();
    filteredTransactions.forEach(t => {
      const pName = t.products?.name || 'Deleted Product';
      const pCat = t.products?.category || 'General';
      const uCost = t.unit_cost || t.products?.unit_cost || 0;
      const tCost = t.quantity * uCost;

      const existing = itemSummaryMap.get(pName);
      if (existing) {
        existing.totalQty += t.quantity;
        existing.totalVal += tCost;
      } else {
        itemSummaryMap.set(pName, {
          category: pCat,
          totalQty: t.quantity,
          totalVal: tCost
        });
      }
    });

    const summaryHeaders = [
      language === 'id' ? 'Nama Item / Produk' : 'Item / Product Name',
      language === 'id' ? 'Kategori' : 'Category',
      language === 'id' ? 'Total Keluar' : 'Total Quantity Out',
      language === 'id' ? 'Total Nilai (USD)' : 'Total Value (USD)'
    ];

    const summaryRows: string[][] = [];
    itemSummaryMap.forEach((data, name) => {
      summaryRows.push([
        `"${name.replace(/"/g, '""')}"`,
        `"${data.category.replace(/"/g, '""')}"`,
        String(data.totalQty),
        String(data.totalVal.toFixed(2))
      ]);
    });

    // Create a beautifully split CSV layout
    const summaryTitle = language === 'id' 
      ? `RINGKASAN AKUMULASI PENGELUARAN BARANG - Periode: ${currentMonthName}`
      : `ACCUMULATED ITEM OUTFLOW SUMMARY - Period: ${currentMonthName}`;
      
    const ledgerTitle = language === 'id'
      ? `DAFTAR RINCIAN TRANSAKSI DETAIL KELUAR`
      : `ALL DETAIL TRANSACTION OUTFLOW LEDGER`;

    const csvLines = [
      `"${summaryTitle.replace(/"/g, '""')}"`,
      summaryHeaders.join(','),
      ...summaryRows.map(row => row.join(',')),
      '', // empty space separator
      '', // empty space separator
      `"${ledgerTitle.replace(/"/g, '""')}"`,
      headers.join(','),
      ...rows.map(row => row.join(','))
    ];

    // We prepend \uFEFF to specify UTF-8 encoding for proper Excel import
    const csvContent = "\uFEFF" + csvLines.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Pengambilan_Bulanan_${currentMonthName.replace(/ /g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(
      language === 'id' 
        ? 'Ekspor Excel berhasil diunduh!' 
        : 'Excel spreadsheet report successfully downloaded!'
    );
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">
          {language === 'id' ? 'Memuat Profil Admin...' : 'Validating Credentials...'}
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div id="denied-container" className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <div className="p-4 bg-rose-500/15 border border-rose-500/20 text-rose-400 rounded-3xl mb-4">
          <Lock size={32} />
        </div>
        <h3 className="text-lg font-black text-white">
          {language === 'id' ? 'Akses Ditolak' : 'Access Denied'}
        </h3>
        <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
          {language === 'id' 
            ? 'Menu ini eksklusif untuk administrator sistem yang ingin mengakses visual audit dan format ekspor laporan.' 
            : 'This module is restricted to administrators responsible for dispatch logs audit and excel formatting exports.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-amber-500/15 rounded-2xl border border-amber-500/20 text-amber-400">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em]">ADMIN SERVICE</span>
                <span className="text-[10px] text-slate-600">•</span>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em]">{currentMonthName}</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mt-1">
                {language === 'id' ? 'Laporan Log Pengambilan' : 'Dispatch & Outflow Ledger'}
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            {language === 'id' 
              ? `Laporan pencatatan barang keluar khusus selama bulan ${currentMonthName}. Data direset secara otomatis saat memasuki bulan baru.` 
              : `Review all retrieval activities recorded this calendar month (${currentMonthName}). Statistics automatically reset upon entering next cycle.`}
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-2xl transition-all shadow-lg hover:shadow-emerald-500/10 cursor-pointer self-start md:self-auto"
        >
          <Download size={16} />
          {language === 'id' ? 'Ekspor Excel (.CSV)' : 'Export for Excel (.CSV)'}
        </button>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-[#111114]/40 border border-white/5 rounded-2.5xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'id' ? 'Total Kuantitas Keluar' : 'Total Items Withdrawn'}</p>
          <p className="text-xl font-mono font-black text-white mt-2">{stats.totalUnits} <span className="text-[11px] text-slate-400 font-bold">{language === 'id' ? 'Unit' : 'Pcs'}</span></p>
          <div className="flex items-center gap-1.5 mt-2 text-[9px] text-slate-500">
            <span className="font-bold text-slate-400">{currentMonthName}</span>
          </div>
        </div>

        <div className="bg-[#111114]/40 border border-white/5 rounded-2.5xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'id' ? 'Jumlah Transaksi' : 'Dispatch Transactions'}</p>
          <p className="text-xl font-mono font-black text-amber-400 mt-2">{stats.totalTransactions} <span className="text-[11px] text-slate-500 font-bold">{language === 'id' ? 'Kali Log' : 'Logs'}</span></p>
          <div className="flex items-center gap-1.5 mt-2 text-[9px] text-amber-400/80">
            <span className="font-bold">Live Month Trail</span>
          </div>
        </div>

        <div className="bg-[#111114]/40 border border-white/5 rounded-2.5xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'id' ? 'Rata-rata/Transaksi' : 'Avg. Dispatch size'}</p>
          <p className="text-xl font-mono font-black text-indigo-400 mt-2">{stats.avgUnits} <span className="text-[11px] text-slate-500 font-bold">{language === 'id' ? 'Unit' : 'Pcs'}</span></p>
          <div className="flex items-center gap-1.5 mt-2 text-[9px] text-indigo-400/80">
            <span className="font-bold">Calculated Rate</span>
          </div>
        </div>

        <div className="bg-[#111114]/40 border border-white/5 rounded-2.5xl p-5 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'id' ? 'Estimasi Nilai Aset' : 'Asset Combined Value'}</p>
          <p className="text-xl font-mono font-black text-emerald-400 mt-2">{stats.totalValue}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[9px] text-emerald-400/80">
            <span className="font-bold">Valuation Equivalent</span>
          </div>
        </div>
      </div>

      {/* Daily Outflow Trend Chart */}
      <div className="bg-[#111114]/40 border border-white/5 rounded-3xl p-6 shadow-sm overflow-hidden space-y-5">
        <div>
          <h2 className="text-xs font-bold text-white uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-3 bg-indigo-500 rounded-sm"></span>
            {language === 'id' ? 'Tren Aktivitas Pengambilan Harian' : 'Daily Dispatch Activity Trend'}
          </h2>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
            {language === 'id' 
              ? `Representasi visual frekuensi penarikan total unit produk per hari dalam siklus bulan ${currentMonthName}.`
              : `Visual representation of aggregate product units dispatched per calendar day during ${currentMonthName}.`}
          </p>
        </div>

        <div className="h-60 sm:h-72 w-full mt-2">
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="dayLabel" 
                  stroke="#475569" 
                  fontSize={10} 
                  fontFamily="monospace"
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={10} 
                  fontFamily="monospace"
                  tickLine={false}
                  axisLine={false}
                  dx={-4}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
                <Bar 
                  dataKey="quantity" 
                  fill="#6366f1" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={30}
                >
                  {chartData.map((entry: any, index: number) => {
                    const hasActivity = entry.quantity > 0;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={hasActivity ? '#6366f1' : '#1e1b4b'} 
                        fillOpacity={hasActivity ? 0.9 : 0.2} 
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-slate-950/20 border border-white/5 rounded-2xl animate-pulse">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {language === 'id' ? 'MEMBUAT GRAFIK TREN...' : 'LOADING TREND VISUAL...'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Database Reset Alert Banner */}
      <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-3xl p-5 flex items-start gap-4">
        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 flex-shrink-0">
          <CalendarDays size={18} />
        </div>
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            {language === 'id' ? 'Fungsi Reset Aturan Bulan Baru Otomatis' : 'Auto Month Transition Reset Rule'}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {language === 'id' 
              ? `Halaman audit log ini menerapkan logika filter batasan waktu mulai dari tanggal 1 ${currentMonthNameName() || 'Bulan Ini'}. Saat memasuki bulan kalender berikutnya, data historis lama disembunyikan secara otomatis dari log aktif ini, memberi Anda visual bersih mulai dari 0.` 
              : `To guarantee accuracy, all statistics and listings below represent current calendar month data starting from the 1st of this month. Older data remains securely stored in the master audit trail and is skipped here.`}
          </p>
        </div>
      </div>

      {/* Main Filter Control Panel */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        {/* Period Selector Dropdown */}
        <div className="flex items-center gap-2 bg-[#111114] border border-white/5 rounded-2xl px-3.5 py-1 min-w-[200px]">
          <Calendar className="text-indigo-400 flex-shrink-0" size={16} />
          <select
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number);
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
            className="flex-1 bg-transparent border-none text-xs font-semibold text-white focus:outline-none py-2 px-1 rounded-xl cursor-pointer"
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-950 text-slate-200">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder={language === 'id' ? 'Cari berdasarkan nama barang, operator, atau catatan...' : 'Search item name, operator, or description notes...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[#111114] border border-white/5 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>

        <button
          onClick={() => {
            fetchAvailablePeriods();
            fetchCurrentMonthTransactions();
          }}
          className="px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          {language === 'id' ? 'Segarkan Data' : 'Reload'}
        </button>
      </div>

      {/* Main Report Table Container */}
      <div className="bg-[#111114]/40 border border-white/5 rounded-3xl overflow-hidden shadow-sm">
        
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'id' ? 'MEMBUAT LAPORAN...' : 'GENERATING LEDGER REPORT...'}</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <div className="p-3 bg-slate-900/50 rounded-2xl text-slate-700 mb-3 border border-white/5">
              <FileText size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-400">
              {language === 'id' ? 'Belum Ada Aktivitas Terdeteksi' : 'No Transactions Detected'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm px-4">
              {language === 'id' 
                ? `Belum ada log barang keluar yang tercatat sepanjang bulan ${currentMonthName}.` 
                : `Audit trail returned zero dispatch transaction logs for the calendar month of ${currentMonthName}.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/25">
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">Hash ID</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">{language === 'id' ? 'Nama Barang' : 'Product Name'}</th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">{language === 'id' ? 'Volume Keluar' : 'Withdrawal Volume'}</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">{language === 'id' ? 'Tanggal & Jam' : 'Timestamp'}</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">{language === 'id' ? 'Operator' : 'Staff Operator'}</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">{language === 'id' ? 'Catatan / Alasan' : 'Incident Notes'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTransactions.map((tx) => {
                  const operatorMatch = tx.note?.match(/^\[Operator: (.*?)\]/);
                  const operator = tx.user_name || (operatorMatch ? operatorMatch[1] : 'System');
                  const cleanNote = tx.note?.replace(/^\[Operator: .*?\]\s?/, '') || '';
                  
                  return (
                    <tr 
                      key={tx.id} 
                      className="hover:bg-white/[0.01] transition-colors"
                    >
                      
                      {/* Shortened ID HASH */}
                      <td className="py-4 px-6">
                        <span className="text-[10px] font-mono font-bold text-indigo-400 select-all">
                          #{tx.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>

                      {/* Product details */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-white">
                            {tx.products?.name || 'Deleted Product'}
                          </span>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                            {tx.products?.category || 'General'}
                          </span>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-4 px-4 text-center">
                        <span className="text-xs font-mono font-black text-amber-400 bg-amber-500/5 border border-amber-500/10 px-2 py-1 rounded-lg">
                          -{tx.quantity} Pcs
                        </span>
                      </td>

                      {/* Time */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-0.5 font-mono text-[10px] text-slate-400">
                          <div className="flex items-center gap-1">
                            <Calendar size={10} className="text-slate-600" />
                            <span>
                              {new Date(tx.timestamp).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock size={10} />
                            <span>
                              {new Date(tx.timestamp).toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Operator */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                          <User size={12} className="text-slate-500" />
                          <span>{operator}</span>
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="py-4 px-6">
                        <span className="text-[11px] text-slate-400 line-clamp-2 max-w-xs block">
                          {cleanNote || '-'}
                        </span>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );

  // Small helper to dynamically pull month name safely during calculation text blocks
  function currentMonthNameName() {
    return language === 'id' ? monthNamesID[selectedMonth] : monthNamesEN[selectedMonth];
  }
}
