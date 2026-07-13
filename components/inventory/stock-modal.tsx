'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/hooks/use-language';
import { X, ArrowUpCircle, ArrowDownCircle, Package, Info } from 'lucide-react';
import { Product } from '@/types/inventory';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const transactionSchema = z.object({
  product_id: z.string().min(1, 'Please select a product'),
  type: z.enum(['in', 'out']),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_cost: z.number().min(0, 'Cost cannot be negative').optional(),
  note: z.string().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface StockModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionFormValues) => Promise<void>;
}

export default function StockModal({ products, isOpen, onClose, onSubmit }: StockModalProps) {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, watch, reset, setValue } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'in',
      unit_cost: 0,
    }
  });

  const transactionType = watch('type');
  const selectedProductId = watch('product_id');

  // Auto-fill cost from current product cost
  useEffect(() => {
    if (selectedProductId) {
      const product = products.find(p => p.id === selectedProductId);
      if (product) {
        setValue('unit_cost', product.unit_cost || 0);
      }
    }
  }, [selectedProductId, products, setValue]);

  const handleFormSubmit = async (data: TransactionFormValues) => {
    setIsLoading(true);
    try {
      await onSubmit(data);
      reset();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-lg bg-[#0F0F12] rounded-[2rem] shadow-2xl z-[101] overflow-y-auto max-h-[90vh] border border-white/5"
          >
            <div className="relative p-6 sm:p-10">
              <button 
                onClick={onClose}
                className="absolute right-4 top-4 sm:right-8 sm:top-8 p-2 text-slate-500 hover:text-white rounded-xl hover:bg-white/5 transition-all"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-4 sm:gap-5 mb-8 sm:mb-10">
                <div className={`p-3 sm:p-4 rounded-2xl ${transactionType === 'in' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400'} border border-white/5`}>
                  {transactionType === 'in' ? <ArrowUpCircle size={24} className="sm:w-8 sm:h-8" /> : <ArrowDownCircle size={24} className="sm:w-8 sm:h-8" />}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t.common.stockUpdate}</h2>
                  <p className="text-slate-500 text-[9px] sm:text-xs font-bold uppercase tracking-widest mt-1">Inventory Mesh Update</p>
                </div>
              </div>

              <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 sm:space-y-8">
                {/* Type Selection */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <label className="relative cursor-pointer group">
                    <input 
                      type="radio" 
                      {...register('type')} 
                      value="in" 
                      className="sr-only"
                    />
                    <div className={`flex items-center justify-center gap-2 p-3 sm:p-4 rounded-2xl border-2 transition-all ${
                      transactionType === 'in' 
                        ? 'border-indigo-600 bg-indigo-600/10 text-indigo-100 shadow-lg shadow-indigo-900/20' 
                        : 'border-white/5 bg-white/5 text-slate-500 hover:border-white/10'
                    }`}>
                      <ArrowUpCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                      <span className="font-bold text-xs sm:text-sm tracking-tight">{t.common.stockIn}</span>
                    </div>
                  </label>
                  <label className="relative cursor-pointer group">
                    <input 
                      type="radio" 
                      {...register('type')} 
                      value="out" 
                      className="sr-only"
                    />
                    <div className={`flex items-center justify-center gap-2 p-3 sm:p-4 rounded-2xl border-2 transition-all ${
                      transactionType === 'out' 
                        ? 'border-rose-600 bg-rose-600/10 text-rose-100 shadow-lg shadow-rose-900/20' 
                        : 'border-white/5 bg-white/5 text-slate-500 hover:border-white/10'
                    }`}>
                      <ArrowDownCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                      <span className="font-bold text-xs sm:text-sm tracking-tight">{t.common.stockOut}</span>
                    </div>
                  </label>
                </div>

                {/* Product Selection */}
                <div className="space-y-2 sm:space-y-3">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">{t.common.identifier}</label>
                  <div className="relative">
                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <select
                      {...register('product_id')}
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-10 py-3 sm:py-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer hover:border-white/10 transition-colors shadow-inner"
                    >
                      <option value="">{t.common.selectSku}</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} className="bg-slate-900">{p.name} [{p.stock_quantity}]</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                  {errors.product_id && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight ml-1">{errors.product_id.message}</p>}
                </div>

                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                    {/* Quantity */}
                    <div className="xs:col-span-1 space-y-2 sm:space-y-3">
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">{t.common.units}</label>
                        <input
                            type="number"
                            {...register('quantity', { valueAsNumber: true })}
                            className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-3 sm:py-4 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                            placeholder="0"
                        />
                        {errors.quantity && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight ml-1">Req.</p>}
                    </div>

                    {/* Unit Cost - Only for 'in' transactions */}
                    {transactionType === 'in' && (
                      <div className="xs:col-span-1 space-y-2 sm:space-y-3">
                          <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">{t.common.unitCost}</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs select-none">Rp</span>
                            <input
                                type="number"
                                step="1"
                                {...register('unit_cost', { valueAsNumber: true })}
                                className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-10 pr-3 py-3 sm:py-4 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                                placeholder="0"
                            />
                          </div>
                          {errors.unit_cost && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight ml-1">Req.</p>}
                      </div>
                    )}

                    {/* Note */}
                    <div className={`${transactionType === 'in' ? 'xs:col-span-2 sm:col-span-1' : 'xs:col-span-2 sm:col-span-2'} space-y-2 sm:space-y-3`}>
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">{t.common.referenceTag}</label>
                        <div className="relative">
                            <Info className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                {...register('note')}
                                className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-5 py-3 sm:py-4 text-sm text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                                placeholder="Ref #..."
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="order-2 sm:order-1 flex-1 px-6 py-3 sm:py-4 rounded-2xl font-bold text-slate-500 hover:text-white hover:bg-white/5 transition-all text-xs sm:text-sm uppercase tracking-widest"
                  >
                    {t.common.abort}
                  </button>
                  <button
                    disabled={isLoading}
                    className={`order-1 sm:order-2 flex-1 px-6 py-3 sm:py-4 rounded-2xl font-bold text-white shadow-2xl transition-all text-xs sm:text-sm uppercase tracking-widest ${
                      transactionType === 'in' 
                        ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40' 
                        : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40'
                    } disabled:opacity-50 active:scale-95`}
                  >
                    {isLoading ? t.common.syncing.toUpperCase() : t.common.confirmOps.toUpperCase()}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
