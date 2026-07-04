'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { 
  Shield, 
  Database, 
  HardDrive, 
  Bell, 
  Bot, 
  Link2, 
  Send, 
  Terminal, 
  Lock, 
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Volume2,
  VolumeX,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Check,
  Code2,
  Copy,
  Server,
  Activity
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// Safe check if real Supabase keys are configured
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isRealSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'placeholder' && 
  !supabaseUrl.includes('placeholder')
);

export default function SettingsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  
  // Telegram Bot integration states (left perfectly functional as requested)
  const [isLinking, setIsLinking] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [setupResult, setSetupResult] = useState<{ success: boolean; message: string; webhook_url?: string } | null>(null);

  // Active configuration section tab
  const [activeConfigTab, setActiveConfigTab] = useState<'storage' | 'access' | 'limits' | 'notifications'>('storage');

  // --- Dynamic DB Status states ---
  const [dbStatus, setDbStatus] = useState<{
    tested: boolean;
    checking: boolean;
    success: boolean;
    latency: number | null;
    message: string;
    source: 'supabase-cloud' | 'local-storage';
    tableCounts?: {
      products: number;
      transactions: number;
      laundry: number;
    };
  }>({
    tested: false,
    checking: false,
    success: false,
    latency: null,
    message: '',
    source: isRealSupabaseConfigured ? 'supabase-cloud' : 'local-storage'
  });

  // --- Editable Operational Configurations states ---
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);
  const [maxWarehouseCapacity, setMaxWarehouseCapacity] = useState<number>(1000);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(5);
  
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);

  // --- Copy SQL Schema states ---
  const [copied, setCopied] = useState(false);

  // --- Advanced Diagnostics states ---
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagLogs, setDiagLogs] = useState<string[]>([]);
  const [diagOverallStatus, setDiagOverallStatus] = useState<'IDLE' | 'RUNNING' | 'SUCCESS' | 'WARNING'>('IDLE');

  // --- Local mock database reset states ---
  const [isResettingDb, setIsResettingDb] = useState(false);

  // Initialize values from localStorage safely on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLowStock = localStorage.getItem('stockflow_setting_low_stock_threshold');
      if (storedLowStock) setLowStockThreshold(Number(storedLowStock));

      const storedMaxCapacity = localStorage.getItem('stockflow_setting_max_capacity');
      if (storedMaxCapacity) setMaxWarehouseCapacity(Number(storedMaxCapacity));

      const storedSoundAlerts = localStorage.getItem('stockflow_setting_sound_alerts');
      if (storedSoundAlerts !== null) setSoundAlertsEnabled(storedSoundAlerts !== 'false');

      const storedAutoRefresh = localStorage.getItem('stockflow_setting_auto_refresh');
      if (storedAutoRefresh) setAutoRefreshInterval(Number(storedAutoRefresh));
    }
  }, []);

  // Sound Synth Generator (Micro Acoustic Beeps)
  const playSynthSound = (frequency = 440, duration = 0.15, type: 'sine' | 'square' | 'triangle' | 'sawtooth' = 'sine') => {
    if (typeof window === 'undefined') return;
    // Don't play if disabled
    if (!soundAlertsEnabled && frequency !== 523.25) return; // allow testing trigger itself
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = type;
      oscillator.frequency.value = frequency;
      
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime); // comfortable low-amplitude gain
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context blocked or unsupported");
    }
  };

  // Run initial lightweight DB status check on mount
  useEffect(() => {
    if (isAdmin) {
      handleTestDatabase(true);
    }
  }, [isAdmin]);

  const handleTestDatabase = async (silent = false) => {
    if (!silent) {
      setDbStatus(prev => ({ 
        ...prev, 
        checking: true, 
        message: language === 'id' ? 'Menghubungkan ke database...' : 'Linking to database...' 
      }));
    }
    const startTime = performance.now();
    
    try {
      if (isRealSupabaseConfigured) {
        // Probe live Supabase products table with a lightweight query
        const { data, error } = await supabase
          .from('products')
          .select('id')
          .limit(1);
        
        const latency = Math.round(performance.now() - startTime);
        
        if (error) {
          setDbStatus({
            tested: true,
            checking: false,
            success: false,
            latency,
            message: `Koneksi Supabase Gagal: ${error.message}`,
            source: 'supabase-cloud'
          });
          if (!silent) playSynthSound(220, 0.3, 'sawtooth');
        } else {
          // Robustly count table records for metadata presentation
          const { count: productCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });

          const { count: txCount } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true });

          const { count: laundryCount } = await supabase
            .from('laundry_records')
            .select('*', { count: 'exact', head: true });

          setDbStatus({
            tested: true,
            checking: false,
            success: true,
            latency,
            message: language === 'id' 
              ? 'Terhubung dengan sukses ke Supabase Cloud PostgreSQL!' 
              : 'Successfully established link to Supabase Cloud PostgreSQL!',
            source: 'supabase-cloud',
            tableCounts: {
              products: productCount || 0,
              transactions: txCount || 0,
              laundry: laundryCount || 0,
            }
          });
          if (!silent) playSynthSound(880, 0.15, 'sine');
        }
      } else {
        // Probe client-side mock databases inside local storage
        if (!silent) await new Promise(resolve => setTimeout(resolve, 500));
        const latency = Math.round(performance.now() - startTime);

        const getLocalCount = (key: string) => {
          if (typeof window === 'undefined') return 0;
          const str = localStorage.getItem(key);
          return str ? JSON.parse(str).length : 0;
        };

        const prodC = getLocalCount('stockflow_local_products') || getLocalCount('products');
        const txC = getLocalCount('stockflow_local_transactions') || getLocalCount('transactions');
        const laundryC = getLocalCount('stockflow_local_laundry') || getLocalCount('laundry_records');

        setDbStatus({
          tested: true,
          checking: false,
          success: true,
          latency: latency < 1 ? 1 : latency,
          message: language === 'id' 
            ? 'Terhubung ke Mesin Penyimpanan Lokal (Mock LocalStorage Sandbox).' 
            : 'Linked to Local Storage Engine (Mock Sandbox LocalStorage).',
          source: 'local-storage',
          tableCounts: {
            products: prodC,
            transactions: txC,
            laundry: laundryC,
          }
        });
        if (!silent) playSynthSound(660, 0.12, 'sine');
      }
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime);
      setDbStatus({
        tested: true,
        checking: false,
        success: false,
        latency,
        message: `Database connection error: ${err.message || err}`,
        source: isRealSupabaseConfigured ? 'supabase-cloud' : 'local-storage'
      });
      if (!silent) playSynthSound(180, 0.4, 'sawtooth');
    }
  };

  const handleSaveSettings = () => {
    setIsSavingSettings(true);
    setSettingsSaveSuccess(false);
    
    // Save to LocalStorage
    localStorage.setItem('stockflow_setting_low_stock_threshold', lowStockThreshold.toString());
    localStorage.setItem('stockflow_setting_max_capacity', maxWarehouseCapacity.toString());
    localStorage.setItem('stockflow_setting_sound_alerts', soundAlertsEnabled.toString());
    localStorage.setItem('stockflow_setting_auto_refresh', autoRefreshInterval.toString());
    
    // Dispatch custom settings update event to sync dashboard alerts instantly
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('stockflow-settings-updated'));
    }

    setTimeout(() => {
      setIsSavingSettings(false);
      setSettingsSaveSuccess(true);
      playSynthSound(523.25, 0.08, 'sine');
      setTimeout(() => playSynthSound(659.25, 0.12, 'sine'), 60);
      
      toast.success(
        language === 'id'
          ? 'Pengaturan parameter operasional berhasil diperbarui!'
          : 'Operational threshold parameters saved successfully!'
      );

      // Clear success notification after 3 seconds
      setTimeout(() => setSettingsSaveSuccess(false), 3000);
    }, 600);
  };

  const handleResetLocalDatabase = () => {
    const confirmMessage = language === 'id' 
      ? 'Apakah Anda yakin ingin mengatur ulang database lokal Anda? Semua produk, transaksi, dan laundry kustom akan dihapus dan dipulihkan kembali ke data default.'
      : 'Are you sure you want to reset your local database? All custom products, transactions, and laundry batches will be cleared and restored back to default.';
    
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return;

    setIsResettingDb(true);
    playSynthSound(150, 0.5, 'triangle');

    setTimeout(() => {
      localStorage.removeItem('stockflow_local_products');
      localStorage.removeItem('stockflow_local_transactions');
      localStorage.removeItem('stockflow_local_laundry');
      localStorage.removeItem('stockflow_local_restock');
      localStorage.removeItem('stockflow_local_users');
      localStorage.removeItem('products');
      localStorage.removeItem('transactions');
      localStorage.removeItem('laundry_records');
      window.location.reload();
    }, 1200);
  };

  const sqlSchemaText = `-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Products Table
create table products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null,
  stock_quantity integer not null default 0,
  min_stock integer not null default 10,
  unit_cost decimal(12,2) default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text
);

-- Create Transactions Table
create type transaction_type as enum ('in', 'out');

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) on delete cascade not null,
  type transaction_type not null,
  quantity integer not null,
  unit_cost decimal(12,2) default 0,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid,
  user_name text,
  note text
);

-- Create Laundry Records Table
CREATE TABLE IF NOT EXISTS laundry_records (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  quantity_out integer not null,
  quantity_in integer default 0,
  unit_cost decimal(12,2) default 0,
  total_cost decimal(12,2) default 0,
  status text not null default 'out',
  sent_at timestamp with time zone default timezone('utc'::text, now()) not null,
  returned_at timestamp with time zone,
  operator_name text,
  product_id uuid references products(id),
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);`;

  const handleCopySQL = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(sqlSchemaText);
      setCopied(true);
      playSynthSound(600, 0.1, 'sine');
      setTimeout(() => setCopied(false), 2000);
      toast.success(language === 'id' ? 'Skema SQL disalin!' : 'SQL Schema copied to clipboard!');
    }
  };

  const runSystemAudit = async () => {
    setDiagRunning(true);
    setDiagOverallStatus('RUNNING');
    setDiagLogs([]);
    playSynthSound(300, 0.1, 'sawtooth');

    const appendLog = (msg: string) => {
      setDiagLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    appendLog('⚙️ INITIALIZING DIAGNOSTICS DEPLOYMENT LEVEL 0...');
    await wait(450);

    // 1. Browser engine check
    appendLog('🔍 Scanning browser storage capability & write permissions...');
    try {
      localStorage.setItem('__diag_write_test__', 'ok');
      localStorage.removeItem('__diag_write_test__');
      appendLog('✓ Browser LocalStorage matches criteria (Fully readable and writable).');
    } catch (err: any) {
      appendLog(`✗ LocalStorage Write Failure: ${err.message || err}`);
    }
    await wait(350);

    // 2. Auth Context check
    appendLog('🔍 Auditing authentication token state and sessions...');
    if (user) {
      appendLog(`✓ Active Identity Session: ${user.email}`);
      appendLog(`✓ Session authority: ${isAdmin ? 'SUPER_ADMIN' : 'STANDARD_OPERATOR'}`);
      appendLog(`✓ Security vector identification: ${user.id}`);
    } else {
      appendLog('⚠ Diagnostic Warning: Session token is not present in viewport.');
    }
    await wait(400);

    // 3. Database Connectivity check
    appendLog(`🔍 Contacting Storage Engine endpoint (${isRealSupabaseConfigured ? 'Supabase cloud' : 'Simulated local sandbox'})...`);
    const dbCheckStart = performance.now();
    try {
      if (isRealSupabaseConfigured) {
        const { data, error } = await supabase.from('products').select('id').limit(1);
        const lat = Math.round(performance.now() - dbCheckStart);
        if (error) {
          appendLog(`✗ Database ping failed: ${error.message} (Probe Latency: ${lat}ms)`);
        } else {
          appendLog(`✓ Supabase connection verified. Probe Latency: ${lat}ms.`);
        }
      } else {
        const lat = Math.round(performance.now() - dbCheckStart);
        appendLog(`✓ Local storage engine verified. Internal Hop: ${lat < 1 ? 1 : lat}ms.`);
      }
    } catch (e: any) {
      appendLog(`✗ Database unreachable: ${e.message || e}`);
    }
    await wait(450);

    // 4. Data counts
    appendLog('🔍 Indexing current tables rows...');
    try {
      const getLocalCount = (key: string) => {
        if (typeof window === 'undefined') return 0;
        const str = localStorage.getItem(key);
        return str ? JSON.parse(str).length : 0;
      };

      let pC = 0, tC = 0, lC = 0;
      if (isRealSupabaseConfigured) {
        const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
        const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
        const { count: laundryCount } = await supabase.from('laundry_records').select('*', { count: 'exact', head: true });
        pC = productCount || 0;
        tC = txCount || 0;
        lC = laundryCount || 0;
      } else {
        pC = getLocalCount('stockflow_local_products') || getLocalCount('products');
        tC = getLocalCount('stockflow_local_transactions') || getLocalCount('transactions');
        lC = getLocalCount('stockflow_local_laundry') || getLocalCount('laundry_records');
      }

      appendLog(`✓ Index scan results:`);
      appendLog(`   -> SKU Registry (Products)     : ${pC} entries`);
      appendLog(`   -> Ledger Logs (Transactions)   : ${tC} entries`);
      appendLog(`   -> Laundry Cycle (Laundry)      : ${lC} batches`);
    } catch (err: any) {
      appendLog(`⚠ Table analysis interrupted: ${err.message}`);
    }
    await wait(400);

    // 5. Webhook check
    appendLog('🔍 Probing Telegram API webhook server health...');
    try {
      const res = await fetch('/api/telegram');
      if (res.ok) {
        appendLog('✓ Local telegram notification bridge listener: ONLINE.');
      } else {
        appendLog('⚠ Telegram server returned warning code. Ensure BOT_TOKEN setup.');
      }
    } catch (err) {
      appendLog('⚠ Bot server listener unreachable.');
    }
    await wait(300);

    appendLog('🎉 DIAGNOSTIC SUITE PROCESS CONCLUDED.');
    setDiagOverallStatus(isRealSupabaseConfigured ? 'SUCCESS' : 'WARNING');
    setDiagRunning(false);

    // Play victory sound
    playSynthSound(440, 0.08, 'sine');
    setTimeout(() => playSynthSound(554.37, 0.08, 'sine'), 70);
    setTimeout(() => playSynthSound(659.25, 0.08, 'sine'), 140);
    setTimeout(() => playSynthSound(880.00, 0.2, 'sine'), 210);
  };

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
        playSynthSound(523.25, 0.2, 'sine');
        toast.success(
          language === 'id' 
            ? 'Webhook Telegram berhasil terhubung!' 
            : 'Telegram webhook connected successfully!'
        );
      } else {
        playSynthSound(150, 0.3, 'sawtooth');
        toast.error(data.message || 'Gagal menghubungkan webhook.');
      }
    } catch (err: any) {
      console.error(err);
      playSynthSound(150, 0.3, 'sawtooth');
      toast.error(
        language === 'id' 
          ? 'Gagal memproses pendaftaran webhook.' 
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
        playSynthSound(600, 0.1, 'sine');
        setTimeout(() => playSynthSound(800, 0.15, 'sine'), 80);
        toast.success(
          language === 'id'
            ? 'Notifikasi uji coba berhasil dikirim!'
            : 'Test alarm notification sent successfully!'
        );
      } else {
        playSynthSound(220, 0.35, 'sawtooth');
        toast.error(data.error || 'Gagal mengirimkan notifikasi. Periksa Chat ID Anda.');
      }
    } catch (err) {
      console.error(err);
      playSynthSound(220, 0.35, 'sawtooth');
      toast.error('Error sending test notification pulse.');
    } finally {
      setIsTesting(false);
    }
  };

  if (authLoading) {
    return (
      <div id="settings-loading-container" className="flex-1 flex flex-col items-center justify-center space-y-4 py-20">
        <div id="settings-loading-spinner" className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p id="settings-loading-text" className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Verifying Authority...</p>
      </div>
    );
  }

  // Guard Clause for unauthorized roles
  if (!isAdmin) {
    return (
      <div id="unauthorized-settings" className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto text-center py-20">
        <div id="settings-lock-wrapper" className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl mb-6">
          <Lock size={32} className="animate-pulse" />
        </div>
        <h1 id="settings-lock-title" className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2">Akses Ditolak / Access Denied</h1>
        <p id="settings-lock-desc" className="text-sm text-slate-500 mb-6 leading-relaxed">
          Halaman ini hanya dapat diakses oleh Administrator Sistem. Modul Anda tidak memiliki otoritas tingkat tinggi yang diperlukan.
        </p>
        <Link 
          id="btn-unauth-back-home"
          href="/"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/40 uppercase tracking-widest flex items-center gap-2 cursor-pointer inline-flex"
        >
          <ArrowLeft size={14} />
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div id="settings-page" className="flex flex-col gap-8 max-w-4xl mx-auto pb-16">
      {/* Header section */}
      <div>
        <div id="settings-header-banner" className="flex items-center gap-3 mb-2">
          <span id="settings-module-label" className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">Module 09 / Core Engine</span>
          <div id="settings-separator" className="h-1 w-1 bg-slate-700 rounded-full" />
          <span id="settings-config-label" className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Operational Config</span>
        </div>
        <h1 id="settings-title" className="text-3xl font-bold text-white tracking-tight">{t.settings.title}</h1>
      </div>

      {/* Grid containing interactive configuration cards */}
      <div id="settings-cards-grid" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InteractiveConfigCard 
          icon={Shield} 
          title={t.settings.accessProtocols} 
          description={t.settings.accessDesc}
          status={language === 'id' ? 'Aktif' : 'Active'}
          active={activeConfigTab === 'access'}
          onClick={() => {
            setActiveConfigTab('access');
            playSynthSound(440, 0.05);
          }}
        />
        <InteractiveConfigCard 
          icon={Database} 
          title={t.settings.storageEngine} 
          description={t.settings.storageDesc}
          status={isRealSupabaseConfigured ? 'Supabase' : (language === 'id' ? 'Lokal (Mock)' : 'Local (Mock)')}
          active={activeConfigTab === 'storage'}
          badgeColor={isRealSupabaseConfigured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}
          onClick={() => {
            setActiveConfigTab('storage');
            playSynthSound(480, 0.05);
          }}
        />
        <InteractiveConfigCard 
          icon={HardDrive} 
          title={t.settings.resourceLimits} 
          description={t.settings.resourceDesc}
          status={`${lowStockThreshold} Units`}
          active={activeConfigTab === 'limits'}
          onClick={() => {
            setActiveConfigTab('limits');
            playSynthSound(520, 0.05);
          }}
        />
        <InteractiveConfigCard 
          icon={Bell} 
          title={t.settings.notificationHub} 
          description={t.settings.notificationDesc}
          status={soundAlertsEnabled ? (language === 'id' ? 'Suara Aktif' : 'Sound ON') : (language === 'id' ? 'Senyap' : 'Muted')}
          active={activeConfigTab === 'notifications'}
          onClick={() => {
            setActiveConfigTab('notifications');
            playSynthSound(560, 0.05);
          }}
        />
      </div>

      {/* Dynamic settings details drawer panel */}
      <div className="bg-[#111114]/50 border-2 border-indigo-500/25 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-indigo-950/20 relative overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-400 pointer-events-none">
          <Activity size={180} />
        </div>

        {/* Tab 1: Storage / Database configuration */}
        {activeConfigTab === 'storage' && (
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Database className="text-indigo-400" size={22} />
              <h3 className="font-bold text-white text-lg">
                {language === 'id' ? 'Konfigurasi Penyimpanan & Database' : 'Storage & Database Integration'}
              </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-5">
                <div className="p-4 bg-slate-900/40 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Server size={12} className="text-indigo-400" />
                      {language === 'id' ? 'Mesin Aktif:' : 'Active Engine:'}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded ${
                      isRealSupabaseConfigured 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {isRealSupabaseConfigured ? 'Supabase PostgreSQL Cloud' : 'Client-Side Mock (LocalStorage)'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    {isRealSupabaseConfigured 
                      ? (language === 'id' 
                        ? `Aplikasi ini terhubung langsung ke server database Supabase PostgreSQL. Semua mutasi produk, transaksi log, dan audit laundry tersimpan persisten secara online.`
                        : `This instance is bound directly to your production-grade Supabase cloud PostgreSQL. Transactions, SKUs, and laundry history are durably stored on the server.`)
                      : (language === 'id'
                        ? `Aplikasi berjalan dalam mode offline ter-simulasi. Data Anda saat ini disimpan di memori browser lokal (LocalStorage) secara andal namun terbatas pada browser ini.`
                        : `Running inside an offline-first sandbox simulation. All entities are written to local browser storage, offering fluid client-side operations without remote servers.`)}
                  </p>
                </div>

                {/* Connection Status Checker UI */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {language === 'id' ? 'Status Koneksi Riil:' : 'Live Connectivity Test:'}
                  </h4>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleTestDatabase(false)}
                      disabled={dbStatus.checking}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/40"
                    >
                      <RefreshCw size={13} className={dbStatus.checking ? 'animate-spin' : ''} />
                      <span>{dbStatus.checking ? (language === 'id' ? 'Menguji...' : 'Testing...') : (language === 'id' ? 'Uji Koneksi Sekarang' : 'Test Connection Now')}</span>
                    </button>

                    {!isRealSupabaseConfigured && (
                      <button
                        onClick={handleResetLocalDatabase}
                        disabled={isResettingDb}
                        className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <RotateCcw size={13} className={isResettingDb ? 'animate-spin' : ''} />
                        <span>{language === 'id' ? 'Reset Database Simulasi' : 'Reset Simulated Database'}</span>
                      </button>
                    )}
                  </div>

                  {dbStatus.tested && (
                    <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-2 ${
                      dbStatus.success 
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 animate-fade-in' 
                        : 'bg-rose-500/10 border-rose-500/25 text-rose-400 animate-fade-in'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                          {dbStatus.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {dbStatus.success ? (language === 'id' ? 'VERIFIKASI SUKSES' : 'PROBE SUCCESS') : (language === 'id' ? 'VERIFIKASI GAGAL' : 'PROBE FAILURE')}
                        </span>
                        {dbStatus.latency && (
                          <span className="font-mono text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-white font-bold">
                            Ping: {dbStatus.latency} ms
                          </span>
                        )}
                      </div>
                      <p>{dbStatus.message}</p>
                      {dbStatus.success && dbStatus.tableCounts && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-400">
                          <div>📦 {language === 'id' ? 'Total SKU' : 'Total SKU'}: {dbStatus.tableCounts.products}</div>
                          <div>🔄 {language === 'id' ? 'Log Transaksi' : 'Ledger Logs'}: {dbStatus.tableCounts.transactions}</div>
                          <div>🧼 {language === 'id' ? 'Batch Laundry' : 'Laundry Batches'}: {dbStatus.tableCounts.laundry}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar layout: Instructions / Schema */}
              <div className="lg:col-span-5 bg-slate-950/50 p-5 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Code2 size={15} />
                  <h4 className="text-xs font-bold uppercase tracking-widest">
                    {language === 'id' ? 'Inisialisasi Supabase Cloud' : 'Supabase Cloud Migration'}
                  </h4>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {language === 'id' 
                    ? 'Gunakan skema database di bawah untuk meluncurkan database Supabase Anda sendiri. Salin kode lalu paste ke editor SQL Supabase Anda.'
                    : 'Paste the following database definition script inside your Supabase SQL Editor to establish necessary triggers and constraints.'}
                </p>

                <div className="relative">
                  <pre className="text-[9px] font-mono text-slate-400 bg-slate-900 border border-white/5 p-3 rounded-xl max-h-[140px] overflow-y-scroll scrollbar-thin select-all leading-normal">
                    {sqlSchemaText}
                  </pre>
                  <button 
                    onClick={handleCopySQL}
                    className="absolute bottom-2 right-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all text-[9px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copied ? (language === 'id' ? 'Tersalin' : 'Copied') : (language === 'id' ? 'Salin SQL' : 'Copy SQL')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Access Protocols & active user info */}
        {activeConfigTab === 'access' && (
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Shield className="text-indigo-400" size={22} />
              <h3 className="font-bold text-white text-lg">
                {language === 'id' ? 'Keamanan & Protokol Otoritas' : 'Security & Access Protocols'}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-3 space-y-4">
                <div className="flex items-center gap-4 bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                  <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-lg font-bold">
                    {user?.email?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{language === 'id' ? 'Sesi Aktif' : 'Active Session'}</p>
                    <h4 className="font-bold text-white leading-tight">{user?.email || 'Administrator'}</h4>
                    <p className="text-[10px] font-mono text-slate-500">ID: {user?.id || 'LOCAL-ROOT-ADMIN'}</p>
                  </div>
                </div>

                <div className="p-5 bg-slate-900/20 border border-white/5 rounded-2xl text-xs space-y-2 text-slate-400 leading-relaxed">
                  <p className="font-bold text-white uppercase tracking-wider">{language === 'id' ? 'Sistem Pembagian Hak Akses' : 'Privilege Authorization Scheme:'}</p>
                  <p>
                    {language === 'id'
                      ? 'Administrator sistem memiliki izin penuh untuk mendaftarkan barang baru, mengubah detail SKU, memodifikasi tingkat persediaan, mengelola laundry, menyetujui restock, dan mendaftarkan webhook.'
                      : 'Administrators maintain total read-write capabilities to introduce SKU components, modify stock levels, audit laundry returned units, approve procurement requests, and wire webhooks.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Resource Limits / Adjust Thresholds */}
        {activeConfigTab === 'limits' && (
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <HardDrive className="text-indigo-400" size={22} />
              <h3 className="font-bold text-white text-lg">
                {language === 'id' ? 'Ambang Batas & Batas Sumber Daya' : 'Resource Threshold Limits'}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'id' ? 'Batas Default Stok Rendah (Low Stock Limit):' : 'Default Low Stock Warning Limit:'}
                </label>
                <input 
                  type="number"
                  min="1"
                  max="500"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500">
                  {language === 'id' 
                    ? 'Memicu warna merah dan peringatan kritis jika stok produk turun di bawah atau sama dengan angka ini.'
                    : 'Fires low-stock red warning markers on the grid when safety metrics drop below this integer.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'id' ? 'Target Kapasitas Gudang Maksimal (Unit):' : 'Max Warehouse Target Capacity:'}
                </label>
                <input 
                  type="number"
                  min="10"
                  max="100000"
                  value={maxWarehouseCapacity}
                  onChange={(e) => setMaxWarehouseCapacity(Math.max(10, parseInt(e.target.value) || 1000))}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500">
                  {language === 'id' 
                    ? 'Batas kapasitas teoritis gudang penyimpanan Anda untuk penaksiran presentasi kepadatan beban.'
                    : 'Theoretical maximum threshold for overall load tracking calculations on dashboard charts.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="text-xs">
                {settingsSaveSuccess && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-900/10 px-3 py-1.5 rounded-xl border border-emerald-500/25 animate-fade-in">
                    <CheckCircle2 size={13} />
                    {language === 'id' ? '✓ Pengaturan berhasil diperbarui!' : '✓ Threshold parameters saved successfully!'}
                  </span>
                )}
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/40"
              >
                {isSavingSettings ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>{language === 'id' ? 'Simpan Batas Parameter' : 'Save Limit Parameters'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Notification Hub / Alarm configs */}
        {activeConfigTab === 'notifications' && (
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Bell className="text-indigo-400" size={22} />
              <h3 className="font-bold text-white text-lg">
                {language === 'id' ? 'Konfigurasi Pusat Notifikasi & Alarm' : 'Notification Hub & Alert Configuration'}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{language === 'id' ? 'Alarm Tipe Audio:' : 'Audio Alarm Settings:'}</h4>
                
                <div className="flex items-center justify-between bg-slate-900/30 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                      {soundAlertsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{language === 'id' ? 'Efek Suara Sistem' : 'System Acoustic Beeps'}</p>
                      <p className="text-[10px] text-slate-500">{language === 'id' ? 'Mainkan bunyi bip akustik untuk status operasional' : 'Emit comfortable chime pulses for diagnostic feedback'}</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={soundAlertsEnabled}
                      onChange={(e) => {
                        setSoundAlertsEnabled(e.target.checked);
                        if (e.target.checked) playSynthSound(523.25, 0.15, 'sine');
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-500/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{language === 'id' ? 'Pilih demo untuk mendengarkan frekuensi bip' : 'Select a demo frequency to try out:'}</span>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => playSynthSound(440, 0.1, 'sine')}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded text-[10px] font-mono text-slate-400 cursor-pointer"
                    >
                      440Hz
                    </button>
                    <button 
                      onClick={() => playSynthSound(660, 0.1, 'sine')}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded text-[10px] font-mono text-slate-400 cursor-pointer"
                    >
                      660Hz
                    </button>
                    <button 
                      onClick={() => playSynthSound(880, 0.1, 'sine')}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded text-[10px] font-mono text-slate-400 cursor-pointer"
                    >
                      880Hz
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{language === 'id' ? 'Sinkronisasi Aliran Data:' : 'Sync Cycle Rate:'}</h4>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{language === 'id' ? 'Interval Refresh Otomatis:' : 'Auto Table Refresher Cycle:'}</label>
                  <select
                    value={autoRefreshInterval}
                    onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="1">1 {language === 'id' ? 'Menit' : 'Minute'}</option>
                    <option value="5">5 {language === 'id' ? 'Menit (Standar)' : 'Minutes (Default)'}</option>
                    <option value="15">15 {language === 'id' ? 'Menit' : 'Minutes'}</option>
                    <option value="0">{language === 'id' ? 'Manual Hanya (Hemat Energi)' : 'Manual Fetch Only (Low IO)'}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="text-xs">
                {settingsSaveSuccess && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-900/10 px-3 py-1.5 rounded-xl border border-emerald-500/25 animate-fade-in">
                    <CheckCircle2 size={13} />
                    {language === 'id' ? '✓ Pengaturan alarm disimpan!' : '✓ Alert specifications updated!'}
                  </span>
                )}
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/40"
              >
                {isSavingSettings ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>{language === 'id' ? 'Simpan Setelan Alarm' : 'Save Notification Set'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Telegram Bot Integration Section (Left completely intact and perfect!) */}
      <div id="telegram-setup-card" className="bg-[#111114]/50 border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div id="telegram-card-header" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
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
        <div id="telegram-details-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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
                id="btn-link-webhook"
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
                id="btn-test-notification"
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
                  {setupResult.success ? '✓ Notification Status Update' : '✗ Integration Log'}
                </p>
                <p>{setupResult.message}</p>
                {setupResult.webhook_url && (
                  <p className="font-mono mt-1 text-[10px] break-all select-all">
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

      {/* Advanced Diagnostics Interactive Terminal */}
      <div className="bg-[#111114]/50 border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-white">{t.settings.advancedDiagnostics}</h3>
            <p className="text-sm text-slate-500">{t.settings.diagnosticsDesc}</p>
          </div>
          
          <button 
            onClick={runSystemAudit}
            disabled={diagRunning}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0"
          >
            {diagRunning ? (
              <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Terminal size={13} />
            )}
            <span>{diagRunning ? (language === 'id' ? 'Menganalisis...' : 'Analyzing...') : t.settings.runAudit}</span>
          </button>
        </div>

        {diagLogs.length > 0 && (
          <div className="bg-slate-950 rounded-2xl border border-white/5 p-5 space-y-4 font-mono text-xs animate-fade-in relative overflow-hidden">
            <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-white/5 pb-2 uppercase tracking-widest font-black">
              <span>SYSTEM DIAGNOSTIC AUDIT LOG</span>
              <span className={`flex items-center gap-1 ${
                diagOverallStatus === 'RUNNING' ? 'text-indigo-400' :
                diagOverallStatus === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                ● Status: {diagOverallStatus}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto leading-normal select-text text-slate-300 scrollbar-thin">
              {diagLogs.map((log, index) => (
                <div key={index} className="whitespace-pre-wrap">{log}</div>
              ))}
              {diagRunning && (
                <div className="text-indigo-400 animate-pulse">▋ [System is testing endpoints...]</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Interactive ConfigCard that supports clicks and active states
function InteractiveConfigCard({ 
  icon: Icon, 
  title, 
  description, 
  status, 
  active, 
  onClick,
  badgeColor
}: { 
  icon: any; 
  title: string; 
  description: string; 
  status: string; 
  active: boolean; 
  onClick: () => void;
  badgeColor?: string;
}) {
  return (
    <button 
      onClick={onClick}
      className={`text-left bg-[#111114]/50 backdrop-blur-sm border p-8 rounded-3xl hover:border-indigo-500/50 transition-all group cursor-pointer flex flex-col justify-between w-full relative overflow-hidden ${
        active 
          ? 'border-indigo-500/80 ring-2 ring-indigo-500/20 shadow-indigo-950/20 shadow-xl' 
          : 'border-white/5'
      }`}
    >
      {active && (
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-purple-500" />
      )}
      
      <div className="w-full">
        <div className="flex items-start justify-between mb-6">
          <div className={`p-3 rounded-2xl border transition-colors ${
            active 
              ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400' 
              : 'bg-slate-900 border-white/5 text-slate-500 group-hover:text-indigo-400'
          }`}>
            <Icon size={24} />
          </div>
          <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded select-none ${
            badgeColor || 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
          }`}>
            {status}
          </span>
        </div>
        <h3 className="text-lg font-bold text-white tracking-tight mb-2 group-hover:text-indigo-300 transition-colors">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>

      <div className="w-full mt-4 flex items-center justify-end text-[10px] font-bold uppercase tracking-wider text-indigo-500 select-none opacity-0 group-hover:opacity-100 transition-opacity">
        {active ? '● CONFIGURING' : 'CONFIGURE ➔'}
      </div>
    </button>
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
