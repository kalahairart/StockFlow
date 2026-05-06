'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MovementData } from '@/types/inventory';
import { motion } from 'motion/react';

interface MovementChartProps {
  data: MovementData[];
}

export default function MovementChart({ data }: MovementChartProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#111114]/50 backdrop-blur-sm border border-white/5 rounded-3xl p-5 sm:p-8 h-[350px] sm:h-[400px] flex flex-col"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">Vols. Throughput</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">7-Day Transaction Mesh</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-slate-400 font-bold uppercase">In</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[10px] text-slate-400 font-bold uppercase">Out</span>
            </div>
        </div>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" opacity={0.3} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{ 
                backgroundColor: '#0F0F12', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px',
                padding: '12px'
              }}
              itemStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}
            />
            <Bar dataKey="in" fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="out" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
