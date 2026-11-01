'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Calendar, 
  Package, 
  Download, 
  TrendingDown, 
  TrendingUp,
  ShieldAlert,
  ShieldCheck, 
  RefreshCw, 
  Printer, 
  Coins, 
  User, 
  CalendarDays,
  AlertTriangle,
  Clock,
  ArrowRight,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Info,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BarChart2,
  Check,
  FileText,
  ArrowDownRight,
  ArrowUpRight,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { Product, Transaction } from '@/types/inventory';
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
  Cell,
  Legend
} from 'recharts';

export interface MonthlyItemReconciliation {
  id: string;
  name: string;
  category: string;
  unit_cost: number;
  start_stock: number;
  in_quantity: number;
  out_quantity: number;
  net_movement: number;
  end_stock: number;
  current_stock: number;
  start_valuation: number;
  end_valuation: number;
  status: 'balanced' | 'discrepancy' | 'warning';
  discrepancy_amount: number;
  transaction_count: number;
  has_anomaly: boolean;
}

export interface StockAnomaly {
  id: string;
  type: 'spike' | 'after_hours' | 'rapid' | 'no_note' | 'negative_risk' | 'unscheduled_surge';
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
  product_id: string;
  product_name: string;
  category: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
  operator_name: string;
  note?: string;
  description: string;
  recommendation: string;
  transaction_type: 'in' | 'out';
  is_reviewed?: boolean;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
}

