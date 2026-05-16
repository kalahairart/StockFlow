'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Filter, RefreshCw, Box, AlertTriangle, Package } from 'lucide-react';
import InventoryTable from '@/components/inventory/inventory-table';
import StockModal from '@/components/inventory/stock-modal';
import ProductModal from '@/components/inventory/product-modal';
import { Product } from '@/types/inventory';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { sendTelegramNotification, formatStockAlert } from '@/lib/notifications';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/use-language';

export default function InventoryPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return ['all', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  const handleCreateProduct = async (data: any) => {
    try {
      console.log('Initiating product registration:', data);
      
      const operatorName = user?.user_metadata?.full_name || user?.email || 'System';

      // Step 1: Create the product with 0 stock
      const { data: newProduct, error } = await supabase
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

      if (error) {
        console.error('Supabase Product Insert Error:', error);
        throw new Error(error.message);
      }
      
      if (!newProduct) {
        throw new Error('Product created but no data returned from mesh.');
      }

      toast.success(`Asset Registered: ${data.name.trim()}`, {
        description: 'New SKU successfully added to terminal mapping.',
      });

      console.log('Product registered successfully:', newProduct);

      // Step 2: Record the initial balance as a transaction
      if (data.stock_quantity > 0) {
        console.log('Recording initial balance transaction:', data.stock_quantity);
        const { error: transError } = await supabase.from('transactions').insert([{
            product_id: newProduct.id,
            type: 'in',
            quantity: data.quantity || data.stock_quantity,
            unit_cost: data.unit_cost || 0,
            user_id: user?.id,
            note: `[Operator: ${operatorName}] Initial Balance Load`
        }]);

        if (transError) {
          console.error('Initial Transaction Error:', transError);
          // We don't throw here to avoid user confusion since product IS created
          alert('Asset registered, but initial balance transaction failed: ' + transError.message);
        }
      }
      
      await fetchInventory();
    } catch (err) {
      console.error('Complete handleCreateProduct Error:', err);
      alert('Failed to register SKU: ' + (err as Error).message);
    }
  };

  const handleStockAction = async (data: any) => {
    try {
      console.log('Executing stock commit:', data);
      
      const operatorName = user?.user_metadata?.full_name || user?.email || 'System';

      // 1. Record the transaction in history
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
        console.error('Transaction Insert Error:', transError);
        throw new Error(transError.message);
      }

      // 2. Fetch updated product to check critical stock
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
          sendTelegramNotification(notificationMessage);
        }

        if (updatedProduct.stock_quantity <= updatedProduct.min_stock) {
           toast.error(`Critical Stock: ${updatedProduct.name}`, {
             description: `Stock level fell to ${updatedProduct.stock_quantity}. threshold: ${updatedProduct.min_stock}`,
             duration: 5000,
           });
        } else {
           toast.success(`Mesh Update Complete: ${updatedProduct.name}`, {
             description: `${data.type.toUpperCase()} transaction logged for ${data.quantity} units.`,
           });
        }
      }

      // If it's an 'in' transaction, update the product's unit_cost
      if (data.type === 'in' && data.unit_cost > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ unit_cost: data.unit_cost })
          .eq('id', data.product_id);
        
        if (updateError) {
          console.warn('Unit cost update failed, but transaction was recorded:', updateError);
        }
      }

      await fetchInventory();
    } catch (err) {
      console.error('Complete handleStockAction Error:', err);
      alert('Stock Update Failed: ' + (err as Error).message);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await supabase.from('transactions').delete().eq('product_id', id);
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast.success('Asset Deleted', {
        description: 'Product record has been successfully purged from inventory.',
      });
      await fetchInventory();
    } catch (err) {
      alert('Deletion failed: ' + (err as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[9px] sm:text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">Module 02 / Asset Control</span>
            <div className="h-1 w-1 bg-slate-700 rounded-full" />
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">{products.length} Units Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{t.inventory.title}</h1>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={fetchInventory}
            className="p-2 sm:p-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all hover:bg-slate-800 shrink-0"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setIsProductModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 text-[10px] sm:text-xs font-bold px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus size={16} />
            <span className="hidden xs:inline">{t.common.registerSku.toUpperCase()}</span>
            <span className="xs:hidden">{t.common.initiateItem}</span>
          </button>
          <button 
            onClick={() => setIsStockModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-xs font-bold px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl transition-all shadow-xl shadow-indigo-900/40 active:scale-95 whitespace-nowrap"
          >
            <Plus size={16} />
            <span className="hidden xs:inline">{t.common.stockUpdate.toUpperCase()}</span>
            <span className="xs:hidden">{t.common.updateItem}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-4 bg-[#111114]/50 backdrop-blur-sm p-4 rounded-3xl border border-white/5">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder={t.common.search}
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
                    <option key={cat} value={cat}>{cat}</option>
                ))}
            </select>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/5 shrink-0">
            <button 
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
            >
                {t.inventory.table.toUpperCase()}
            </button>
            <button 
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
            >
                {t.inventory.grid.toUpperCase()}
            </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-[600px] flex flex-col">
        {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Querying Inventory Mesh...</p>
            </div>
        ) : filteredProducts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-[#111114]/30 rounded-3xl border border-dashed border-white/5">
                <Package size={48} className="text-slate-700 mb-4" />
                <h3 className="text-xl font-bold text-slate-300">{t.inventory.noProducts}</h3>
                <p className="text-slate-500 text-sm mt-2 max-w-sm">{t.inventory.noResultsDesc}</p>
                <button 
                  onClick={() => {setSearchQuery(''); setCategoryFilter('all');}}
                  className="mt-6 text-indigo-400 text-xs font-bold uppercase tracking-widest hover:text-indigo-300 bg-indigo-500/5 px-4 py-2 rounded-lg"
                >
                  {t.common.clearFilters}
                </button>
            </div>
        ) : (
            <InventoryTable 
                products={filteredProducts} 
                onDelete={handleDeleteProduct}
                viewMode={viewMode}
            />
        )}
      </div>

      {/* Modals */}
      <ProductModal 
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSubmit={handleCreateProduct}
      />

      <StockModal 
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        products={products}
        onSubmit={handleStockAction}
      />
    </div>
  );
}
