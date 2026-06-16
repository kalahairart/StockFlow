'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Layers, AlertCircle, DollarSign, Truck, Filter, Plus, ArrowUpRight, TrendingUp, Package } from 'lucide-react';
import StatCard from '@/components/dashboard/stat-card';
import InventoryTable from '@/components/inventory/inventory-table';
import StockModal from '@/components/inventory/stock-modal';
import ProductModal from '@/components/inventory/product-modal';
import MovementChart from '@/components/dashboard/movement-chart';
import { Product, Transaction, MovementData } from '@/types/inventory';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { sendTelegramNotification, formatStockAlert } from '@/lib/notifications';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/use-language';

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    fetchDashboardData();
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (productsError) throw productsError;
      setProducts(productsData || []);

      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const queryStartDate = thirtyDaysAgo < startOfCurrentMonth ? thirtyDaysAgo : startOfCurrentMonth;
      
      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .select('*, products(*)')
        .gte('timestamp', queryStartDate.toISOString())
        .order('timestamp', { ascending: true });

      if (transError) throw transError;
      setTransactions(transData as any || []);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const totals = useMemo(() => {
    const skuCount = products.length;
    const lowStockCount = products.filter(p => p.stock_quantity <= p.min_stock).length;
    
    // Asset Valuation: Current stock * unit cost
    const totalValuation = products.reduce((acc, p) => acc + (p.stock_quantity * (p.unit_cost || 0)), 0);
    
    // Monthly Outflow: sum of quantity for 'out' transactions in current calendar month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyOutflow = transactions
      .filter(t => {
        const txDate = new Date(t.timestamp);
        return t.type === 'out' && 
               txDate.getMonth() === currentMonth && 
               txDate.getFullYear() === currentYear;
      })
      .reduce((acc, t) => acc + t.quantity, 0);
    
    return {
      skuCount,
      lowStockCount,
      totalValue: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IDR', notation: 'compact' }).format(totalValuation),
      monthlyOutflow: `${monthlyOutflow} Units`
    };
  }, [products, transactions]);

  const itemizedWithdrawal = useMemo(() => {
    const withdrawalMap: Record<string, { name: string, quantity: number }> = {};
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    transactions
      .filter(t => {
        const txDate = new Date(t.timestamp);
        return t.type === 'out' && 
               txDate.getMonth() === currentMonth && 
               txDate.getFullYear() === currentYear;
      })
      .forEach(t => {
        const productName = (t as any).products?.name || 'Deleted Product';
        if (!withdrawalMap[t.product_id]) {
          withdrawalMap[t.product_id] = { name: productName, quantity: 0 };
        }
        withdrawalMap[t.product_id].quantity += t.quantity;
      });

    return Object.entries(withdrawalMap)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [transactions]);

  const downloadWithdrawalReport = () => {
    const headers = ['SKU ID', 'Product Name', 'Total Items Withdrawn'];
    const rows = itemizedWithdrawal.map(item => [
      item.id,
      item.name,
      item.quantity
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly_withdrawal_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const movementData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    return last7Days.map(date => {
      const dayTrans = transactions.filter(t => t.timestamp.startsWith(date));
      return {
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        in: dayTrans.filter(t => t.type === 'in').reduce((acc, t) => acc + t.quantity, 0),
        out: dayTrans.filter(t => t.type === 'out').reduce((acc, t) => acc + t.quantity, 0)
      };
    });
  }, [transactions]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  const handleTransaction = async (data: any) => {
    try {
      console.log('Dashboard: Committing transaction', data);
      
      const operatorName = user?.user_metadata?.full_name || user?.email || 'System';

      // 1. Record the transaction
      // THE TRIGGER IN THE DB WILL AUTOMATICALLY UPDATE stock_quantity
      const { error: transError } = await supabase
        .from('transactions')
        .insert([{
          product_id: data.product_id,
          type: data.type,
          quantity: data.quantity,
          unit_cost: data.unit_cost || 0,
          user_id: user?.id,
          note: `[Operator: ${operatorName}] ${data.note || ''}`
        }]);

      if (transError) {
        console.error('Dashboard Transaction Error:', transError);
        throw new Error(transError.message);
      }

      // 2. Fetch updated product info to check critical stock
      const { data: updatedProduct, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', data.product_id)
        .single();

      if (!productError && updatedProduct) {
        // Telegram notification for critical/empty stock level
        if (updatedProduct.stock_quantity <= updatedProduct.min_stock) {
          const notificationMessage = formatStockAlert(
            updatedProduct.name,
            updatedProduct.stock_quantity,
            updatedProduct.category,
            updatedProduct.min_stock
          );
          sendTelegramNotification(notificationMessage).then(success => {
            if (!success) {
              toast.error('Telegram Error', {
                description: 'Gagal mengirim notifikasi ke bot. Periksa konfigurasi API Token Anda.'
              });
            }
          });
        }

        if (updatedProduct.stock_quantity <= updatedProduct.min_stock) {
          toast.error(`Critical Stock: ${updatedProduct.name}`, {
            description: `Stock level fell to ${updatedProduct.stock_quantity}. threshold: ${updatedProduct.min_stock}`,
            duration: 5000,
          });
        } else {
          toast.success(`Stock Updated: ${updatedProduct.name}`, {
            description: `Successfully recorded ${data.type === 'in' ? 'receipt' : 'withdrawal'} of ${data.quantity} units.`,
          });
        }
      }

      // If it's an 'in' transaction, update the product's unit_cost
      if (data.type === 'in' && data.unit_cost > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ unit_cost: data.unit_cost })
          .eq('id', data.product_id);
        
        if (updateError) console.warn('Unit cost sync failed:', updateError);
      }

      await fetchDashboardData();
    } catch (err) {
      console.error('Dashboard Transaction Exception:', err);
      alert('Transaction failed: ' + (err as Error).message);
    }
  };

  const handleCreateProduct = async (data: any) => {
    try {
      console.log('Dashboard: Registering SKU', data);
      
      const operatorName = user?.user_metadata?.full_name || user?.email || 'System';

      // Step 1: Create the product with 0 stock
      // We set stock_quantity to 0 because the transaction trigger will update it
      const { data: newProduct, error: productsError } = await supabase
        .from('products')
        .insert([{
          name: data.name.trim(),
          category: data.category.trim(),
          stock_quantity: 0,
          min_stock: data.min_stock || 0,
          unit_cost: data.unit_cost || 0
        }])
        .select()
        .single();

      if (productsError) {
        console.error('Dashboard Product Create Error:', productsError);
        throw new Error(productsError.message);
      }

      toast.success(`SKU Registered: ${data.name.trim()}`, {
        description: 'New product added to inventory mesh.',
      });

      // Step 2: Record the initial balance as a transaction
      if (data.stock_quantity > 0 && newProduct) {
        const { error: transError } = await supabase
          .from('transactions')
          .insert([{
            product_id: newProduct.id,
            type: 'in',
            quantity: data.stock_quantity,
            unit_cost: data.unit_cost || 0,
            user_id: user?.id,
            note: `[Operator: ${operatorName}] Initial Inventory Load`
          }]);
        
        if (transError) {
          console.error('Dashboard Initial Transaction Error:', transError);
          alert('SKU created, but initial balance load failed: ' + transError.message);
        }
      }

      await fetchDashboardData();
    } catch (err) {
      console.error('Dashboard Product Registration Exception:', err);
      alert('Product registration failed: ' + (err as Error).message);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!isAdmin) {
      toast.error('Akses Ditolak', {
        description: 'Hanya administrator yang memiliki wewenang untuk menghapus produk.',
      });
      return;
    }
    try {
      // First delete associated transactions
      const { error: transError } = await supabase
        .from('transactions')
        .delete()
        .eq('product_id', id);
      
      if (transError) throw transError;

      // Then delete the product
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setProducts(products.filter(p => p.id !== id));
      toast.success('Asset Purged', {
        description: 'Product and associated transaction history removed from mesh.',
      });
      await fetchDashboardData(); // Refresh chart/stats
    } catch (err) {
      alert('Delete failed: ' + (err as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-500/20" />
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] animate-pulse">Syncing with Mesh...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 relative">
      {/* Background Decor */}
      <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Overview Stats */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
            <div>
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.3em]">{t.dashboard.operationalMetrics}</h2>
                <div className="h-1 w-12 bg-indigo-500 rounded-full mt-2" />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={() => setIsProductModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-3 sm:px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all active:scale-95"
              >
                <Plus size={14} />
                <span className="hidden xs:inline">{t.common.registerSku.toUpperCase()}</span>
                <span className="xs:hidden">{t.common.initiateItem}</span>
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-3 sm:px-5 py-2.5 rounded-xl transition-all shadow-xl shadow-indigo-900/30 active:scale-95"
              >
                <Plus size={14} />
                <span className="hidden xs:inline">{t.common.stockUpdate.toUpperCase()}</span>
                <span className="xs:hidden">{t.common.updateItem}</span>
              </button>
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard 
            title={t.dashboard.totalSku} 
            value={totals.skuCount} 
            icon={Layers} 
            color="bg-indigo-500"
            trend={{ value: '12.4%', isUp: true }}
          />
          <Link href="/inventory/low-stock" className="block cursor-pointer">
            <StatCard 
              title={t.dashboard.lowStock} 
              value={totals.lowStockCount} 
              icon={AlertCircle} 
              color="bg-rose-500"
              trend={{ value: '8.1%', isUp: false }}
            />
          </Link>
          <StatCard 
            title={t.dashboard.assetValue} 
            value={totals.totalValue} 
            icon={DollarSign} 
            color="bg-emerald-500"
            trend={{ value: '4.2%', isUp: true }}
          />
          <StatCard 
            title={t.dashboard.monthlyOut} 
            value={totals.monthlyOutflow} 
            icon={Truck} 
            color="bg-amber-500"
            trend={{ value: 'Usage Log', isUp: true }}
          />
        </div>
      </section>

      {/* Movements Section */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-2">
                <div>
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.3em]">{t.dashboard.logisticsThroughput}</h2>
                    <div className="h-1 w-12 bg-indigo-500 rounded-full mt-2" />
                </div>
            </div>
            <MovementChart data={movementData} />
        </div>

        <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
                <div>
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.3em]">{t.dashboard.withdrawalLog}</h2>
                    <div className="h-1 w-12 bg-amber-500 rounded-full mt-2" />
                </div>
                <button 
                  onClick={downloadWithdrawalReport}
                  className="text-[10px] font-black text-amber-500 hover:text-amber-400 uppercase tracking-widest flex items-center gap-1.5 bg-amber-500/5 px-2 py-1 rounded-md border border-amber-500/10 transition-all hover:scale-105 active:scale-95"
                  title="Download CSV summary"
                >
                  <ArrowUpRight size={14} />
                  {t.common.exportSummary.toUpperCase()}
                </button>
            </div>
            <div className="bg-[#111114]/50 backdrop-blur-sm p-6 rounded-3xl border border-white/5 h-[400px] flex flex-col">
                <div className="overflow-y-auto flex-1 pr-2 space-y-4 custom-scrollbar">
                    {itemizedWithdrawal.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6">
                            <TrendingUp size={32} className="text-slate-800 mb-2" />
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">No withdrawal data detected for this cycle</p>
                        </div>
                    ) : (
                        itemizedWithdrawal.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white truncate max-w-[120px]">{item.name}</span>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Withdrawal Volume</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-mono font-black text-amber-400">
                                        {item.quantity} Units
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Period Outflow</span>
                    <span className="text-lg font-mono font-black text-white">{totals.monthlyOutflow}</span>
                </div>
            </div>
        </div>
      </section>

      {/* Main Inventory Section */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 px-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t.dashboard.inventoryMesh}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live Sync</span>
                </div>
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest hidden xs:inline">•</span>
                {currentTime && (
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Scan: {currentTime}</p>
                )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <div className="relative group flex-1 md:flex-none">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    <Filter size={14} />
                </div>
                <input 
                    type="text" 
                    placeholder={t.common.search}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-slate-300 px-4 pl-10 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full md:w-48"
                />
            </div>
            <div className="hidden sm:block h-6 w-[1px] bg-slate-800 mx-1" />
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                <button 
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'table' ? 'bg-slate-800 text-white shadow-inner' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  {t.common.table.toUpperCase()}
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'grid' ? 'bg-slate-800 text-white shadow-inner' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  {t.common.grid.toUpperCase()}
                </button>
            </div>
          </div>
        </div>
        
        <InventoryTable 
          products={filteredProducts} 
          onDelete={handleDeleteProduct}
          viewMode={viewMode}
        />
      </section>
      
      <StockModal 
        products={products}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleTransaction}
      />

      <ProductModal 
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSubmit={handleCreateProduct}
      />

      {/* Quick Actions Footer Card */}
      <footer className="mt-12 py-10 border-t border-white/5">
        <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em]">Mesh Infrastructure</span>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            </div>
            <p className="text-sm font-bold text-slate-400 tracking-tight">
                {t.common.createdBy} <span className="text-white">Candra</span>
            </p>
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                Obsidian v2.4.0 • Logistix Mesh Control
            </p>
        </div>
      </footer>
    </div>
  );
}