export default function MonthlyAuditPage() {
  const { user, isAdmin, isEngineering, userRole } = useAuth();
  const { language, t } = useLanguage();

  const currentDate = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth()); // 0-based
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<(Transaction & { products?: Product })[]>([]);
  const [allTransactions, setAllTransactions] = useState<(Transaction & { products?: Product })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'anomalies' | 'analytics'>('reconciliation');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'balanced' | 'discrepancy' | 'anomalies'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Anomaly Filters & Search
  const [anomalyDirectionFilter, setAnomalyDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [anomalySeverityFilter, setAnomalySeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [anomalySearchQuery, setAnomalySearchQuery] = useState('');

  // Modal states
  const [selectedItemForLedger, setSelectedItemForLedger] = useState<MonthlyItemReconciliation | null>(null);
  const [selectedAnomalyForReview, setSelectedAnomalyForReview] = useState<StockAnomaly | null>(null);
  const [investigationNote, setInvestigationNote] = useState('');
  const [reviewedAnomalyIds, setReviewedAnomalyIds] = useState<Record<string, { note: string; by: string; at: string }>>({});

  const monthNamesID = useMemo(() => [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ], []);

  const monthNamesEN = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ], []);

  const periodLabel = useMemo(() => {
    return language === 'id' 
      ? `${monthNamesID[selectedMonth]} ${selectedYear}`
      : `${monthNamesEN[selectedMonth]} ${selectedYear}`;
  }, [selectedMonth, selectedYear, language, monthNamesID, monthNamesEN]);

  // Load reviewed anomalies from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`stockflow_audit_reviews_${selectedYear}_${selectedMonth}`);
      if (stored) {
        setReviewedAnomalyIds(JSON.parse(stored));
      } else {
        setReviewedAnomalyIds({});
      }
      const syncMeta = localStorage.getItem(`stockflow_last_sync_${selectedYear}_${selectedMonth}`);
      if (syncMeta) {
        setLastSyncTime(syncMeta);
      } else {
        setLastSyncTime(null);
      }
    } catch (e) {
      console.warn('Failed to load audit reviews from storage:', e);
    }
  }, [selectedYear, selectedMonth]);

  // Fetch data
  const fetchData = useCallback(async (isManualSync = false) => {
    if (isManualSync) {
      setIsSyncing(true);
    } else {
      setIsLoading(true);
    }

    try {
      // 1. Fetch Products
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (prodErr) throw prodErr;
      const fetchedProducts: Product[] = prodData || [];
      setProducts(fetchedProducts);

      // 2. Fetch all transactions (with product link)
      const { data: transData, error: transErr } = await supabase
        .from('transactions')
        .select('*, products(*)')
        .order('timestamp', { ascending: true });

      if (transErr) throw transErr;
      const fetchedTrans: (Transaction & { products?: Product })[] = transData || [];
      setAllTransactions(fetchedTrans);

      // Record sync timestamp
      const nowStr = new Date().toLocaleString(language === 'id' ? 'id-ID' : 'en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSyncTime(nowStr);
      try {
        localStorage.setItem(`stockflow_last_sync_${selectedYear}_${selectedMonth}`, nowStr);
      } catch (err) {
        // ignore
      }

      if (isManualSync) {
        toast.success(t.monthlyAudit?.syncSuccess || 'Sinkronisasi berhasil! Seluruh data transaksi dan stok telah direkonsiliasi.');
      }
    } catch (error: any) {
      console.error('Error fetching monthly audit data:', error);
      toast.error('Gagal mengambil data dari server: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [selectedMonth, selectedYear, language, t]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Date boundaries for the selected month
  const { monthStart, monthEnd } = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
    const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    return { monthStart: start, monthEnd: end };
  }, [selectedMonth, selectedYear]);

  // Transactions strictly inside the selected month
  const monthTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      if (!t.timestamp) return false;
      const tTime = new Date(t.timestamp).getTime();
      return tTime >= monthStart.getTime() && tTime <= monthEnd.getTime();
    });
  }, [allTransactions, monthStart, monthEnd]);

  // -------------------------------------------------------------
  // RECONCILIATION ENGINE
  // -------------------------------------------------------------
  const reconciliationData = useMemo<MonthlyItemReconciliation[]>(() => {
    return products.map(product => {
      const prodTrans = allTransactions.filter(t => t.product_id === product.id);

      // Mutasi di dalam bulan terpilih
      let inQtyMonth = 0;
      let outQtyMonth = 0;
      let monthTransCount = 0;

      // Mutasi setelah bulan terpilih (untuk back-calculate stok akhir jika bulan lampau)
      let netAfterMonth = 0;

      prodTrans.forEach(t => {
        if (!t.timestamp) return;
        const tTime = new Date(t.timestamp).getTime();
        const qty = Number(t.quantity) || 0;

        if (tTime >= monthStart.getTime() && tTime <= monthEnd.getTime()) {
          monthTransCount++;
          if (t.type === 'in') inQtyMonth += qty;
          else if (t.type === 'out') outQtyMonth += qty;
        } else if (tTime > monthEnd.getTime()) {
          if (t.type === 'in') netAfterMonth += qty;
          else if (t.type === 'out') netAfterMonth -= qty;
        }
      });

      const netMovement = inQtyMonth - outQtyMonth;

      // Calculate end stock at the close of this specific month
      // end_stock = current_stock - netMovementAfter
      const currentStock = Number(product.stock_quantity) || 0;
      let calculatedEndStock = currentStock - netAfterMonth;

      // Calculate start stock at the beginning of this specific month
      // start_stock = calculatedEndStock - netMovement
      let calculatedStartStock = calculatedEndStock - netMovement;

      // Defensively sanitize negative numbers if there was an initial stock unlogged
      if (calculatedStartStock < 0) {
        calculatedStartStock = 0;
      }
      if (calculatedEndStock < 0) {
        calculatedEndStock = 0;
      }

      // Check balance status
      // Standard equation: start + in - out === end
      const expectedEnd = calculatedStartStock + inQtyMonth - outQtyMonth;
      const discrepancy = Math.abs(calculatedEndStock - expectedEnd);

      let status: 'balanced' | 'discrepancy' | 'warning' = 'balanced';
      if (discrepancy > 0) {
        status = 'discrepancy';
      } else if (calculatedEndStock <= (product.min_stock || 5)) {
        status = 'warning';
      }

      const unitCost = Number(product.unit_cost) || 0;

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        unit_cost: unitCost,
        start_stock: calculatedStartStock,
        in_quantity: inQtyMonth,
        out_quantity: outQtyMonth,
        net_movement: netMovement,
        end_stock: calculatedEndStock,
        current_stock: currentStock,
        start_valuation: calculatedStartStock * unitCost,
        end_valuation: calculatedEndStock * unitCost,
        status,
        discrepancy_amount: discrepancy,
        transaction_count: monthTransCount,
        has_anomaly: false // will be populated below
      };
    });
  }, [products, allTransactions, monthStart, monthEnd]);

  // -------------------------------------------------------------
  // ANOMALY DETECTION ENGINE
  // -------------------------------------------------------------
  const anomalies = useMemo<StockAnomaly[]>(() => {
    const list: StockAnomaly[] = [];

    // Map historical product average outgoing and incoming
    const productAvgOutMap = new Map<string, number>();
    const productOutCountMap = new Map<string, number>();
    const productAvgInMap = new Map<string, number>();
    const productInCountMap = new Map<string, number>();

    allTransactions.forEach(t => {
      if (t.type === 'out') {
        const cur = productAvgOutMap.get(t.product_id) || 0;
        const count = productOutCountMap.get(t.product_id) || 0;
        productAvgOutMap.set(t.product_id, cur + Number(t.quantity));
        productOutCountMap.set(t.product_id, count + 1);
      } else if (t.type === 'in') {
        const cur = productAvgInMap.get(t.product_id) || 0;
        const count = productInCountMap.get(t.product_id) || 0;
        productAvgInMap.set(t.product_id, cur + Number(t.quantity));
        productInCountMap.set(t.product_id, count + 1);
      }
    });

    // 1. Inspect every transaction in the month
    monthTransactions.forEach(t => {
      const prod = products.find(p => p.id === t.product_id) || t.products;
      const prodName = prod?.name || 'Item Tidak Diketahui';
      const prodCat = prod?.category || 'Umum';
      const qty = Number(t.quantity) || 0;
      const unitCost = Number(t.unit_cost || prod?.unit_cost) || 0;
      const totalVal = qty * unitCost;
      const operatorName = t.user_name || 'Petugas Tidak Terdaftar';
      const note = t.note?.trim() || '';
      const dateObj = new Date(t.timestamp);
      const hours = dateObj.getHours();
      const timeFormatted = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      // Rule A: Transaksi di Luar Jam Operasional Standar (22:00 malam - 05:30 pagi)
      if (hours >= 20 || hours < 6) {
        if (t.type === 'in') {
          list.push({
            id: `anomaly-afterhours-in-${t.id}`,
            type: 'after_hours',
            severity: 'warning',
            timestamp: t.timestamp,
            product_id: t.product_id,
            product_name: prodName,
            category: prodCat,
            quantity: qty,
            unit_cost: unitCost,
            total_value: totalVal,
            operator_name: operatorName,
            note,
            transaction_type: 'in',
            description: `[BARANG MASUK] Penerimaan / Restock stok tercatat pada pukul ${timeFormatted} WITA di luar jadwal operasional normal gudang.`,
            recommendation: 'Verifikasi ke staff yang menginput data ke sistem, jika perlu cctv atau nota pembelian, dan pastikan fisik barang telah dicek oleh staf shift berikutnya.',
          });
        } else {
          list.push({
            id: `anomaly-afterhours-out-${t.id}`,
            type: 'after_hours',
            severity: 'warning',
            timestamp: t.timestamp,
            product_id: t.product_id,
            product_name: prodName,
            category: prodCat,
            quantity: qty,
            unit_cost: unitCost,
            total_value: totalVal,
            operator_name: operatorName,
            note,
            transaction_type: 'out',
            description: `[BARANG KELUAR] Pengeluaran / Konsumsi stok tercatat pada pukul ${timeFormatted} WITA di luar jam operasional normal gudang.`,
            recommendation: 'Verifikasi ke staff yang meninput data ke sistem, konfirmasi kebutuhan pemakaian, dan cocokkan dengan rekaman CCTV jika diperlukan.',
          });
        }
      }

      // Rule B1: Lonjakan Pengeluaran Ekstrem (Outlier Outflow Spike)
      if (t.type === 'out') {
        const totalHistoricalOut = productAvgOutMap.get(t.product_id) || 0;
        const historicalCount = productOutCountMap.get(t.product_id) || 1;
        const avgOut = totalHistoricalOut / historicalCount;

        // Jika qty 2.8x lebih besar dari rata-rata dan qty >= 15 pcs
        if (avgOut > 0 && qty >= avgOut * 2.8 && qty >= 15) {
          list.push({
            id: `anomaly-spike-out-${t.id}`,
            type: 'spike',
            severity: 'critical',
            timestamp: t.timestamp,
            product_id: t.product_id,
            product_name: prodName,
            category: prodCat,
            quantity: qty,
            unit_cost: unitCost,
            total_value: totalVal,
            operator_name: operatorName,
            note,
            transaction_type: 'out',
            description: `[BARANG KELUAR] Pengeluaran ${qty} unit dalam 1 transaksi melonjak ${Math.round((qty / avgOut) * 100)}% dari rata-rata konsumsi normal (${Math.round(avgOut)} Pcs/transaksi).`,
            recommendation: 'Verifikasi kepada staff yang tercatat, dan verifikasi tujuan pemakaian ke staff.',
          });
        }
      }

      // Rule B2: Lonjakan Penerimaan / Restock Ekstrem (Inbound Inflow Surge)
      if (t.type === 'in') {
        const totalHistoricalIn = productAvgInMap.get(t.product_id) || 0;
        const historicalInCount = productInCountMap.get(t.product_id) || 1;
        const avgIn = totalHistoricalIn / historicalInCount;

        if ((avgIn > 0 && qty >= avgIn * 3.5 && qty >= 40) || qty >= 200) {
          list.push({
            id: `anomaly-spike-in-${t.id}`,
            type: 'spike',
            severity: 'warning',
            timestamp: t.timestamp,
            product_id: t.product_id,
            product_name: prodName,
            category: prodCat,
            quantity: qty,
            unit_cost: unitCost,
            total_value: totalVal,
            operator_name: operatorName,
            note,
            transaction_type: 'in',
            description: `[BARANG MASUK] Penerimaan restock dalam jumlah sangat besar (+${qty} unit senilai Rp ${totalVal.toLocaleString('id-ID')}) melebihi kuota batch normal.`,
            recommendation: 'Periksa kesesuaian fisik dengan nota pembelian barang masuk.',
          });
        }
      }

      // Rule C: Transaksi Nilai Besar Tanpa Keterangan Jelas (Missing Note / Purpose)
      const isMissingMeaningfulNote = !note || note === '-' || note.toLowerCase() === 'test' || note.toLowerCase() === 'keluar' || note.toLowerCase() === 'masuk';
      if ((totalVal >= 1000000 || qty >= 25) && isMissingMeaningfulNote) {
        if (t.type === 'out') {
          list.push({
            id: `anomaly-nonote-out-${t.id}`,
            type: 'no_note',
            severity: 'warning',
            timestamp: t.timestamp,
            product_id: t.product_id,
            product_name: prodName,
            category: prodCat,
            quantity: qty,
            unit_cost: unitCost,
            total_value: totalVal,
            operator_name: operatorName,
            note,
            transaction_type: 'out',
            description: `[BARANG KELUAR] Pengeluaran signifikan senilai Rp ${totalVal.toLocaleString('id-ID')} (-${qty} unit) dicatat tanpa catatan keperluan .`,
            recommendation: 'Verifikasi dengan staff yang tercatat di sistem.',
          });
        } else {
          list.push({
            id: `anomaly-nonote-in-${t.id}`,
            type: 'no_note',
            severity: 'warning',
            timestamp: t.timestamp,
            product_id: t.product_id,
            product_name: prodName,
            category: prodCat,
            quantity: qty,
            unit_cost: unitCost,
            total_value: totalVal,
            operator_name: operatorName,
            note,
            transaction_type: 'in',
            description: `[BARANG MASUK] Penerimaan stok bernilai Rp ${totalVal.toLocaleString('id-ID')} (+${qty} unit) dicatat dan perlu di verifikasi ulang.`,
            recommendation: 'Verifikasi kembali kepada staff dan double check note pembelian.',
          });
        }
      }
    });

    // Rule D: Pengeluaran Berulang Singkat (< 25 Menit) pada Produk yang Sama
    const sortedOutTrans = [...monthTransactions]
      .filter(t => t.type === 'out')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (let i = 0; i < sortedOutTrans.length - 1; i++) {
      const cur = sortedOutTrans[i];
      const next = sortedOutTrans[i + 1];

      if (cur.product_id === next.product_id) {
        const diffMs = Math.abs(new Date(next.timestamp).getTime() - new Date(cur.timestamp).getTime());
        const diffMins = Math.round(diffMs / (1000 * 60));

        if (diffMins <= 25) {
          const prod = products.find(p => p.id === cur.product_id);
          const prodName = prod?.name || 'Item';
          const totalRapidQty = (Number(cur.quantity) || 0) + (Number(next.quantity) || 0);
          list.push({
            id: `anomaly-rapid-${cur.id}-${next.id}`,
            type: 'rapid',
            severity: 'info',
            timestamp: next.timestamp,
            product_id: cur.product_id,
            product_name: prodName,
            category: prod?.category || 'Umum',
            quantity: Number(next.quantity) || 0,
            unit_cost: Number(prod?.unit_cost) || 0,
            total_value: (Number(next.quantity) || 0) * (Number(prod?.unit_cost) || 0),
            operator_name: next.user_name || cur.user_name || 'Operator',
            note: next.note || '',
            transaction_type: 'out',
            description: `[BARANG KELUAR] Pengeluaran beruntun dalam rentang ${diffMins} menit untuk produk yang sama (${cur.quantity} Pcs disusul ${next.quantity} Pcs). Total keluar cepat: ${totalRapidQty} Pcs.`,
            recommendation: 'Cek kemungkinan terjadinya duplikasi input oleh staff atau konfirmasi apakah ada pengambilan bertahap yang perlu digabung.',
          });
        }
      }
    }

    // Attach review status from storage
    return list.map(item => {
      const review = reviewedAnomalyIds[item.id];
      if (review) {
        return {
          ...item,
          is_reviewed: true,
          reviewed_at: review.at,
          reviewed_by: review.by,
          review_notes: review.note,
        };
      }
      return item;
    });
  }, [monthTransactions, allTransactions, products, reviewedAnomalyIds]);

  // Update reconciliation items with anomaly flag
  const reconciledItemsWithAnomalies = useMemo(() => {
    const anomalyProductIds = new Set(anomalies.map(a => a.product_id));
    return reconciliationData.map(item => ({
      ...item,
      has_anomaly: anomalyProductIds.has(item.id),
    }));
  }, [reconciliationData, anomalies]);

  // -------------------------------------------------------------
  // KPI TOTALS
  // -------------------------------------------------------------
  const totals = useMemo(() => {
    let startStock = 0;
    let inQty = 0;
    let outQty = 0;
    let endStock = 0;
    let startVal = 0;
    let endVal = 0;
    let discrepancies = 0;

    reconciliationData.forEach(item => {
      startStock += item.start_stock;
      inQty += item.in_quantity;
      outQty += item.out_quantity;
      endStock += item.end_stock;
      startVal += item.start_valuation;
      endVal += item.end_valuation;
      if (item.status === 'discrepancy') discrepancies++;
    });

    const netStockChange = inQty - outQty;
    const netValuationChange = endVal - startVal;

    // Integrity Score (0 - 100)
    // Decrement for discrepancies and critical anomalies
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical' && !a.is_reviewed).length;
    const warningAnomalies = anomalies.filter(a => a.severity === 'warning' && !a.is_reviewed).length;
    
    let score = 100;
    score -= discrepancies * 10;
    score -= criticalAnomalies * 8;
    score -= warningAnomalies * 3;
    if (score < 30) score = 30;

    return {
      startStock,
      inQty,
      outQty,
      endStock,
      startVal,
      endVal,
      netStockChange,
      netValuationChange,
      discrepancies,
      integrityScore: score,
      criticalAnomalies,
      warningAnomalies,
      totalAnomalies: anomalies.length,
      unreviewedAnomalies: anomalies.filter(a => !a.is_reviewed).length,
    };
  }, [reconciliationData, anomalies]);

  // Filtered reconciliation list
  const filteredItems = useMemo(() => {
    return reconciledItemsWithAnomalies.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

      let matchesStatus = true;
      if (statusFilter === 'balanced') matchesStatus = item.status === 'balanced';
      else if (statusFilter === 'discrepancy') matchesStatus = item.status === 'discrepancy';
      else if (statusFilter === 'anomalies') matchesStatus = item.has_anomaly;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [reconciledItemsWithAnomalies, searchQuery, categoryFilter, statusFilter]);

  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(products.map(p => p.category)))];
  }, [products]);

  // Filtered anomalies with Direction (all/in/out), Severity, and Search
  const filteredAnomalies = useMemo(() => {
    return anomalies.filter(a => {
      if (anomalyDirectionFilter !== 'all' && a.transaction_type !== anomalyDirectionFilter) {
        return false;
      }
      if (anomalySeverityFilter !== 'all' && a.severity !== anomalySeverityFilter) {
        return false;
      }
      if (anomalySearchQuery.trim()) {
        const q = anomalySearchQuery.toLowerCase();
        const matchName = a.product_name.toLowerCase().includes(q);
        const matchCat = a.category.toLowerCase().includes(q);
        const matchDesc = a.description.toLowerCase().includes(q);
        const matchRec = a.recommendation.toLowerCase().includes(q);
        const matchOp = a.operator_name.toLowerCase().includes(q);
        const matchNote = (a.note || '').toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchDesc && !matchRec && !matchOp && !matchNote) {
          return false;
        }
      }
      return true;
    });
  }, [anomalies, anomalyDirectionFilter, anomalySeverityFilter, anomalySearchQuery]);

  // Comprehensive anomaly statistics
  const anomalyStats = useMemo(() => {
    const total = anomalies.length;
    const inCount = anomalies.filter(a => a.transaction_type === 'in').length;
    const outCount = anomalies.filter(a => a.transaction_type === 'out').length;
    const reviewedCount = anomalies.filter(a => a.is_reviewed).length;
    const unreviewedCount = total - reviewedCount;
    const totalImpactValue = anomalies.reduce((acc, a) => acc + (a.total_value || 0), 0);
    const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
    const warningCount = anomalies.filter(a => a.severity === 'warning').length;
    return {
      total,
      inCount,
      outCount,
      reviewedCount,
      unreviewedCount,
      totalImpactValue,
      criticalCount,
      warningCount,
    };
  }, [anomalies]);

  // -------------------------------------------------------------
  // EXPORT TO EXCEL / CSV
  // -------------------------------------------------------------
  const handleExportCSV = () => {
    try {
      const separator = ',';
      const lines: string[] = [];

      // UTF-8 BOM for Microsoft Excel compatibility
      const BOM = '\uFEFF';

      // Header Metadata
      lines.push(`"STOCKFLOW WMS - LAPORAN STOK & AUDIT BULANAN"`);
      lines.push(`"Periode Audit"${separator}"${periodLabel}"`);
      lines.push(`"Tanggal Unduh"${separator}"${new Date().toLocaleString('id-ID')}"`);
      lines.push(`"Diunduh Oleh"${separator}"${user?.email || 'Admin'}"`);
      lines.push(`"Skor Integritas Audit"${separator}"${totals.integrityScore}/100"`);
      lines.push('');

      // Ringkasan Eksekutif
      lines.push(`"RINGKASAN UTAMA"`);
      lines.push(`"Total SKU Diaudit"${separator}${products.length}`);
      lines.push(`"Total Stok Awal Bulan"${separator}${totals.startStock}`);
      lines.push(`"Total Barang Masuk (+)"${separator}${totals.inQty}`);
      lines.push(`"Total Barang Keluar (-)"${separator}${totals.outQty}`);
      lines.push(`"Total Stok Akhir Bulan"${separator}${totals.endStock}`);
      lines.push(`"Valuasi Aset Awal"${separator}"Rp ${totals.startVal.toLocaleString('id-ID')}"`);
      lines.push(`"Valuasi Aset Akhir"${separator}"Rp ${totals.endVal.toLocaleString('id-ID')}"`);
      lines.push(`"Temuan Anomali Operasional"${separator}${totals.totalAnomalies}`);
      lines.push('');

      // Tabel Detail Rekonsiliasi
      lines.push(`"TABEL PERBANDINGAN PER BARANG"`);
      lines.push([
        `"No"`,
        `"ID Barang"`,
        `"Nama Barang"`,
        `"Kategori"`,
        `"Biaya Satuan (Rp)"`,
        `"Stok Awal"`,
        `"Masuk (+)"`,
        `"Keluar (-)"`,
        `"Net Mutasi"`,
        `"Stok Akhir"`,
        `"Stok Fisik Terkini"`,
        `"Valuasi Akhir (Rp)"`,
        `"Status"`,
        `"Indikasi Anomali"`
      ].join(separator));

      reconciledItemsWithAnomalies.forEach((item, idx) => {
        lines.push([
          idx + 1,
          `"${item.id}"`,
          `"${item.name.replace(/"/g, '""')}"`,
          `"${item.category.replace(/"/g, '""')}"`,
          item.unit_cost,
          item.start_stock,
          item.in_quantity,
          item.out_quantity,
          item.net_movement,
          item.end_stock,
          item.current_stock,
          item.end_valuation,
          `"${item.status === 'balanced' ? 'Seimbang' : item.status === 'discrepancy' ? 'Selisih' : 'Perhatian'}"`,
          `"${item.has_anomaly ? 'YA' : 'TIDAK'}"`
        ].join(separator));
      });

      // Tabel Anomali jika ada
      lines.push('');
      lines.push(`"LOG AKTIVITAS TIDAK NORMAL / ANOMALI BULAN INI"`);
      lines.push([
        `"Waktu Kejadian"`,
        `"Arah Mutasi"`,
        `"Tingkat Bahaya"`,
        `"Kategori Anomali"`,
        `"Nama Barang"`,
        `"Kategori Produk"`,
        `"Jumlah Mutasi"`,
        `"Total Nilai (Rp)"`,
        `"Petugas Input"`,
        `"Catatan Asli Petugas"`,
        `"Keterangan / Alasan Terdeteksi"`,
        `"Rekomendasi Tindakan Auditor"`,
        `"Status Review & Catatan Klarifikasi"`
      ].join(separator));

      if (anomalies.length === 0) {
        lines.push(`"Tidak ada anomali atau aktivitas mencurigakan yang terdeteksi pada periode ini."`);
      } else {
        anomalies.forEach(a => {
          lines.push([
            `"${new Date(a.timestamp).toLocaleString('id-ID')}"`,
            `"${a.transaction_type === 'in' ? 'BARANG MASUK (+)' : 'BARANG KELUAR (-)'}"`,
            `"${a.severity.toUpperCase()}"`,
            `"${a.type === 'spike' ? 'Lonjakan Ekstrem' : a.type === 'after_hours' ? 'Luar Jam Kerja' : a.type === 'rapid' ? 'Pengeluaran Beruntun' : 'Tanpa Catatan'}"`,
            `"${a.product_name.replace(/"/g, '""')}"`,
            `"${a.category.replace(/"/g, '""')}"`,
            `"${a.transaction_type === 'in' ? '+' : '-'}${a.quantity} Pcs"`,
            a.total_value,
            `"${a.operator_name.replace(/"/g, '""')}"`,
            `"${(a.note || '(Tidak ada catatan)').replace(/"/g, '""')}"`,
            `"${a.description.replace(/"/g, '""')}"`,
            `"${a.recommendation.replace(/"/g, '""')}"`,
            `"${a.is_reviewed ? `Sudah Ditinjau oleh ${a.reviewed_by} - Catatan: ${a.review_notes || '-'}` : 'Belum Ditinjau'}"`
          ].join(separator));
        });
      }

      const csvContent = BOM + lines.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Laporan_Rekonsiliasi_Stok_${selectedYear}_${String(selectedMonth + 1).padStart(2, '0')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('File CSV Laporan Rekonsiliasi berhasil diunduh!');
    } catch (err: any) {
      console.error('Error exporting CSV:', err);
      toast.error('Gagal mengunduh CSV: ' + err.message);
    }
  };

  // -------------------------------------------------------------
  // PRINT / SAVE TO PDF
  // -------------------------------------------------------------
  const handlePrint = () => {
    window.print();
  };

  // -------------------------------------------------------------
  // HANDLE REVIEW ANOMALY
  // -------------------------------------------------------------
  const handleSaveReview = () => {
    if (!selectedAnomalyForReview) return;
    const nowStr = new Date().toLocaleString(language === 'id' ? 'id-ID' : 'en-US');
    const reviewerName = user?.email || 'Auditor';

    const updated = {
      ...reviewedAnomalyIds,
      [selectedAnomalyForReview.id]: {
        note: investigationNote || 'Diverifikasi sesuai prosedur operasional.',
        by: reviewerName,
        at: nowStr,
      }
    };

    setReviewedAnomalyIds(updated);
    try {
      localStorage.setItem(`stockflow_audit_reviews_${selectedYear}_${selectedMonth}`, JSON.stringify(updated));
    } catch (e) {
      // ignore
    }

    toast.success('Status anomali berhasil ditandai sebagai telah ditinjau.');
    setSelectedAnomalyForReview(null);
    setInvestigationNote('');
  };

  // Quick navigation months
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handleSetCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
  };

  // Chart data: Top 6 products with highest flow
  const chartData = useMemo(() => {
    return [...reconciliationData]
      .sort((a, b) => (b.in_quantity + b.out_quantity) - (a.in_quantity + a.out_quantity))
      .slice(0, 6)
      .map(item => ({
        name: item.name.length > 14 ? item.name.slice(0, 12) + '...' : item.name,
        'Stok Awal': item.start_stock,
        'Masuk': item.in_quantity,
        'Keluar': item.out_quantity,
        'Stok Akhir': item.end_stock,
      }));
  }, [reconciliationData]);

  return (
    <div className="space-y-8 pb-16">
      {/* ------------------------------------------------------------- */}
      {/* SCREEN VIEW (Non-print) */}
      {/* ------------------------------------------------------------- */}
      <div className="no-print space-y-8">
        {/* Top Header & Page Title */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-[#0F0F12] border border-white/5 p-6 rounded-3xl shadow-xl backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl text-indigo-400">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    {t.monthlyAudit?.title || 'Rekonsiliasi & Audit Bulanan'}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Engine V2.4
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {t.monthlyAudit?.subtitle || 'Audit otomatis saldo stok awal hingga akhir bulan, pelacakan deviasi, dan pemantauan aktivitas anomali gudang.'}
                </p>
              </div>
            </div>
          </div>

          {/* Controls: Period Selector & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Period Navigator */}
            <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-2xl p-1 shadow-inner">
              <button
                onClick={handlePrevMonth}
                title="Bulan Sebelumnya"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-2 px-3">
                <Calendar size={15} className="text-indigo-400" />
                <span className="text-xs font-bold text-white tracking-wide min-w-[120px] text-center">
                  {periodLabel}
                </span>
              </div>

              <button
                onClick={handleNextMonth}
                title="Bulan Berikutnya"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Jump to Current Month Button */}
            {(selectedMonth !== currentDate.getMonth() || selectedYear !== currentDate.getFullYear()) && (
              <button
                onClick={handleSetCurrentMonth}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-2xl border border-slate-700 transition-colors"
              >
                {t.monthlyAudit?.thisMonth || 'Bulan Ini'}
              </button>
            )}

            {/* SYNC BUTTON */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => fetchData(true)}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-600/20 border border-indigo-400/30 transition-all disabled:opacity-50"
            >
              <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
              <span>
                {isSyncing 
                  ? (t.monthlyAudit?.syncing || 'Menyinkronkan...') 
                  : (t.monthlyAudit?.syncButton || '⚡ Sinkronisasi Data Bulan Ini')}
              </span>
            </motion.button>

            {/* EXPORT CSV */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl text-xs font-bold transition-colors shadow-sm"
              title="Unduh Data Excel / CSV"
            >
              <Download size={15} />
              <span className="hidden sm:inline">{t.monthlyAudit?.exportExcel || 'Download Excel (CSV)'}</span>
            </button>

            {/* PRINT / SAVE PDF */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl text-xs font-bold transition-colors shadow-sm"
              title="Cetak Berita Acara / Laporan Resmi"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">{t.monthlyAudit?.printPdf || 'Cetak / Simpan PDF'}</span>
            </button>
          </div>
        </div>

        {/* Sync Info Bar */}
        {lastSyncTime && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-2 -mt-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t.monthlyAudit?.lastSynced || 'Terakhir disinkronkan'}: <strong className="text-slate-400">{lastSyncTime}</strong></span>
            </span>
            <span>Total Transaksi Terverifikasi: <strong className="text-slate-400">{monthTransactions.length} log</strong></span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* KPI CARDS */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Skor Integritas Audit */}
          <div className="bg-[#0F0F12] border border-white/5 p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t.monthlyAudit?.healthScore || 'Integritas Audit'}
              </span>
              <div className={`p-2 rounded-xl ${totals.integrityScore >= 85 ? 'bg-emerald-500/10 text-emerald-400' : totals.integrityScore >= 65 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {totals.integrityScore >= 85 ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-white tracking-tight">
                  {totals.integrityScore}%
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${totals.integrityScore >= 85 ? 'text-emerald-400' : totals.integrityScore >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {totals.integrityScore >= 85 
                    ? (t.monthlyAudit?.healthScoreGood || 'Sehat & Terverifikasi')
                    : totals.integrityScore >= 65 
                    ? (t.monthlyAudit?.healthScoreWarning || 'Perlu Tinjauan')
                    : (t.monthlyAudit?.healthScoreDanger || 'Risiko Tinggi')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {totals.discrepancies > 0 
                  ? `${totals.discrepancies} selisih saldo ditemukan`
                  : 'Seluruh rumus buku besar seimbang'}
              </p>
            </div>
          </div>

          {/* Card 2: Stok Awal Bulan */}
          <div className="bg-[#0F0F12] border border-white/5 p-5 rounded-3xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t.monthlyAudit?.totalStartStock || 'Total Stok Awal'}
              </span>
              <div className="p-2 rounded-xl bg-slate-800 text-slate-400">
                <CalendarDays size={18} />
              </div>
            </div>
            <div>
              <span className="text-3xl font-black font-mono text-white tracking-tight">
                {totals.startStock.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-slate-500 ml-1 font-medium">Pcs</span>
              <p className="text-[11px] text-slate-500 mt-1">
                Valuasi: <strong className="text-slate-300">Rp {totals.startVal.toLocaleString('id-ID')}</strong>
              </p>
            </div>
          </div>

          {/* Card 3: Total Masuk (+) */}
          <div className="bg-[#0F0F12] border border-white/5 p-5 rounded-3xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                {t.monthlyAudit?.totalIn || 'Total Masuk (+)'}
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp size={18} />
              </div>
            </div>
            <div>
              <span className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
                +{totals.inQty.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-emerald-500/70 ml-1 font-medium">Pcs</span>
              <p className="text-[11px] text-slate-500 mt-1">
                Restock & Mutasi Masuk
              </p>
            </div>
          </div>

          {/* Card 4: Total Keluar (-) */}
          <div className="bg-[#0F0F12] border border-white/5 p-5 rounded-3xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                {t.monthlyAudit?.totalOut || 'Total Keluar (-)'}
              </span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                <TrendingDown size={18} />
              </div>
            </div>
            <div>
              <span className="text-3xl font-black font-mono text-rose-400 tracking-tight">
                -{totals.outQty.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-rose-500/70 ml-1 font-medium">Pcs</span>
              <p className="text-[11px] text-slate-500 mt-1">
                Konsumsi & Distribusi
              </p>
            </div>
          </div>

          {/* Card 5: Total Stok Akhir Bulan */}
          <div className="bg-[#0F0F12] border border-white/5 p-5 rounded-3xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                {t.monthlyAudit?.totalEndStock || 'Total Stok Akhir'}
              </span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Package size={18} />
              </div>
            </div>
            <div>
              <span className="text-3xl font-black font-mono text-white tracking-tight">
                {totals.endStock.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-slate-500 ml-1 font-medium">Pcs</span>
              <p className="text-[11px] text-slate-500 mt-1">
                Valuasi: <strong className="text-indigo-400">Rp {totals.endVal.toLocaleString('id-ID')}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* ANOMALY ALERT BANNER (If anomalies detected) */}
        {/* ------------------------------------------------------------- */}
        {anomalies.length > 0 ? (
          <div className="bg-gradient-to-r from-amber-950/30 via-slate-900/50 to-rose-950/30 border border-amber-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-2xl flex-shrink-0 animate-pulse">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      {t.monthlyAudit?.anomalyAlertTitle || 'Peringatan: Aktivitas Tidak Normal Terdeteksi'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {totals.totalAnomalies} Temuan ({totals.unreviewedAnomalies} Belum Ditinjau)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.monthlyAudit?.anomalyAlertDesc || 'Sistem menganalisis pergerakan barang dan menemukan beberapa transaksi di luar batas parameter standar gudang.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={() => setActiveTab('anomalies')}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Eye size={14} />
                  <span>Lihat Rincian Anomali</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-emerald-300">
              {t.monthlyAudit?.noAnomaliesFound || 'Tidak ada aktivitas mencurigakan pada bulan ini. Semua transaksi tercatat sesuai parameter operasional standar.'}
            </p>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TABS NAVIGATION */}
        {/* ------------------------------------------------------------- */}
        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'reconciliation'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileSpreadsheet size={15} />
            <span>{t.monthlyAudit?.tabReconciliation || 'Tabel Rekonsiliasi Stok'}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/20 font-mono">
              {filteredItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('anomalies')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'anomalies'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <ShieldAlert size={15} />
            <span>{t.monthlyAudit?.tabAnomalies || 'Log Aktivitas Tidak Normal'}</span>
            {anomalies.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'anomalies' ? 'bg-black/30 text-white' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {anomalies.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'analytics'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <BarChart2 size={15} />
            <span>{t.monthlyAudit?.tabAnalytics || 'Grafik & Tren Aliran'}</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: RECONCILIATION TABLE */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'reconciliation' && (
          <div className="space-y-4">
            {/* Search and Filters Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0F0F12] border border-white/5 p-4 rounded-2xl">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.monthlyAudit?.searchPlaceholder || 'Cari SKU, nama barang, atau kategori...'}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">{t.monthlyAudit?.filterAll || 'Semua Status'}</option>
                  <option value="balanced">{t.monthlyAudit?.filterBalanced || 'Hanya Seimbang'}</option>
                  <option value="discrepancy">{t.monthlyAudit?.filterDiscrepancy || 'Hanya Selisih'}</option>
                  <option value="anomalies">{t.monthlyAudit?.filterAnomalies || 'Ada Anomali'}</option>
                </select>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500 capitalize"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>
                      {c === 'all' ? 'Semua Kategori' : c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main Table */}
            <div className="bg-[#0F0F12] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-4 px-4">No</th>
                      <th className="py-4 px-4">{t.monthlyAudit?.itemCode || 'Barang & Kategori'}</th>
                      <th className="py-4 px-4 text-right">{t.monthlyAudit?.unitCost || 'Biaya Satuan'}</th>
                      <th className="py-4 px-4 text-center bg-slate-900/30">{t.monthlyAudit?.startStock || 'Stok Awal'}</th>
                      <th className="py-4 px-4 text-center text-emerald-400 bg-emerald-950/10">{t.monthlyAudit?.qtyIn || 'Masuk (+)'}</th>
                      <th className="py-4 px-4 text-center text-rose-400 bg-rose-950/10">{t.monthlyAudit?.qtyOut || 'Keluar (-)'}</th>
                      <th className="py-4 px-4 text-center">{t.monthlyAudit?.netMovement || 'Net Mutasi'}</th>
                      <th className="py-4 px-4 text-center bg-indigo-950/20 text-indigo-300">{t.monthlyAudit?.endStock || 'Stok Akhir'}</th>
                      <th className="py-4 px-4 text-right">{t.monthlyAudit?.endValue || 'Valuasi Akhir'}</th>
                      <th className="py-4 px-4 text-center">{t.monthlyAudit?.status || 'Status'}</th>
                      <th className="py-4 px-4 text-center">{t.monthlyAudit?.action || 'Aksi'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-500">
                          <Package size={36} className="mx-auto mb-2 opacity-30" />
                          <p>{t.monthlyAudit?.noItemsFound || 'Tidak ada barang yang cocok dengan filter Anda.'}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-slate-800/30 transition-colors ${
                            item.has_anomaly ? 'bg-amber-950/10' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{item.name}</span>
                              {item.has_anomaly && (
                                <span title="Memiliki temuan anomali transaksi" className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Anomali
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 capitalize">
                                {item.category}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
                                {item.id.slice(0, 8)}...
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                            Rp {item.unit_cost.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-200 bg-slate-900/20">
                            {item.start_stock.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400 bg-emerald-950/10">
                            {item.in_quantity > 0 ? `+${item.in_quantity.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-400 bg-rose-950/10">
                            {item.out_quantity > 0 ? `-${item.out_quantity.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-semibold">
                            <span className={item.net_movement > 0 ? 'text-emerald-400' : item.net_movement < 0 ? 'text-rose-400' : 'text-slate-500'}>
                              {item.net_movement > 0 ? `+${item.net_movement}` : item.net_movement}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-black text-indigo-300 bg-indigo-950/20">
                            {item.end_stock.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-300">
                            Rp {item.end_valuation.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {item.status === 'balanced' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Check size={12} />
                                <span>{t.monthlyAudit?.balanced || 'Seimbang'}</span>
                              </span>
                            ) : item.status === 'discrepancy' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <XCircle size={12} />
                                <span>Selisih ({item.discrepancy_amount})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <AlertTriangle size={12} />
                                <span>Stok Rendah</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => setSelectedItemForLedger(item)}
                              title="Buka Buku Besar Transaksi Bulan Ini"
                              className="p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                            >
                              <FileText size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {/* Table Footer with Summary Row */}
                  <tfoot>
                    <tr className="bg-slate-950/80 border-t-2 border-white/10 text-xs font-bold text-white">
                      <td colSpan={3} className="py-4 px-4 text-right uppercase tracking-wider text-slate-400">
                        Total Rekonsiliasi ({filteredItems.length} SKU):
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-slate-200">
                        {filteredItems.reduce((acc, i) => acc + i.start_stock, 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-emerald-400">
                        +{filteredItems.reduce((acc, i) => acc + i.in_quantity, 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-rose-400">
                        -{filteredItems.reduce((acc, i) => acc + i.out_quantity, 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-indigo-400">
                        {filteredItems.reduce((acc, i) => acc + i.net_movement, 0)}
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-indigo-300">
                        {filteredItems.reduce((acc, i) => acc + i.end_stock, 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-indigo-400">
                        Rp {filteredItems.reduce((acc, i) => acc + i.end_valuation, 0).toLocaleString('id-ID')}
                      </td>
                      <td colSpan={2} className="py-4 px-4 text-center text-slate-500 font-normal">
                        Terverifikasi
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: ANOMALY LOGS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'anomalies' && (
          <div className="space-y-4">
            {/* Top Bar with Anomaly Metrics */}
            <div className="bg-[#0F0F12] border border-white/5 p-5 rounded-3xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <ShieldAlert size={18} className="text-amber-400" />
                      <span>{t.monthlyAudit?.tabAnomalies || 'Log Aktivitas Tidak Normal (Audit Anomali)'}</span>
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {anomalies.length} Total Temuan
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                    Sistem mendeteksi dan mengelompokkan secara spesifik transaksi <strong className="text-emerald-400 font-semibold">Barang Masuk (Restock/Penerimaan)</strong> dan <strong className="text-rose-400 font-semibold">Barang Keluar (Konsumsi/Pengeluaran)</strong> yang berada di luar ambang batas operasional standar.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start md:self-center">
                  <span className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-white/5">
                    Periode: <strong className="text-white">{periodLabel}</strong>
                  </span>
                </div>
              </div>

              {/* Quick Anomaly Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5">
                <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Temuan</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-mono font-black text-white">{anomalyStats.total}</span>
                    <span className="text-[11px] text-slate-500">kasus</span>
                  </div>
                </div>

                <div className="bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20">
                  <span className="text-[10px] uppercase font-bold text-rose-400 block flex items-center gap-1">
                    <TrendingDown size={12} />
                    <span>Barang Keluar</span>
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-mono font-black text-rose-400">{anomalyStats.outCount}</span>
                    <span className="text-[11px] text-rose-500/70">pengeluaran</span>
                  </div>
                </div>

                <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block flex items-center gap-1">
                    <TrendingUp size={12} />
                    <span>Barang Masuk</span>
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-mono font-black text-emerald-400">{anomalyStats.inCount}</span>
                    <span className="text-[11px] text-emerald-500/70">penerimaan</span>
                  </div>
                </div>

                <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 block">Status Review</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-mono font-black text-indigo-300">{anomalyStats.reviewedCount}</span>
                    <span className="text-[11px] text-slate-400">/ {anomalyStats.total} selesai</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar for Anomalies */}
            <div className="bg-[#0F0F12] border border-white/5 p-4 rounded-2xl space-y-3">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Direction Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mr-1 hidden sm:inline">
                    Arah:
                  </span>
                  <button
                    onClick={() => setAnomalyDirectionFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      anomalyDirectionFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>{t.monthlyAudit?.filterAllDirections || 'Semua Arah Mutasi'}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 font-mono">
                      {anomalyStats.total}
                    </span>
                  </button>

                  <button
                    onClick={() => setAnomalyDirectionFilter('out')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      anomalyDirectionFilter === 'out'
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                        : 'bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20'
                    }`}
                  >
                    <TrendingDown size={13} />
                    <span>{t.monthlyAudit?.filterOutflowOnly || 'Hanya Barang Keluar (-)'}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 font-mono">
                      {anomalyStats.outCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setAnomalyDirectionFilter('in')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      anomalyDirectionFilter === 'in'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20'
                    }`}
                  >
                    <TrendingUp size={13} />
                    <span>{t.monthlyAudit?.filterInflowOnly || 'Hanya Barang Masuk (+)'}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 font-mono">
                      {anomalyStats.inCount}
                    </span>
                  </button>
                </div>

                {/* Severity Filters */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/5 text-xs">
                    <button
                      onClick={() => setAnomalySeverityFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        anomalySeverityFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => setAnomalySeverityFilter('critical')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        anomalySeverityFilter === 'critical' ? 'bg-rose-500/30 text-rose-300' : 'text-slate-400 hover:text-rose-400'
                      }`}
                    >
                      Kritis
                    </button>
                    <button
                      onClick={() => setAnomalySeverityFilter('warning')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        anomalySeverityFilter === 'warning' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      Peringatan
                    </button>
                    <button
                      onClick={() => setAnomalySeverityFilter('info')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        anomalySeverityFilter === 'info' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-indigo-400'
                      }`}
                    >
                      Info
                    </button>
                  </div>
                </div>
              </div>

              {/* Anomaly Search Bar */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={anomalySearchQuery}
                  onChange={(e) => setAnomalySearchQuery(e.target.value)}
                  placeholder="Cari berdasarkan nama barang, operator, indikasi anomali, atau catatan..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {anomalySearchQuery && (
                  <button
                    onClick={() => setAnomalySearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Anomaly Items List */}
            {anomalies.length === 0 ? (
              <div className="bg-[#0F0F12] border border-white/5 rounded-3xl p-12 text-center">
                <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-400" />
                <h4 className="text-base font-bold text-white">Semua Transaksi Normal</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Tidak ada anomali atau transaksi yang mencurigakan terdeteksi pada periode {periodLabel}. Seluruh pergerakan barang masuk dan keluar berjalan sesuai standar operasional.
                </p>
              </div>
            ) : filteredAnomalies.length === 0 ? (
              <div className="bg-[#0F0F12] border border-white/5 rounded-3xl p-12 text-center space-y-3">
                <AlertTriangle size={40} className="mx-auto text-slate-500" />
                <h4 className="text-sm font-bold text-white">Tidak Ada Temuan yang Sesuai Filter</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Tidak ada anomali yang cocok dengan kriteria filter arah mutasi ({anomalyDirectionFilter}) atau kata kunci pencarian saat ini.
                </p>
                <button
                  onClick={() => {
                    setAnomalyDirectionFilter('all');
                    setAnomalySeverityFilter('all');
                    setAnomalySearchQuery('');
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-xl transition-colors"
                >
                  Reset Filter Anomali
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredAnomalies.map((anomaly) => {
                  const isInflow = anomaly.transaction_type === 'in';
                  return (
                    <div
                      key={anomaly.id}
                      className={`bg-[#0F0F12] border p-5 rounded-3xl transition-all shadow-lg ${
                        anomaly.is_reviewed
                          ? 'border-white/5 opacity-85'
                          : isInflow
                          ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-[#0F0F12] to-transparent'
                          : 'border-rose-500/30 bg-gradient-to-br from-rose-950/20 via-[#0F0F12] to-transparent'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          {/* Badges Header Bar */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* DIRECTION BADGE (MASUK vs KELUAR) */}
                            {isInflow ? (
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
                                <TrendingUp size={14} className="stroke-[2.5]" />
                                <span>{t.monthlyAudit?.badgeInflow || 'BARANG MASUK (PENERIMAAN / RESTOCK)'}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm">
                                <TrendingDown size={14} className="stroke-[2.5]" />
                                <span>{t.monthlyAudit?.badgeOutflow || 'BARANG KELUAR (PENGELUARAN / KONSUMSI)'}</span>
                              </div>
                            )}

                            {/* Severity Badge */}
                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                              anomaly.severity === 'critical'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : anomaly.severity === 'warning'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            }`}>
                              {anomaly.severity === 'critical' ? '🔴 KRITIS' : anomaly.severity === 'warning' ? '🟡 PERINGATAN' : '🔵 INFO'}
                            </span>

                            {/* Type Label */}
                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {anomaly.type === 'spike' ? 'Lonjakan Masif'
                                : anomaly.type === 'after_hours' ? 'Luar Jam Operasional'
                                : anomaly.type === 'rapid' ? 'Pengeluaran Beruntun'
                                : anomaly.type === 'no_note' ? 'Tanpa Catatan Keperluan'
                                : 'Anomali Mutasi'}
                            </span>

                            {/* Reviewed Badge */}
                            {anomaly.is_reviewed ? (
                              <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <Check size={12} />
                                <span>Sudah Diverifikasi ({anomaly.reviewed_by})</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Belum Ditinjau
                              </span>
                            )}

                            {/* Timestamp */}
                            <span className="text-[11px] text-slate-400 ml-auto flex items-center gap-1 font-mono">
                              <Clock size={12} className="text-slate-500" />
                              {new Date(anomaly.timestamp).toLocaleString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })} WITA
                            </span>
                          </div>

                          {/* Product Header & Transaction Volume Highlight */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-900/60 rounded-2xl border border-white/5">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-white tracking-wide">
                                  {anomaly.product_name}
                                </h4>
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-800 text-slate-400 border border-white/5 capitalize">
                                  {anomaly.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Petugas Penginput: <strong className="text-slate-200">{anomaly.operator_name}</strong>
                              </p>
                            </div>

                            <div className="text-left sm:text-right">
                              <span className={`text-base font-black font-mono tracking-tight ${
                                isInflow ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {isInflow ? `+${anomaly.quantity}` : `-${anomaly.quantity}`} Pcs
                              </span>
                              <span className="text-xs text-slate-400 ml-1.5 font-medium">
                                (Rp {anomaly.total_value.toLocaleString('id-ID')})
                              </span>
                            </div>
                          </div>

                          {/* KETERANGAN & PENJELASAN INDIKASI ANOMALI */}
                          <div className="space-y-2">
                            <div className="bg-slate-950/70 p-3 rounded-2xl border border-white/5 text-xs">
                              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                <Info size={13} className={isInflow ? 'text-emerald-400' : 'text-rose-400'} />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                  {t.monthlyAudit?.anomalyDetailExplanation || 'Keterangan & Indikasi Anomali'}:
                                </span>
                              </div>
                              <p className="text-xs text-slate-200 font-medium leading-relaxed pl-5">
                                {anomaly.description}
                              </p>
                            </div>

                            {/* CATATAN ASLI PETUGAS (JIKA ADA ATAU JIKA KOSONG) */}
                            {anomaly.note ? (
                              <div className="bg-slate-900/50 p-3 rounded-2xl border border-white/5 text-xs text-slate-300">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                  Catatan Asli Transaksi dari Petugas:
                                </span>
                                <div className="italic text-slate-200 bg-slate-950/50 p-2 rounded-xl border border-white/5">
                                  "{anomaly.note}"
                                </div>
                              </div>
                            ) : (
                              <div className="bg-amber-950/20 p-2.5 rounded-2xl border border-amber-500/20 text-xs text-amber-300/90 flex items-center gap-2">
                                <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
                                <span>
                                  <strong>Tanpa Catatan Petugas:</strong> Transaksi mutasi {isInflow ? 'Barang Masuk' : 'Barang Keluar'} ini diinput tanpa keterangan peruntukan atau nomor dokumen acuan.
                                </span>
                              </div>
                            )}

                            {/* REKOMENDASI AUDIT */}
                            <div className="bg-indigo-950/20 p-3 rounded-2xl border border-indigo-500/20 text-xs text-slate-300">
                              <div className="flex items-center gap-1.5 text-indigo-300 font-bold mb-1">
                                <ShieldCheck size={14} className="text-indigo-400" />
                                <span>{t.monthlyAudit?.auditRecommendation || 'Rekomendasi Tindakan Auditor'}:</span>
                              </div>
                              <p className="text-slate-300 pl-5 leading-relaxed">
                                {anomaly.recommendation}
                              </p>
                            </div>

                            {/* CATATAN REVIEW AUDITOR (JIKA SUDAH DITINJAU) */}
                            {anomaly.is_reviewed && anomaly.review_notes && (
                              <div className="bg-emerald-950/25 p-3 rounded-2xl border border-emerald-500/30 text-xs text-emerald-300 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className="text-emerald-400" />
                                    <span>Verifikasi Auditor ({anomaly.reviewed_by})</span>
                                  </span>
                                  {anomaly.reviewed_at && (
                                    <span className="text-[10px] text-emerald-400/80 font-mono">
                                      {new Date(anomaly.reviewed_at).toLocaleString('id-ID')}
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-200 pl-5">
                                  {anomaly.review_notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Review Button */}
                        <div className="flex-shrink-0 self-end lg:self-center pt-2 lg:pt-0">
                          <button
                            onClick={() => {
                              setSelectedAnomalyForReview(anomaly);
                              setInvestigationNote(anomaly.review_notes || '');
                            }}
                            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                              anomaly.is_reviewed
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30'
                            }`}
                          >
                            <Check size={14} />
                            <span>{anomaly.is_reviewed ? 'Ubah Catatan Klarifikasi' : 'Tandai Telah Ditinjau'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: ANALYTICS & FLOW TRENDS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-[#0F0F12] border border-white/5 p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Komparasi Pergerakan 6 Produk Teratas</h3>
                  <p className="text-xs text-slate-400">Perbandingan Stok Awal, Barang Masuk, Barang Keluar, dan Stok Akhir.</p>
                </div>
                <span className="text-xs font-mono text-indigo-400">{periodLabel}</span>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="name" stroke="#666" fontSize={11} />
                    <YAxis stroke="#666" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f0f12', borderColor: '#333', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                    <Bar dataKey="Stok Awal" fill="#64748b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Masuk" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Keluar" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Stok Akhir" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: ITEM TRANSACTION LEDGER (Buku Besar Transaksi SKU) */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedItemForLedger && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0F0F12] border border-white/10 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Package size={18} className="text-indigo-400" />
                    <span>Buku Besar: {selectedItemForLedger.name}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Periode: <strong className="text-slate-200">{periodLabel}</strong> • Kategori: <span className="capitalize">{selectedItemForLedger.category}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedItemForLedger(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
                >
                  <XCircle size={18} />
                </button>
              </div>

              {/* Snapshot Metrics */}
              <div className="grid grid-cols-4 gap-2 p-4 bg-slate-950/50 border-b border-white/5 text-center">
                <div className="p-2 bg-slate-900 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Stok Awal</span>
                  <span className="text-sm font-bold font-mono text-white">{selectedItemForLedger.start_stock}</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl">
                  <span className="text-[10px] text-emerald-400 block">Masuk (+)</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">+{selectedItemForLedger.in_quantity}</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl">
                  <span className="text-[10px] text-rose-400 block">Keluar (-)</span>
                  <span className="text-sm font-bold font-mono text-rose-400">-{selectedItemForLedger.out_quantity}</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl">
                  <span className="text-[10px] text-indigo-400 block">Stok Akhir</span>
                  <span className="text-sm font-bold font-mono text-indigo-300">{selectedItemForLedger.end_stock}</span>
                </div>
              </div>

              {/* Transactions List */}
              <div className="overflow-y-auto p-4 flex-1 space-y-2">
                {monthTransactions.filter(t => t.product_id === selectedItemForLedger.id).length === 0 ? (
                  <p className="text-xs text-center text-slate-500 py-8">
                    Tidak ada transaksi mutasi fisik tercatat untuk barang ini pada periode {periodLabel}.
                  </p>
                ) : (
                  monthTransactions
                    .filter(t => t.product_id === selectedItemForLedger.id)
                    .map(t => (
                      <div
                        key={t.id}
                        className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${
                            t.type === 'in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {t.type === 'in' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{t.type === 'in' ? 'Restock / Penerimaan' : 'Pengeluaran / Konsumsi'}</span>
                              <span className="font-mono text-[11px] text-slate-400">
                                {new Date(t.timestamp).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Petugas: <strong className="text-slate-300">{t.user_name || 'Staff'}</strong>
                              {t.note && ` • "${t.note}"`}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-sm font-black font-mono ${
                            t.type === 'in' ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {t.type === 'in' ? `+${t.quantity}` : `-${t.quantity}`} Pcs
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="p-4 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => setSelectedItemForLedger(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-700"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: REVIEW ANOMALY DIALOG */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedAnomalyForReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0F0F12] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2.5 rounded-xl border ${
                    selectedAnomalyForReview.transaction_type === 'in'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}>
                    {selectedAnomalyForReview.transaction_type === 'in' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Tinjau Temuan Anomali Mutasi</h3>
                    <p className="text-[11px] text-slate-400 font-medium">{selectedAnomalyForReview.product_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAnomalyForReview(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <XCircle size={18} />
                </button>
              </div>

              {/* DIRECTION & SUMMARY BADGE */}
              <div className="flex items-center justify-between">
                {selectedAnomalyForReview.transaction_type === 'in' ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <TrendingUp size={13} />
                    <span>BARANG MASUK (PENERIMAAN / RESTOCK)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <TrendingDown size={13} />
                    <span>BARANG KELUAR (PENGELUARAN / KONSUMSI)</span>
                  </span>
                )}

                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  selectedAnomalyForReview.severity === 'critical'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : selectedAnomalyForReview.severity === 'warning'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}>
                  {selectedAnomalyForReview.severity}
                </span>
              </div>

              {/* TRANSACTION METRICS */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-900/80 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Volume & Valuasi</span>
                  <span className={`font-mono font-bold text-sm ${
                    selectedAnomalyForReview.transaction_type === 'in' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {selectedAnomalyForReview.transaction_type === 'in' ? '+' : '-'}{selectedAnomalyForReview.quantity} Pcs
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                    Rp {selectedAnomalyForReview.total_value.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-900/80 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Waktu & Petugas</span>
                  <span className="font-bold text-slate-200 block truncate">
                    {selectedAnomalyForReview.operator_name}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                    {new Date(selectedAnomalyForReview.timestamp).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* INDIKASI DETAIL & REKOMENDASI */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-white/5 space-y-2 text-xs">
                <div>
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-0.5">
                    Keterangan Indikasi Anomali:
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {selectedAnomalyForReview.description}
                  </p>
                </div>

                {/* CATATAN ASLI */}
                <div className="pt-1.5 border-t border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Catatan Asli Petugas Saat Transaksi:
                  </span>
                  {selectedAnomalyForReview.note ? (
                    <p className="text-slate-300 italic bg-slate-900/50 p-2 rounded-lg border border-white/5">
                      "{selectedAnomalyForReview.note}"
                    </p>
                  ) : (
                    <p className="text-amber-400/90 text-[11px]">
                      ⚠️ Tidak ada catatan yang dicantumkan oleh petugas pada transaksi ini.
                    </p>
                  )}
                </div>

                <div className="pt-1.5 border-t border-white/5">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-0.5">
                    Rekomendasi Tindakan:
                  </span>
                  <p className="text-slate-400 text-[11px]">
                    {selectedAnomalyForReview.recommendation}
                  </p>
                </div>
              </div>

              {/* AUDITOR NOTES INPUT */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Catatan Klarifikasi & Tindakan Auditor:</span>
                  <span className="text-[10px] text-slate-500 font-normal">Wajib diisi untuk audit trail</span>
                </label>
                <textarea
                  rows={3}
                  value={investigationNote}
                  onChange={(e) => setInvestigationNote(e.target.value)}
                  placeholder="Contoh: Telah dikonfirmasi ke supervisor jaga. Pengeluaran barang ini untuk pekerjaan darurat genset shift malam (Surat Tugas No. ST-04)..."
                  className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => setSelectedAnomalyForReview(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveReview}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Simpan Verifikasi Audit</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* PRINT-ONLY OFFICIAL AUDIT REPORT (Berita Acara Cetak Resmi) */}
      {/* Visible ONLY when printing (@media print) */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden print:block text-black bg-white p-8 max-w-4xl mx-auto font-serif">
        {/* Company & Document Header */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase">STOCKFLOW WMS OBSIDIAN</h1>
              <p className="text-xs text-gray-700">Enterprise Warehouse Management & Inventory Reconciliation System</p>
              <p className="text-xs text-gray-700">Kompleks Pergudangan Pusat • Divisi Logistik & Audit Aset</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold">BERITA ACARA AUDIT RESMI</p>
              <p>No: BA-STK/{selectedYear}/{String(selectedMonth + 1).padStart(2, '0')}/001</p>
              <p>Tanggal Cetak: {new Date().toLocaleDateString('id-ID')}</p>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-gray-400 text-center">
            <h2 className="text-base font-bold uppercase tracking-wide">
              LAPORAN REKONSILIASI STOK & AUDIT ANOMALI BULANAN
            </h2>
            <p className="text-xs text-gray-600">
              Periode: <strong>{periodLabel}</strong> (1 {monthNamesID[selectedMonth]} {selectedYear} - {monthEnd.getDate()} {monthNamesID[selectedMonth]} {selectedYear})
            </p>
          </div>
        </div>

        {/* Executive Summary Cards in Print */}
        <div className="mb-6 grid grid-cols-4 gap-4 text-xs border border-gray-300 p-3 bg-gray-50">
          <div>
            <span className="block text-gray-500 uppercase text-[10px]">Stok Awal Bulan</span>
            <span className="font-bold text-sm">{totals.startStock.toLocaleString('id-ID')} Unit</span>
            <span className="block text-[10px] text-gray-600">Rp {totals.startVal.toLocaleString('id-ID')}</span>
          </div>
          <div>
            <span className="block text-gray-500 uppercase text-[10px]">Total Barang Masuk (+)</span>
            <span className="font-bold text-sm text-green-700">+{totals.inQty.toLocaleString('id-ID')} Unit</span>
            <span className="block text-[10px] text-gray-600">Restock & Mutasi</span>
          </div>
          <div>
            <span className="block text-gray-500 uppercase text-[10px]">Total Barang Keluar (-)</span>
            <span className="font-bold text-sm text-red-700">-{totals.outQty.toLocaleString('id-ID')} Unit</span>
            <span className="block text-[10px] text-gray-600">Konsumsi & Distribusi</span>
          </div>
          <div>
            <span className="block text-gray-500 uppercase text-[10px]">Stok Akhir Bulan</span>
            <span className="font-bold text-sm">{totals.endStock.toLocaleString('id-ID')} Unit</span>
            <span className="block text-[10px] text-gray-600">Rp {totals.endVal.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Status Integritas */}
        <div className="mb-6 text-xs p-2.5 border border-black bg-white flex justify-between items-center">
          <div>
            <strong>Skor Integritas Audit: {totals.integrityScore}/100</strong> • 
            Status: {totals.integrityScore >= 85 ? 'SEHAT & TERVERIFIKASI' : 'PERLU PERHATIAN KHUSUS'}
          </div>
          <div>
            Temuan Anomali: <strong>{anomalies.length} aktivitas</strong> ({totals.unreviewedAnomalies} belum ditinjau)
          </div>
        </div>

        {/* Detail Table */}
        <h3 className="text-xs font-bold uppercase mb-2 border-b border-gray-400 pb-1">
          I. Tabel Rincian Rekonsiliasi Per Barang
        </h3>
        <table className="w-full text-left border-collapse text-[10px] mb-6">
          <thead>
            <tr className="border-b border-black bg-gray-100">
              <th className="p-1 border border-gray-300">No</th>
              <th className="p-1 border border-gray-300">Nama Barang</th>
              <th className="p-1 border border-gray-300">Kategori</th>
              <th className="p-1 border border-gray-300 text-right">Biaya Satuan</th>
              <th className="p-1 border border-gray-300 text-center">Stok Awal</th>
              <th className="p-1 border border-gray-300 text-center">Masuk (+)</th>
              <th className="p-1 border border-gray-300 text-center">Keluar (-)</th>
              <th className="p-1 border border-gray-300 text-center">Stok Akhir</th>
              <th className="p-1 border border-gray-300 text-right">Valuasi Akhir</th>
              <th className="p-1 border border-gray-300 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {reconciliationData.map((item, idx) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="p-1 border border-gray-300 text-center">{idx + 1}</td>
                <td className="p-1 border border-gray-300 font-bold">{item.name}</td>
                <td className="p-1 border border-gray-300 capitalize">{item.category}</td>
                <td className="p-1 border border-gray-300 text-right">Rp {item.unit_cost.toLocaleString('id-ID')}</td>
                <td className="p-1 border border-gray-300 text-center">{item.start_stock}</td>
                <td className="p-1 border border-gray-300 text-center">{item.in_quantity > 0 ? `+${item.in_quantity}` : '-'}</td>
                <td className="p-1 border border-gray-300 text-center">{item.out_quantity > 0 ? `-${item.out_quantity}` : '-'}</td>
                <td className="p-1 border border-gray-300 text-center font-bold">{item.end_stock}</td>
                <td className="p-1 border border-gray-300 text-right">Rp {item.end_valuation.toLocaleString('id-ID')}</td>
                <td className="p-1 border border-gray-300 text-center">
                  {item.status === 'balanced' ? 'Seimbang' : 'Ada Selisih'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t-2 border-black bg-gray-100">
              <td colSpan={4} className="p-1 text-right">Total:</td>
              <td className="p-1 text-center">{totals.startStock}</td>
              <td className="p-1 text-center">+{totals.inQty}</td>
              <td className="p-1 text-center">-{totals.outQty}</td>
              <td className="p-1 text-center">{totals.endStock}</td>
              <td className="p-1 text-right">Rp {totals.endVal.toLocaleString('id-ID')}</td>
              <td className="p-1 text-center">Terverifikasi</td>
            </tr>
          </tfoot>
        </table>

        {/* Anomaly Section in Print */}
        <h3 className="text-xs font-bold uppercase mb-2 border-b border-gray-400 pb-1">
          II. Temuan Catatan Aktivitas Tidak Normal (Anomali)
        </h3>
        {anomalies.length === 0 ? (
          <p className="text-[10px] text-gray-600 mb-6 italic">
            Tidak ada temuan anomali pada periode ini. Semua pergerakan berlangsung sesuai SOP.
          </p>
        ) : (
          <table className="w-full text-left border-collapse text-[9px] mb-6">
            <thead>
              <tr className="border-b border-black bg-gray-100">
                <th className="p-1 border border-gray-300">Waktu</th>
                <th className="p-1 border border-gray-300">Arah Mutasi</th>
                <th className="p-1 border border-gray-300">Barang & Kategori</th>
                <th className="p-1 border border-gray-300 text-center">Jumlah & Nilai</th>
                <th className="p-1 border border-gray-300">Petugas & Catatan</th>
                <th className="p-1 border border-gray-300">Keterangan Indikasi & Rekomendasi</th>
                <th className="p-1 border border-gray-300">Status Verifikasi</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.id} className="border-b border-gray-200">
                  <td className="p-1 border border-gray-300 font-mono">{new Date(a.timestamp).toLocaleString('id-ID')}</td>
                  <td className="p-1 border border-gray-300 font-bold">
                    {a.transaction_type === 'in' ? (
                      <span className="text-green-700">BARANG MASUK (+)</span>
                    ) : (
                      <span className="text-red-700">BARANG KELUAR (-)</span>
                    )}
                  </td>
                  <td className="p-1 border border-gray-300">
                    <strong>{a.product_name}</strong>
                    <span className="block text-[8px] text-gray-500 capitalize">{a.category}</span>
                  </td>
                  <td className="p-1 border border-gray-300 text-center font-mono font-bold">
                    {a.transaction_type === 'in' ? `+${a.quantity}` : `-${a.quantity}`} Pcs
                    <span className="block text-[8px] font-normal text-gray-600">Rp {a.total_value.toLocaleString('id-ID')}</span>
                  </td>
                  <td className="p-1 border border-gray-300">
                    <strong>{a.operator_name}</strong>
                    <span className="block text-[8px] italic text-gray-600">
                      {a.note ? `"${a.note}"` : '(Tanpa catatan)'}
                    </span>
                  </td>
                  <td className="p-1 border border-gray-300">
                    <p className="font-medium">{a.description}</p>
                    <p className="text-[8px] text-gray-600 mt-0.5">Saran: {a.recommendation}</p>
                  </td>
                  <td className="p-1 border border-gray-300">
                    {a.is_reviewed ? (
                      <span className="text-green-700 font-bold">Diverifikasi: {a.review_notes || 'OK'} ({a.reviewed_by})</span>
                    ) : (
                      <span className="text-red-600 font-bold">Belum Ditinjau</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Signatures Column */}
        <div className="mt-8 pt-4 border-t border-gray-400">
          <p className="text-[10px] text-gray-500 mb-6 italic">
            Demikian berita acara dan laporan rekonsiliasi stok ini dicetak secara sah dari sistem StockFlow Obsidian untuk digunakan sebagaimana mestinya.
          </p>

          <div className="grid grid-cols-3 gap-8 text-center text-xs">
            <div>
              <p className="text-gray-600">Dibuat Oleh,</p>
              <p className="text-[10px] text-gray-400 mb-14">Operator / Staff Gudang</p>
              <div className="border-b border-black w-36 mx-auto" />
              <p className="mt-1 font-bold">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Staff Gudang'}</p>
            </div>

            <div>
              <p className="text-gray-600">Diperiksa Oleh,</p>
              <p className="text-[10px] text-gray-400 mb-14">Supervisor / Auditor Internal</p>
              <div className="border-b border-black w-36 mx-auto" />
              <p className="mt-1 font-bold">(...........................................)</p>
            </div>

            <div>
              <p className="text-gray-600">Disetujui Oleh,</p>
              <p className="text-[10px] text-gray-400 mb-14">Kepala Gudang / Super Admin</p>
              <div className="border-b border-black w-36 mx-auto" />
              <p className="mt-1 font-bold">{isAdmin ? (user?.email || 'Super Admin') : '(...........................................)'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
