import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  AlertTriangle, 
  AlertCircle, 
  Wrench, 
  Info, 
  Trash2, 
  Edit3, 
  Eye, 
  CheckCircle2, 
  X, 
  Calendar, 
  User, 
  Shield, 
  Code, 
  Copy, 
  Check, 
  Radio, 
  Lock, 
  ArrowLeft,
  Users,
  CheckCheck,
  Download,
  Clock,
  FileSpreadsheet,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Announcement, AnnouncementType, AnnouncementTarget, AnnouncementRead } from '../../types';
import { supabase, isRealSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-auth';
import { useLanguage } from '../../hooks/use-language';
import Link from '../link';
import AnnouncementPopup from '../announcements/announcement-popup';

const SUPABASE_ANNOUNCEMENTS_SQL = `-- ====================================================================
-- STOCKFLOW WMS: SKEMA TABEL ANNOUNCEMENTS & RIWAYAT PEMBACA
-- Jalankan query ini di SQL Editor Supabase Dashboard Anda
-- ====================================================================

-- 1. Buat tabel announcements jika belum ada
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  type text not null default 'info' check (type in ('info', 'warning', 'urgent', 'maintenance')),
  target_role text not null default 'all' check (target_role in ('all', 'admin', 'engineering', 'operator')),
  is_active boolean not null default true,
  start_date timestamptz default now(),
  end_date timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Buat tabel announcement_reads untuk tracking user pembaca
create table if not exists public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id text not null,
  user_name text not null,
  user_email text,
  user_role text not null default 'operator',
  read_at timestamptz not null default now(),
  constraint unique_user_announcement_read unique (announcement_id, user_id)
);

-- 3. Index performa untuk pembacaan riwayat
create index if not exists idx_announcement_reads_ann_id on public.announcement_reads(announcement_id);
create index if not exists idx_announcement_reads_user_id on public.announcement_reads(user_id);

-- 4. Aktifkan Row Level Security (RLS)
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- 5. Kebijakan Akses: Seluruh user terotentikasi & publik dengan API key
drop policy if exists "announcements_read_all" on public.announcements;
create policy "announcements_read_all"
  on public.announcements for select
  using (true);

drop policy if exists "announcements_manage_all" on public.announcements;
create policy "announcements_manage_all"
  on public.announcements for all
  using (true)
  with check (true);

drop policy if exists "announcement_reads_select_all" on public.announcement_reads;
create policy "announcement_reads_select_all"
  on public.announcement_reads for select
  using (true);

drop policy if exists "announcement_reads_insert_all" on public.announcement_reads;
create policy "announcement_reads_insert_all"
  on public.announcement_reads for insert
  with check (true);

-- 6. Masukkan sampel pemberitahuan awal
insert into public.announcements (id, title, content, type, target_role, is_active, created_by)
values 
  (
    '00000000-0000-0000-0000-000000000001',
    'Pemeliharaan Sistem & SOP Pengeluaran Stok Baru',
    'Perhatian untuk seluruh staf Gym Attendance & Engineering: Mulai minggu ini, setiap pencatatan stok keluar wajib menyertakan foto/dokumen serah terima. Selain itu, pemeliharaan server database cloud akan dilakukan pada hari Minggu pukul 23:00 WIB.',
    'urgent',
    'all',
    true,
    'Super Admin'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Jadwal Kalibrasi Alat Mesin Laundry & Perangkat Gym',
    'Tim Engineering dijadwalkan melakukan inspeksi rutin pada mesin cuci komersial dan sistem filtrasi air pada hari Rabu pagi. Mohon koordinasi dengan tim operasional lantai.',
    'maintenance',
    'engineering',
    true,
    'Super Admin'
  )
on conflict do nothing;
`;

export default function AdminAnnouncementsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [allReads, setAllReads] = useState<AnnouncementRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AnnouncementType>('all');
  const [targetFilter, setTargetFilter] = useState<'all' | AnnouncementTarget>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isPreviewPopupOpen, setIsPreviewPopupOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Detail / Reader History state
  const [selectedDetailItem, setSelectedDetailItem] = useState<Announcement | null>(null);
  const [readerSearchQuery, setReaderSearchQuery] = useState('');
  const [readerRoleFilter, setReaderRoleFilter] = useState<string>('all');

  // Form State
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState<AnnouncementType>('info');
  const [formTarget, setFormTarget] = useState<AnnouncementTarget>('all');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  const [selectedToDelete, setSelectedToDelete] = useState<Announcement | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch announcements
      const { data: annData, error: annError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (annError) {
        console.warn('Error querying announcements:', annError);
      }

      // 2. Fetch read receipts
      const { data: readData, error: readError } = await supabase
        .from('announcement_reads')
        .select('*')
        .order('read_at', { ascending: false });

      if (readError) {
        console.warn('Error querying announcement_reads:', readError);
      }

      const readsList: AnnouncementRead[] = readData || [];
      setAllReads(readsList);

      // Attach read count to each announcement
      const enrichedAnnouncements: Announcement[] = (annData || []).map((ann: Announcement) => {
        const count = readsList.filter(r => r.announcement_id === ann.id).length;
        return { ...ann, read_count: count };
      });

      setAnnouncements(enrichedAnnouncements);
    } catch (err) {
      console.warn('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchAnnouncements();
    }
  }, [authLoading, isAdmin]);

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormContent('');
    setFormType('info');
    setFormTarget('all');
    setFormIsActive(true);
    setActiveTab('form');
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (item: Announcement) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormType(item.type);
    setFormTarget(item.target_role);
    setFormIsActive(item.is_active);
    setActiveTab('form');
    setIsFormModalOpen(true);
  };

  const handleOpenDetailModal = (item: Announcement) => {
    setSelectedDetailItem(item);
    setReaderSearchQuery('');
    setReaderRoleFilter('all');
    setIsDetailModalOpen(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      showToast(language === 'id' ? 'Judul dan isi pemberitahuan wajib diisi.' : 'Title and content are required.', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      const authorName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Super Admin';

      if (editingItem) {
        // Update existing
        const updatePayload = {
          title: formTitle.trim(),
          content: formContent.trim(),
          type: formType,
          target_role: formTarget,
          is_active: formIsActive,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('announcements')
          .update(updatePayload)
          .eq('id', editingItem.id);

        if (error) throw error;

        // Invalidate local read cache so users see updated urgent notice
        localStorage.removeItem('stockflow_read_announcements');

        showToast(language === 'id' ? 'Pemberitahuan berhasil diperbarui!' : 'Announcement successfully updated!');
      } else {
        // Create new
        const newRecord = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ann-${Date.now()}`,
          title: formTitle.trim(),
          content: formContent.trim(),
          type: formType,
          target_role: formTarget,
          is_active: formIsActive,
          created_by: authorName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('announcements')
          .insert([newRecord]);

        if (error) throw error;

        // Invalidate read cache so users see the new notice
        localStorage.removeItem('stockflow_read_announcements');

        showToast(language === 'id' ? 'Pemberitahuan baru berhasil disiarkan ke dashboard!' : 'New announcement broadcasted successfully!');
      }

      setIsFormModalOpen(false);
      fetchAnnouncements();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pemberitahuan.', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (item: Announcement) => {
    try {
      const nextStatus = !item.is_active;
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) throw error;

      // Update state locally
      setAnnouncements(announcements.map(a => a.id === item.id ? { ...a, is_active: nextStatus } : a));

      // Reset read cache if activated
      if (nextStatus) {
        localStorage.removeItem('stockflow_read_announcements');
      }

      showToast(
        nextStatus 
          ? (language === 'id' ? 'Pemberitahuan telah diaktifkan di dashboard.' : 'Announcement activated.') 
          : (language === 'id' ? 'Pemberitahuan dinonaktifkan.' : 'Announcement deactivated.')
      );
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status.', 'error');
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!selectedToDelete) return;
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', selectedToDelete.id);

      if (error) throw error;

      // Also clean up read receipts associated with this announcement
      await supabase.from('announcement_reads').delete().eq('announcement_id', selectedToDelete.id);

      setAnnouncements(announcements.filter(a => a.id !== selectedToDelete.id));
      showToast(language === 'id' ? 'Pemberitahuan telah dihapus.' : 'Announcement deleted.');
      setIsDeleteModalOpen(false);
      setSelectedToDelete(null);
      if (selectedDetailItem?.id === selectedToDelete.id) {
        setIsDetailModalOpen(false);
        setSelectedDetailItem(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus pemberitahuan.', 'error');
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SUPABASE_ANNOUNCEMENTS_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const exportReadersCSV = (announcement: Announcement, readers: AnnouncementRead[]) => {
    const headers = ['User Name', 'Email', 'Role', 'Read Timestamp'];
    const rows = readers.map(r => [
      `"${r.user_name}"`,
      `"${r.user_email}"`,
      `"${r.user_role}"`,
      `"${r.read_at}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riwayat_pembaca_${announcement.title.slice(0, 20).replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Checking Permissions...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto text-center h-[50vh]">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl mb-6">
          <Lock size={32} />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2">Akses Ditolak / Access Denied</h1>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Halaman Pengumuman & Pemberitahuan Sistem ini hanya dapat diakses oleh Super Administrator.
        </p>
        <Link 
          href="/"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/40 uppercase tracking-widest flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft size={14} />
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const filteredAnnouncements = announcements.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.created_by && item.created_by.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesTarget = targetFilter === 'all' || item.target_role === targetFilter;
    const matchesStatus = 
      statusFilter === 'all' ? true : 
      statusFilter === 'active' ? item.is_active : !item.is_active;

    return matchesSearch && matchesType && matchesTarget && matchesStatus;
  });

  const totalCount = announcements.length;
  const activeCount = announcements.filter(a => a.is_active).length;
  const urgentCount = announcements.filter(a => a.type === 'urgent' && a.is_active).length;
  const totalReadersCount = allReads.length;

  const getTypeBadge = (type: AnnouncementType) => {
    switch (type) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertTriangle size={12} />
            Urgent
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <AlertCircle size={12} />
            Peringatan
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Wrench size={12} />
            Pemeliharaan
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Info size={12} />
            Informasi
          </span>
        );
    }
  };

  const getTargetBadge = (target: AnnouncementTarget) => {
    switch (target) {
      case 'all':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-white/5 border border-white/10 text-slate-300">
            Semua Staf
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-300">
            Super Admin
          </span>
        );
      case 'engineering':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
            Engineering
          </span>
        );
      case 'operator':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-300">
            Gym Attendance
          </span>
        );
      default:
        return null;
    }
  };

  const getRoleBadge = (role: string) => {
    const r = role.toLowerCase();
    if (r === 'admin' || r === 'super admin' || r === 'superadmin') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono">
          Super Admin
        </span>
      );
    }
    if (r === 'engineering') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono">
          Engineering
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
        Gym Attendance
      </span>
    );
  };

  // Get active readers for the currently opened Detail modal
  const selectedReaders = selectedDetailItem 
    ? allReads.filter(r => r.announcement_id === selectedDetailItem.id)
    : [];

  const filteredReaders = selectedReaders.filter(r => {
    const matchesSearch = 
      r.user_name.toLowerCase().includes(readerSearchQuery.toLowerCase()) ||
      r.user_email.toLowerCase().includes(readerSearchQuery.toLowerCase());
    const matchesRole = 
      readerRoleFilter === 'all' || 
      r.user_role.toLowerCase() === readerRoleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex flex-col gap-8 h-full">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl border shadow-2xl flex items-center gap-3 text-xs font-bold ${
              toastMessage.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
                : 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
            }`}
          >
            {toastMessage.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            {toastMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mr-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[9px] sm:text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">Module 07 / Broadcast System</span>
            <div className="h-1 w-1 bg-slate-700 rounded-full" />
            <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em] flex items-center gap-1.5">
              <Radio size={11} className="animate-pulse" />
              Live Read Receipts Tracking
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Megaphone size={28} className="text-indigo-400" />
            {t.announcements.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Kelola pengumuman dan pantau riwayat staf (Gym Attendance, Engineering, & Admin) yang telah membaca setiap notifikasi secara real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            id="test-popup-preview-btn"
            onClick={() => setIsPreviewPopupOpen(true)}
            className="px-3.5 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
            title="Simulasikan Pop-up Pengguna"
          >
            <Eye size={15} className="text-amber-400" />
            <span>Tes Pop-up User</span>
          </button>

          <button 
            onClick={() => setIsSqlModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
            title="Lihat Script SQL Supabase"
          >
            <Code size={15} className="text-indigo-400" />
            <span>SQL Supabase</span>
          </button>

          <button 
            onClick={fetchAnnouncements}
            disabled={isLoading}
            className="p-2.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all hover:bg-slate-800 shrink-0 disabled:opacity-40 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button 
            id="add-announcement-btn"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-indigo-900/40 uppercase tracking-wider flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>{t.announcements.newAnnouncement}</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mr-2">
        <div className="bg-[#111114]/50 border border-white/5 rounded-3xl p-5 flex items-center gap-3.5">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
            <Megaphone size={20} />
          </div>
          <div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Total Pengumuman</p>
            <p className="text-xl font-mono font-black text-white mt-0.5">{totalCount}</p>
          </div>
        </div>

        <div className="bg-[#111114]/50 border border-white/5 rounded-3xl p-5 flex items-center gap-3.5">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Sedang Aktif (Live)</p>
            <p className="text-xl font-mono font-black text-white mt-0.5">{activeCount}</p>
          </div>
        </div>

        <div className="bg-[#111114]/50 border border-white/5 rounded-3xl p-5 flex items-center gap-3.5">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Urgent / Penting</p>
            <p className="text-xl font-mono font-black text-white mt-0.5">{urgentCount}</p>
          </div>
        </div>

        <div className="bg-[#111114]/50 border border-white/5 rounded-3xl p-5 flex items-center gap-3.5">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Total Konfirmasi Baca</p>
            <p className="text-xl font-mono font-black text-white mt-0.5">{totalReadersCount}</p>
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mr-2">
        <div className="relative w-full md:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-600">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul, isi pengumuman, atau pembuat..."
            className="w-full bg-[#111114]/50 border border-white/5 pl-11 pr-4 py-3 text-xs text-white placeholder-slate-600 rounded-2xl focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Filter Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-[#111114]/50 border border-white/5 px-3 py-2.5 text-xs text-white rounded-2xl focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
          >
            <option value="all">Semua Tipe</option>
            <option value="urgent">Urgent / Penting</option>
            <option value="warning">Peringatan</option>
            <option value="maintenance">Pemeliharaan</option>
            <option value="info">Informasi</option>
          </select>

          {/* Filter Target Role */}
          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value as any)}
            className="bg-[#111114]/50 border border-white/5 px-3 py-2.5 text-xs text-white rounded-2xl focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
          >
            <option value="all">Semua Target Role</option>
            <option value="all">Semua Staf</option>
            <option value="admin">Khusus Super Admin</option>
            <option value="engineering">Khusus Engineering</option>
            <option value="operator">Khusus Gym Attendance</option>
          </select>

          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-[#111114]/50 border border-white/5 px-3 py-2.5 text-xs text-white rounded-2xl focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif (Live Pop-up)</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Main Table / List Container */}
      <div className="flex-1 min-h-[400px] flex flex-col mr-2">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Memuat Pemberitahuan & Data Pembaca...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16 text-center bg-[#111114]/30 rounded-3xl border border-dashed border-white/5">
            <Megaphone size={48} className="text-slate-700 mb-4" />
            <h3 className="text-lg font-bold text-slate-300">{t.announcements.noAnnouncements}</h3>
            <p className="text-slate-500 text-xs mt-2 max-w-md">
              {t.announcements.noAnnouncementsDesc}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/40 uppercase tracking-wider flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>{t.announcements.newAnnouncement}</span>
            </button>
          </div>
        ) : (
          <div className="bg-[#111114]/50 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5">
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Judul & Isi Pengumuman</th>
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Tipe</th>
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] hidden sm:table-cell">Target Role</th>
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Status Broadcast</th>
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Riwayat Pembaca</th>
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] hidden lg:table-cell">Dibuat Oleh</th>
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03] text-sm text-slate-300">
                  <AnimatePresence mode="popLayout">
                    {filteredAnnouncements.map((item) => {
                      const readCount = item.read_count || 0;
                      return (
                        <motion.tr 
                          layout
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-white/[0.02] transition-colors duration-200"
                        >
                          {/* Title & snippet */}
                          <td className="p-5 max-w-sm">
                            <div>
                              <p className="text-white font-bold tracking-tight text-sm mb-1 flex items-center gap-2">
                                {item.title}
                                {item.is_active && (
                                  <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                {item.content}
                              </p>
                            </div>
                          </td>

                          {/* Type Badge */}
                          <td className="p-5">
                            {getTypeBadge(item.type)}
                          </td>

                          {/* Target Role */}
                          <td className="p-5 hidden sm:table-cell">
                            {getTargetBadge(item.target_role)}
                          </td>

                          {/* Active Toggle */}
                          <td className="p-5">
                            <button
                              onClick={() => handleToggleActive(item)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                item.is_active
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'
                              }`}
                              title={item.is_active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan di dashboard'}
                            >
                              {item.is_active ? (
                                <>
                                  <CheckCircle2 size={13} />
                                  <span>Aktif (Live)</span>
                                </>
                              ) : (
                                <>
                                  <X size={13} />
                                  <span>Nonaktif</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Read Receipts Count Button */}
                          <td className="p-5">
                            <button
                              onClick={() => handleOpenDetailModal(item)}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                readCount > 0
                                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/40 shadow-sm'
                                  : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'
                              }`}
                              title="Klik untuk melihat nama-nama user yang sudah membaca"
                            >
                              <Users size={14} className={readCount > 0 ? 'text-indigo-400' : 'text-slate-500'} />
                              <span>{readCount} Pembaca</span>
                            </button>
                          </td>

                          {/* Created by */}
                          <td className="p-5 hidden lg:table-cell text-xs text-slate-400 font-mono">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-slate-200 font-sans font-medium">{item.created_by || 'Admin'}</span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(item.created_at).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Detail & Readers Button */}
                              <button
                                onClick={() => handleOpenDetailModal(item)}
                                className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 rounded-xl transition-all cursor-pointer"
                                title="Lihat Detail & Riwayat Pembaca"
                              >
                                <Eye size={15} />
                              </button>

                              {/* Edit Button */}
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 rounded-xl transition-all cursor-pointer"
                                title="Edit Pengumuman"
                              >
                                <Edit3 size={15} />
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => {
                                setSelectedToDelete(item);
                                setIsDeleteModalOpen(true);
                              }}
                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition-all cursor-pointer"
                                title="Hapus Pengumuman"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 0: DETAIL PENGUMUMAN & RIWAYAT PEMBACA (READ RECEIPTS HISTORY) */}
      <AnimatePresence>
        {isDetailModalOpen && selectedDetailItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#141418] border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-3xl shadow-2xl relative my-auto flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-5 border-b border-white/5 mb-6">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl shadow-lg shrink-0">
                    <Users size={24} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {getTypeBadge(selectedDetailItem.type)}
                      {getTargetBadge(selectedDetailItem.target_role)}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                        selectedDetailItem.is_active 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-white/5 border-white/5 text-slate-500'
                      }`}>
                        {selectedDetailItem.is_active ? 'Status: LIVE' : 'Status: NONAKTIF'}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
                      {selectedDetailItem.title}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all cursor-pointer shrink-0 ml-2"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                {/* Full Announcement Text Box */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Isi Pesan Pengumuman
                  </label>
                  <div className="bg-[#0c0c0f] border border-white/5 rounded-2xl p-4 sm:p-5 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap selection:bg-indigo-500/30">
                    {selectedDetailItem.content}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
                    <span>Diumumkan oleh: <strong className="text-slate-300">{selectedDetailItem.created_by || 'Admin'}</strong></span>
                    <span>Tanggal: {new Date(selectedDetailItem.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                </div>

                {/* Readers Metric Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#0c0c0f] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                      <CheckCheck size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Total Pembaca</p>
                      <p className="text-lg font-black text-white font-mono">{selectedReaders.length} User</p>
                    </div>
                  </div>

                  <div className="bg-[#0c0c0f] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Gym Attendance</p>
                      <p className="text-lg font-black text-white font-mono">
                        {selectedReaders.filter(r => r.user_role === 'operator').length} Staf
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#0c0c0f] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl">
                      <Wrench size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Engineering & Admin</p>
                      <p className="text-lg font-black text-white font-mono">
                        {selectedReaders.filter(r => r.user_role === 'engineering' || r.user_role === 'admin').length} Staf
                      </p>
                    </div>
                  </div>
                </div>

                {/* Readers History Section */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Users size={14} className="text-indigo-400" />
                        Daftar Nama Staf yang Telah Membaca
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Riwayat konfirmasi klik tombol "Saya Mengerti" pada modal pop-up dashboard.
                      </p>
                    </div>

                    {/* Download CSV Button */}
                    {selectedReaders.length > 0 && (
                      <button
                        onClick={() => exportReadersCSV(selectedDetailItem, selectedReaders)}
                        className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                        title="Unduh data pembaca format CSV"
                      >
                        <Download size={13} className="text-emerald-400" />
                        <span>Unduh CSV</span>
                      </button>
                    )}
                  </div>

                  {/* Filter & Search inside readers list */}
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <div className="relative w-full">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-600">
                        <Search size={14} />
                      </div>
                      <input
                        type="text"
                        value={readerSearchQuery}
                        onChange={(e) => setReaderSearchQuery(e.target.value)}
                        placeholder="Cari nama atau email pembaca..."
                        className="w-full bg-[#0c0c0f] border border-white/10 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 rounded-xl focus:outline-none focus:border-indigo-500 transition-all font-medium"
                      />
                    </div>

                    <select
                      value={readerRoleFilter}
                      onChange={(e) => setReaderRoleFilter(e.target.value)}
                      className="bg-[#0c0c0f] border border-white/10 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 transition-all font-medium w-full sm:w-auto"
                    >
                      <option value="all">Semua Role</option>
                      <option value="operator">Gym Attendance</option>
                      <option value="engineering">Engineering</option>
                      <option value="admin">Super Admin</option>
                    </select>
                  </div>

                  {/* Readers List Container */}
                  {filteredReaders.length === 0 ? (
                    <div className="p-8 text-center bg-[#0c0c0f] rounded-2xl border border-dashed border-white/5 space-y-2">
                      <Users size={32} className="text-slate-700 mx-auto" />
                      <p className="text-xs font-bold text-slate-400">Belum Ada Riwayat Pembaca</p>
                      <p className="text-[11px] text-slate-600 max-w-sm mx-auto">
                        Belum ada staf yang mengonfirmasi membaca pemberitahuan ini atau filter pencarian tidak menemukan hasil.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-[#0c0c0f] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                      {filteredReaders.map((reader, idx) => (
                        <div key={reader.id || idx} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {reader.user_name ? reader.user_name.charAt(0).toUpperCase() : 'U'}
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate flex items-center gap-2">
                                {reader.user_name}
                                {getRoleBadge(reader.user_role)}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono truncate">
                                {reader.user_email}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono justify-end">
                              <Clock size={12} className="text-emerald-400" />
                              <span>{new Date(reader.read_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                            </div>
                            <span className="text-[10px] text-slate-600 font-sans block mt-0.5">
                              {new Date(reader.read_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="flex items-center justify-between pt-5 border-t border-white/5 mt-6">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenEditModal(selectedDetailItem);
                  }}
                  className="px-4 py-2 text-xs font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-xl transition-all cursor-pointer flex items-center gap-2"
                >
                  <Edit3 size={14} />
                  <span>Edit Pemberitahuan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 1: FORM TAMBAH / EDIT PEMBERITAHUAN */}
      <AnimatePresence>
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#16161a] border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl relative my-auto flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                    <Megaphone size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      {editingItem ? t.announcements.editAnnouncement : t.announcements.newAnnouncement}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Pemberitahuan akan disiarkan ke dashboard sesuai target role yang dipilih.
                    </p>
                  </div>
                </div>

                {/* Tab Switcher (Form vs Live Preview) */}
                <div className="flex items-center gap-2">
                  <div className="flex bg-[#111114] p-1 rounded-xl border border-white/5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setActiveTab('form')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        activeTab === 'form' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Form
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'preview' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Eye size={13} />
                      <span>Live Preview</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setIsFormModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 cursor-pointer ml-1"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              {activeTab === 'form' ? (
                <form onSubmit={handleSaveAnnouncement} className="space-y-4 overflow-y-auto pr-1">
                  {/* Judul */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {t.announcements.formTitle} <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Contoh: Pemeliharaan Server & Perubahan SOP Barang Masuk"
                      className="w-full bg-[#111114] border border-white/10 px-4 py-3 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>

                  {/* Grid 2 Cols: Tipe & Target Audience */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tipe */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        {t.announcements.formType}
                      </label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as AnnouncementType)}
                        className="w-full bg-[#111114] border border-white/10 px-3.5 py-3 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 transition-all font-medium"
                      >
                        <option value="info">Informasi (Biru / Netral)</option>
                        <option value="warning">Peringatan (Kuning / Amber)</option>
                        <option value="urgent">Urgent / Sangat Penting (Merah)</option>
                        <option value="maintenance">Pemeliharaan Sistem (Cyan)</option>
                      </select>
                    </div>

                    {/* Target Audience */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        {t.announcements.formTarget}
                      </label>
                      <select
                        value={formTarget}
                        onChange={(e) => setFormTarget(e.target.value as AnnouncementTarget)}
                        className="w-full bg-[#111114] border border-white/10 px-3.5 py-3 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 transition-all font-medium"
                      >
                        <option value="all">Semua Pengguna (All Staff)</option>
                        <option value="operator">Khusus Gym Attendance / Operator</option>
                        <option value="engineering">Khusus Engineering</option>
                        <option value="admin">Khusus Super Admin</option>
                      </select>
                    </div>
                  </div>

                  {/* Active Toggle Switch */}
                  <div className="p-4 bg-[#111114] border border-white/5 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{t.announcements.formActive}</span>
                        {formIsActive ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">LIVE</span>
                        ) : (
                          <span className="text-[10px] bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded font-mono font-bold">DRAFT</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {t.announcements.formActiveDesc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormIsActive(!formIsActive)}
                      className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                        formIsActive
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-white/5 border-white/10 text-slate-500'
                      }`}
                    >
                      {formIsActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </div>

                  {/* Isi Pengumuman */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {t.announcements.formContent} <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder="Tuliskan detail pengumuman yang jelas dan ringkas di sini. Anda dapat menggunakan baris baru untuk membuat poin-poin penting..."
                      className="w-full bg-[#111114] border border-white/10 p-4 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 transition-all font-normal leading-relaxed"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsFormModalOpen(false)}
                      className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/40 uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {formSubmitting ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          <span>{editingItem ? 'Simpan Perubahan' : 'Siarkan Pemberitahuan'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* LIVE PREVIEW TAB */
                <div className="space-y-4 overflow-y-auto">
                  <p className="text-xs text-slate-400">
                    Ini adalah simulasi tampilan modal yang akan muncul di layar user saat masuk ke dashboard:
                  </p>
                  
                  <div className="bg-[#121216] border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    <div className="flex items-center gap-3.5 mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        {formType === 'urgent' ? <AlertTriangle size={20} className="text-rose-400" /> : formType === 'maintenance' ? <Wrench size={20} className="text-cyan-400" /> : formType === 'warning' ? <AlertCircle size={20} className="text-amber-400" /> : <Info size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {formType.toUpperCase()}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                            Target: {formTarget}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white">
                          {formTitle || 'Judul Pemberitahuan Akan Muncul Di Sini'}
                        </h4>
                      </div>
                    </div>

                    <div className="bg-[#0b0b0e] border border-white/5 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap mb-4">
                      {formContent || 'Isi pengumuman yang Anda ketikkan akan ditampilkan secara rapi di area ini.'}
                    </div>

                    <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500">
                      <span>Diumumkan oleh Super Admin</span>
                      <span>Hari ini</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('form')}
                      className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl"
                    >
                      Kembali ke Edit Form
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: HAPUS KONFIRMASI */}
      <AnimatePresence>
        {isDeleteModalOpen && selectedToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#16161a] border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center gap-3.5 mb-4">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Hapus Pemberitahuan</h3>
                  <p className="text-xs text-slate-400 truncate max-w-xs">{selectedToDelete.title}</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                Apakah Anda yakin ingin menghapus pemberitahuan ini? Seluruh riwayat pembacaan terkait juga akan dihapus.
              </p>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAnnouncement}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-rose-900/40 uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Hapus Permanen</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: SQL SUPABASE */}
      <AnimatePresence>
        {isSqlModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#16161a] border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                    <Code size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Script SQL Announcements & Riwayat Pembaca</h3>
                    <p className="text-[11px] text-slate-400">Jalankan di Supabase Dashboard &gt; SQL Editor untuk tabel cloud terpadu.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSqlModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#0d0d10] border border-white/5 rounded-2xl p-4 font-mono text-xs text-slate-300 leading-relaxed mb-4 select-all">
                <pre className="whitespace-pre-wrap">{SUPABASE_ANNOUNCEMENTS_SQL}</pre>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[11px] text-slate-400">
                  {copiedSql ? '✓ Tersalin ke clipboard!' : 'Salin lalu jalankan di Supabase SQL Editor.'}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={copySqlToClipboard}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/40 uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                  >
                    {copiedSql ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedSql ? 'Tersalin' : 'Salin SQL'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSqlModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP SIMULATOR TRIGGER */}
      {isPreviewPopupOpen && (
        <AnnouncementPopup 
          forceOpen={true} 
          onClose={() => setIsPreviewPopupOpen(false)} 
        />
      )}
    </div>
  );
}
