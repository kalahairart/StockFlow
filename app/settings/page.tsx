'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Settings, Shield, Database, Cloud, Bell, User, HardDrive, Bot, Link2, Send, Terminal, Key, ShieldCheck, Check, Lock, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const [isLinking, setIsLinking] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [setupResult, setSetupResult] = useState<{ success: boolean; message: string; webhook_url?: string } | null>(null);

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-20">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verifying Authority...</p>
      </div>
    );
  }

  // Guard Clause for unauthorized roles
  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto text-center py-20">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl mb-6">
          <Lock size={32} />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2">Akses Ditolak / Access Denied</h1>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Halaman ini hanya dapat diakses oleh Administrator Sistem. Modul Anda tidak memiliki otoritas tingkat tinggi yang diperlukan.
        </p>
        <Link 
          href="/"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/40 uppercase tracking-widest flex items-center gap-2"
        >
          <ArrowLeft size={14} />
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const handleLinkWebhook = async () => {
    setIsLinking(true);
    setSetupResult(null);
    try {
      const res = await fetch('/api/telegram/setup');
      const data = await res.json();
      
      setSetupResult({
        success: data.success,
        message: data.message,
        webhook_url: data.webhook_url
      });

      if (data.success) {
        toast.success(
          language === 'id' 
            ? 'Webhook Telegram berhasil terhubung!' 
            : 'Telegram webhook connected successfully!'
        );
      } else {
        toast.error(data.message || 'Gagal menghubungkan webhook.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(
        language === 'id' 
          ? 'Gagal memproses permintaan hubungkan.' 
          : 'Failed to process connection trigger.'
      );
    } finally {
      setIsLinking(false);
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: language === 'id'
            ? '🔔 <b>UJI NOTIFIKASI STOCKFLOW</b>\n\nHalo! Ini adalah pesan uji coba dari StockFlow Obsidian. Hubungan notifikasi Anda aktif dan berfungsi dengan sempurna.'
            : '🔔 <b>STOCKFLOW SYSTEMS TEST</b>\n\nHello! This is a verification pulse from StockFlow Obsidian. Your warning notification channel is functional.'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          language === 'id'
            ? 'Notifikasi uji coba berhasil dikirim!'
            : 'Test alarm notification sent successfully!'
        );
      } else {
        toast.error(data.error || 'Gagal mengirimkan notifikasi. Periksa Chat ID Anda.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error sending test notification pulse.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto pb-16">
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

      {/* Telegram Bot Integration Section */}
      <div className="bg-[#111114]/50 border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <Bot size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">
                {language === 'id' ? 'Integrasi Telegram Bot' : 'Telegram Bot Integration'}
              </h3>
              <p className="text-sm text-slate-500">
                {language === 'id' 
                  ? 'Kueri stok, saring barang kosong, dan terima alarm langsung di Telegram.' 
                  : 'Query stocks, locate depleted units, and receive notification logs instantly.'}
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded shrink-0 select-none ${
            setupResult?.success 
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
              : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
          }`}>
            {setupResult?.success 
              ? (language === 'id' ? 'AKTIF' : 'ACTIVE') 
              : (language === 'id' ? 'SIAP' : 'READY')}
          </span>
        </div>

        {/* Setup Steps and Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {language === 'id' ? 'Panduan Langkah Hubungan:' : 'Setup Instructions:'}
            </h4>
            <div className="space-y-4">
              <StepItem 
                number="1" 
                text={language === 'id' 
                  ? "Buka @BotFather di aplikasi Telegram dan ketik /newbot untuk membuat bot baru serta dapatkan 'Bot Token'." 
                  : "Open @BotFather on Telegram and send /newbot to construct your bot and obtain an API 'Bot Token'."} 
              />
              <StepItem 
                number="2" 
                text={language === 'id' 
                  ? "Atur variabel lingkungan TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID pada panel konfigurasi server AI Studio Anda." 
                  : "Configure server-side environment variables TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in your AI Studio panel."} 
              />
              <StepItem 
                number="3" 
                text={language === 'id' 
                  ? "Klik tombol 'Tautkan Webhook Otomatis' di bawah untuk mendaftarkan URL aplikasi ini ke server Telegram." 
                  : "Click the 'Establish Linked Webhook' button below to register this runtime instance URL to Telegram servers."} 
              />
            </div>

            <div className="pt-4 flex flex-wrap gap-3">
              <button
                onClick={handleLinkWebhook}
                disabled={isLinking}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-2xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                {isLinking ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Link2 size={14} />
                )}
                <span>
                  {language === 'id' ? 'Tautkan Webhook Otomatis' : 'Establish Linked Webhook'}
                </span>
              </button>

              <button
                onClick={handleTestNotification}
                disabled={isTesting}
                className="px-5 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 text-slate-300 text-xs font-bold rounded-2xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                {isTesting ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                <span>
                  {language === 'id' ? 'Uji Kirim Notifikasi' : 'Send Test Notification'}
                </span>
              </button>
            </div>

            {setupResult && (
              <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1.5 ${
                setupResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/25 text-red-400'
              }`}>
                <p className="font-bold uppercase tracking-wider">
                  {setupResult.success ? '✓ Webhook Linked' : '✗ Linked Failed'}
                </p>
                <p>{setupResult.message}</p>
                {setupResult.webhook_url && (
                  <p className="font-mono mt-1 text-[10px] break-all select-all select-none">
                    URL API: {setupResult.webhook_url}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-1 border-l border-white/5 hidden lg:block" />

          {/* Supported commands directory */}
          <div className="lg:col-span-4 bg-slate-950/40 p-5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center gap-2 text-indigo-400">
              <Terminal size={14} />
              <h4 className="text-xs font-bold uppercase tracking-widest">
                {language === 'id' ? 'Referensi Perintah Bot' : 'Bot Command Registry'}
              </h4>
            </div>
            
            <div className="divide-y divide-white/5 text-xs">
              <CommandRow cmd="/stok" desc={language === 'id' ? 'Menampilkan ringkasan status inventaris & aset.' : 'Query total inventory status & asset value.'} />
              <CommandRow cmd="/kosong" desc={language === 'id' ? 'Daftar produk yang habis total (Stok = 0).' : 'List products with zero stock level remaining.'} />
              <CommandRow cmd="/tipis" desc={language === 'id' ? 'Daftar produk di bawah batas stok minimum.' : 'List items resting below safety limits.'} />
              <CommandRow cmd="/cari [nama]" desc={language === 'id' ? 'Mencari item produk dengan kata kunci.' : 'Locate unique goods by full or partial label.'} />
              <CommandRow cmd="/laundry" desc={language === 'id' ? 'Laporan detail operasi laundry linen/pakaian.' : 'Overview of current processed laundry items.'} />
              <CommandRow cmd="/myid" desc={language === 'id' ? 'Mengetahui Chat ID Telegram Anda sendiri.' : 'Print your telegram unique chat connection id.'} />
            </div>
          </div>
        </div>
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

function StepItem({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-5 h-5 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 select-none">
        {number}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed font-semibold">{text}</p>
    </div>
  );
}

function CommandRow({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <div className="py-2.5 space-y-1">
      <div className="font-mono text-[11px] font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-950 w-max px-1.5 py-0.5 rounded">
        {cmd}
      </div>
      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{desc}</p>
    </div>
  );
}
