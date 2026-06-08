'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  UserCheck, 
  RefreshCw, 
  Lock, 
  Calendar, 
  Clock, 
  Mail, 
  Search, 
  ArrowLeft 
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  last_active: string;
}

export default function AdminUsersPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dataSource, setDataSource] = useState<'supabase-auth' | 'memory-fallback' | ''>('');

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        setDataSource(data.source);
      } else {
        console.error('Failed to query users:', data.error);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchUsers();
    }
  }, [authLoading, isAdmin]);

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verifying Authority...</p>
      </div>
    );
  }

  // Guard Clause for unauthorized roles
  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto text-center">
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

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 h-full">
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mr-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[9px] sm:text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">Module 06 / User Authority</span>
            <div className="h-1 w-1 bg-slate-700 rounded-full" />
            <span className="text-[9px] sm:text-[10px] font-bold text-amber-500 uppercase tracking-[0.3em]">
              {dataSource === 'supabase-auth' ? 'Database Autentikasi Supabase' : 'Sandbox Internal Cache'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Users size={28} className="text-indigo-400" />
            {t.common.userList}
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={fetchUsers}
            disabled={isLoading}
            className="p-2 sm:p-3 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all hover:bg-slate-800 shrink-0 disabled:opacity-40"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mr-2">
        <div className="bg-[#111114]/50 border border-white/5 rounded-3xl p-6 flex items-center gap-4">
          <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Pengguna</p>
            <p className="text-2xl font-mono font-black text-white mt-0.5">{users.length}</p>
          </div>
        </div>
        <div className="bg-[#111114]/50 border border-white/5 rounded-3xl p-6 flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Super Administrator</p>
            <p className="text-2xl font-mono font-black text-white mt-0.5">
              {users.filter(u => u.role === 'admin').length}
            </p>
          </div>
        </div>
        <div className="bg-[#111114]/50 border border-white/5 rounded-3xl p-6 flex items-center gap-4">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Operator Staff / Active</p>
            <p className="text-2xl font-mono font-black text-white mt-0.5">
              {users.filter(u => u.role !== 'admin').length}
            </p>
          </div>
        </div>
      </div>

      {/* Roster Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mr-2">
        <div className="relative w-full sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-600">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari user berdasarkan nama, email, atau UUID..."
            className="w-full bg-[#111114]/50 border border-white/5 pl-11 pr-4 py-3 sm:py-3.5 text-xs text-white placeholder-slate-600 rounded-2xl focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
          />
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 min-h-[400px] flex flex-col mr-2">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Querying User Database...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-[#111114]/30 rounded-3xl border border-dashed border-white/5">
            <Users size={48} className="text-slate-700 mb-4" />
            <h3 className="text-lg font-bold text-slate-300">Tidak ada user ditemukan.</h3>
            <p className="text-slate-500 text-xs mt-2 max-w-sm">Tidak ada baris yang cocok dengan pencarian Anda atau database registrasi kosong.</p>
          </div>
        ) : (
          <div className="bg-[#111114]/50 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5">
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Identitas User</th>
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] hidden md:table-cell">Kontak Email</th>
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Status Otoritas</th>
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] hidden lg:table-cell">Tanggal Registrasi</th>
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-right">Aktivitas Terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03] text-sm text-slate-300">
                  <AnimatePresence mode="popLayout">
                    {filteredUsers.map((item) => {
                      const isCurrentUser = user?.id === item.id;
                      const isAdminRole = item.role === 'admin';
                      return (
                        <motion.tr 
                          layout
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-white/[0.02] transition-colors duration-200"
                        >
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl border ${isAdminRole ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-slate-800/40 border-white/5 text-slate-400'}`}>
                                <Users size={16} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-white font-bold tracking-tight block">
                                  {item.full_name}
                                  {isCurrentUser && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-indigo-500/20 border border-indigo-500/35 text-[9px] text-indigo-400 font-extrabold rounded-md uppercase tracking-wide">
                                      Anda
                                    </span>
                                  )}
                                </span>
                                <span className="text-[9px] text-slate-600 font-mono tracking-widest block uppercase mt-0.5">
                                  UUID: {item.id}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-5 hidden md:table-cell">
                            <div className="flex items-center gap-2 text-slate-400">
                              <Mail size={12} className="text-slate-600" />
                              <span className="font-mono text-xs">{item.email}</span>
                            </div>
                          </td>
                          <td className="p-5">
                            {isAdminRole ? (
                              <div className="flex items-center gap-1.5 text-indigo-400 text-[10px] font-extrabold uppercase tracking-wide bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 w-fit">
                                <Shield size={12} />
                                Super Admin
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-extrabold uppercase tracking-wide bg-slate-800/60 px-2.5 py-1 rounded-lg border border-white/5 w-fit">
                                Operator Staff
                              </div>
                            )}
                          </td>
                          <td className="p-5 hidden lg:table-cell font-mono text-xs text-slate-400">
                            <div className="flex items-center gap-2">
                              <Calendar size={12} className="text-slate-600" />
                              {new Date(item.created_at).toLocaleDateString('id-ID', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          </td>
                          <td className="p-5 text-right font-mono text-xs text-slate-400">
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1.5 justify-end">
                                <Clock size={12} className="text-slate-600" />
                                <span>
                                  {new Date(item.last_active).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-600 mt-1 block">
                                {new Date(item.last_active).toLocaleDateString('id-ID', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
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
    </div>
  );
}
