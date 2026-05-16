'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Package, Tag, Hash, AlertCircle, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/hooks/use-language';

const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  category: z.string().min(2, 'Category must be at least 2 characters'),
  stock_quantity: z.number().min(0, 'Quantity cannot be negative'),
  min_stock: z.number().min(0, 'Minimum stock cannot be negative'),
  unit_cost: z.number().min(0, 'Unit cost cannot be negative'),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => Promise<void>;
  initialData?: Partial<ProductFormData>;
  title?: string;
}

export default function ProductModal({ isOpen, onClose, onSubmit, initialData, title }: ProductModalProps) {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData || {
      stock_quantity: 0,
      min_stock: 10,
      unit_cost: 0,
    }
  });

  // Re-sync form with initialData when it changes or modal opens
  useEffect(() => {
    if (isOpen) {
      reset(initialData || {
        name: '',
        category: '',
        stock_quantity: 0,
        min_stock: 10,
        unit_cost: 0,
      });
    }
  }, [isOpen, initialData, reset]);

  const handleFormSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    try {
      await onSubmit(data);
      reset();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
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
                <div className="p-3 sm:p-4 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-white/5">
                  <Package size={24} className="sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{title || t.common.registerSku}</h2>
                  <p className="text-slate-500 text-[9px] sm:text-xs font-bold uppercase tracking-widest mt-1">System Asset Onboarding</p>
                </div>
              </div>

              <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 sm:space-y-8">
                <div className="space-y-4 sm:space-y-6">
                  {/* Name */}
                  <div className="space-y-2 sm:space-y-3">
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">{t.common.productDescriptor}</label>
                    <div className="relative">
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        {...register('name')}
                        className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-5 py-3 sm:py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                        placeholder="Glass Cleaner..."
                      />
                    </div>
                    {errors.name && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight ml-1">{errors.name.message}</p>}
                  </div>

                  {/* Category */}
                  <div className="space-y-2 sm:space-y-3">
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">{t.common.itemCategory}</label>
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        {...register('category')}
                        className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-5 py-3 sm:py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                        placeholder="item category"
                      />
                    </div>
                    {errors.category && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight ml-1">{errors.category.message}</p>}
                  </div>

                  {/* Initial Balance */}
                  <div className="space-y-2 sm:space-y-3">
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">{t.common.initialBalance}</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        type="number"
                        {...register('stock_quantity', { valueAsNumber: true })}
                        className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-5 py-3 sm:py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                        placeholder="0"
                      />
                    </div>
                    {errors.stock_quantity && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight ml-1">{errors.stock_quantity.message}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {/* Unit Cost */}
                    <div className="space-y-2 sm:space-y-3">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">{t.common.acquisitionCost}</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                          type="number"
                          step="0.01"
                          {...register('unit_cost', { valueAsNumber: true })}
                          className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-5 py-3 sm:py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                          placeholder="0.00"
                        />
                      </div>
                      {errors.unit_cost && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight ml-1">{errors.unit_cost.message}</p>}
                    </div>

                    {/* Min Stock */}
                    <div className="space-y-2 sm:space-y-3">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">{t.common.warnThreshold}</label>
                      <div className="relative">
                        <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                          type="number"
                          {...register('min_stock', { valueAsNumber: true })}
                          className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-5 py-3 sm:py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
                          placeholder="10"
                        />
                      </div>
                      {errors.min_stock && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight ml-1">{errors.min_stock.message}</p>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="order-2 sm:order-1 flex-1 px-6 py-3 sm:py-4 rounded-2xl font-bold text-slate-500 hover:text-white hover:bg-white/5 transition-all text-xs sm:text-sm uppercase tracking-widest"
                  >
                    {t.common.discard}
                  </button>
                  <button
                    disabled={isLoading}
                    className="order-1 sm:order-2 flex-1 px-6 py-3 sm:py-4 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-2xl shadow-indigo-900/40 transition-all text-xs sm:text-sm uppercase tracking-widest disabled:opacity-50 active:scale-95"
                  >
                    {isLoading ? t.common.syncing.toUpperCase() : title ? t.common.updateItem.toUpperCase() : t.common.initiateItem.toUpperCase()}
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
