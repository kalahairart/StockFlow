'use client';

import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  trend?: {
    value: string;
    isUp: boolean;
  };
}

export default function StatCard({ title, value, icon: Icon, color, trend }: StatCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.01 }}
      className="bg-[#111114]/80 backdrop-blur-xl border border-white/5 p-5 sm:p-7 rounded-3xl transition-all hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/10 group"
    >
      <div className="flex justify-between items-start mb-4 sm:mb-6">
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">{title}</p>
          <p className="text-2xl sm:text-4xl font-bold text-white tracking-tight flex items-baseline gap-2">
            {value}
          </p>
        </div>
        <div className={`p-3 sm:p-4 rounded-2xl bg-opacity-10 ${color} border border-white/5 shadow-inner`}>
          <Icon className={`${color.replace('bg-', 'text-')} opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300`} size={20} />
        </div>
      </div>
      
      {trend && (
        <div className={`flex items-center gap-2 text-xs font-bold ${trend.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
          <div className={`p-1 rounded-md ${trend.isUp ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
            {trend.isUp ? '↑' : '↓'}
          </div>
          <span className="tracking-tight">{trend.value}</span>
          <span className="text-slate-600 font-medium tracking-normal ml-0.5">than last period</span>
        </div>
      )}
    </motion.div>
  );
}
