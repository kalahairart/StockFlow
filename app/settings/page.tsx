'use client';

import { Settings, Shield, Database, Cloud, Bell, User, HardDrive } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

export default function SettingsPage() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">Module 09 / Core Engine</span>
            <div className="h-1 w-1 bg-slate-700 rounded-full" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Operational Config</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t.settings.title}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ConfigCard 
            icon={Shield} 
            title={t.settings.accessProtocols} 
            description={t.settings.accessDesc}
            status="Secured"
        />
        <ConfigCard 
            icon={Database} 
            title={t.settings.storageEngine} 
            description={t.settings.storageDesc}
            status="Optimal"
        />
        <ConfigCard 
            icon={HardDrive} 
            title={t.settings.resourceLimits} 
            description={t.settings.resourceDesc}
            status="Active"
        />
        <ConfigCard 
            icon={Bell} 
            title={t.settings.notificationHub} 
            description={t.settings.notificationDesc}
            status="Enabled"
        />
      </div>

      <div className="bg-[#111114]/50 border border-white/5 rounded-3xl p-8 space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="font-bold text-white">{t.settings.advancedDiagnostics}</h3>
                <p className="text-sm text-slate-500">{t.settings.diagnosticsDesc}</p>
            </div>
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all">
                {t.settings.runAudit}
            </button>
        </div>
      </div>
    </div>
  );
}

function ConfigCard({ icon: Icon, title, description, status }: { icon: any, title: string, description: string, status: string }) {
    return (
        <div className="bg-[#111114]/50 backdrop-blur-sm border border-white/5 p-8 rounded-3xl hover:border-indigo-500/20 transition-all group">
            <div className="flex items-start justify-between mb-6">
                <div className="p-3 bg-slate-900 rounded-2xl border border-white/5 text-slate-500 group-hover:text-indigo-400 transition-colors">
                    <Icon size={24} />
                </div>
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded">
                    {status}
                </span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight mb-2">{title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
    );
}
