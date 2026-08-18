'use client';

import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  X, 
  AlertTriangle, 
  AlertCircle, 
  Wrench, 
  Info, 
  CheckCircle2, 
  Calendar, 
  User, 
  ChevronRight, 
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Announcement, AnnouncementType } from '@/types/inventory';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

interface AnnouncementPopupProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const READ_ANNOUNCEMENTS_KEY = 'stockflow_read_announcements';

export default function AnnouncementPopup({ forceOpen = false, onClose }: AnnouncementPopupProps) {
  const { user, isAdmin, isEngineering, userRole } = useAuth();
  const { language } = useLanguage();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      setIsLoading(true);
      // Fetch active announcements
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching announcements in popup:', error);
        return;
      }

      if (data && data.length > 0) {
        // Filter by user role targeting
        const currentUserRole = isAdmin ? 'admin' : (isEngineering ? 'engineering' : 'operator');

        const targeted = data.filter((ann: Announcement) => {
          if (ann.target_role === 'all') return true;
          if (ann.target_role === 'admin' && isAdmin) return true;
          if (ann.target_role === 'engineering' && (isEngineering || isAdmin)) return true;
          if (ann.target_role === 'operator' && (currentUserRole === 'operator' || isAdmin)) return true;
          return false;
        });

        if (targeted.length > 0) {
          setAnnouncements(targeted);

          if (forceOpen) {
            setCurrentIndex(0);
            setIsOpen(true);
          } else {
            // Check read history in localStorage
            const readIds: string[] = JSON.parse(localStorage.getItem(READ_ANNOUNCEMENTS_KEY) || '[]');
            const hasUnread = targeted.some((ann) => !readIds.includes(ann.id));
            
            if (hasUnread) {
              const firstUnreadIndex = targeted.findIndex((ann) => !readIds.includes(ann.id));
              setCurrentIndex(firstUnreadIndex >= 0 ? firstUnreadIndex : 0);
              
              const timer = setTimeout(() => {
                setIsOpen(true);
              }, 600);
              return () => clearTimeout(timer);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error in announcement popup:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [userRole, forceOpen]);

  const handleMarkAsRead = async (announcementId: string) => {
    // 1. Record in local storage cache
    const readIds: string[] = JSON.parse(localStorage.getItem(READ_ANNOUNCEMENTS_KEY) || '[]');
    if (!readIds.includes(announcementId)) {
      readIds.push(announcementId);
      localStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify(readIds));
    }

    // 2. Persist to database (announcement_reads)
    try {
      const readerName = user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Staff');
      const readerEmail = user?.email || 'operator@stockflow.com';
      const readerRole = isAdmin ? 'admin' : (isEngineering ? 'engineering' : 'operator');
      const readRecord = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `read-${Date.now()}`,
        announcement_id: announcementId,
        user_id: user?.id || 'u2',
        user_name: readerName,
        user_email: readerEmail,
        user_role: readerRole,
        read_at: new Date().toISOString()
      };

      const { data: existing } = await supabase
        .from('announcement_reads')
        .select('id')
        .eq('announcement_id', announcementId)
        .eq('user_id', user?.id || 'u2');

      if (!existing || existing.length === 0) {
        await supabase.from('announcement_reads').insert([readRecord]);
      }
    } catch (err) {
      console.warn('Failed to record read receipt in supabase:', err);
    }

    if (currentIndex < announcements.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsOpen(false);
      if (onClose) onClose();
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen || announcements.length === 0) {
    return null;
  }

  const currentItem = announcements[currentIndex] || announcements[0];

  const getTypeStyle = (type: AnnouncementType) => {
    switch (type) {
      case 'urgent':
        return {
          icon: AlertTriangle,
          badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          gradientBg: 'from-rose-500/15 via-rose-950/20 to-transparent',
          headerBorder: 'border-rose-500/30',
          accentColor: 'text-rose-400',
          label: language === 'id' ? 'PENTING / URGENT' : 'CRITICAL / URGENT',
          glow: 'shadow-rose-900/30'
        };
      case 'warning':
        return {
          icon: AlertCircle,
          badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          gradientBg: 'from-amber-500/15 via-amber-950/20 to-transparent',
          headerBorder: 'border-amber-500/30',
          accentColor: 'text-amber-400',
          label: language === 'id' ? 'PERINGATAN OPERASIONAL' : 'WARNING NOTICE',
          glow: 'shadow-amber-900/30'
        };
      case 'maintenance':
        return {
          icon: Wrench,
          badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
          gradientBg: 'from-cyan-500/15 via-cyan-950/20 to-transparent',
          headerBorder: 'border-cyan-500/30',
          accentColor: 'text-cyan-400',
          label: language === 'id' ? 'PEMELIHARAAN SISTEM' : 'SYSTEM MAINTENANCE',
          glow: 'shadow-cyan-900/30'
        };
      case 'info':
      default:
        return {
          icon: Info,
          badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          gradientBg: 'from-indigo-500/15 via-indigo-950/20 to-transparent',
          headerBorder: 'border-indigo-500/30',
          accentColor: 'text-indigo-400',
          label: language === 'id' ? 'INFORMASI SISTEM' : 'SYSTEM NOTICE',
          glow: 'shadow-indigo-900/30'
        };
    }
  };

  const currentStyle = getTypeStyle(currentItem.type);
  const IconComponent = currentStyle.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`relative w-full max-w-xl bg-[#121216] border border-white/10 rounded-3xl shadow-2xl overflow-hidden ${currentStyle.glow}`}
        >
          {/* Subtle Ambient Background Gradient */}
          <div className={`absolute top-0 inset-x-0 h-36 bg-gradient-to-b ${currentStyle.gradientBg} pointer-events-none`} />

          {/* Close Top-Right Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all cursor-pointer z-10"
            title="Tutup"
          >
            <X size={18} />
          </button>

          <div className="p-6 sm:p-8 relative z-10 flex flex-col">
            {/* Top Indicator Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-2xl border ${currentStyle.badgeBg} flex items-center justify-center shadow-lg`}>
                <IconComponent size={22} className={currentStyle.accentColor} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-widest border uppercase ${currentStyle.badgeBg}`}>
                    {currentStyle.label}
                  </span>
                  {announcements.length > 1 && (
                    <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                      {currentIndex + 1} dari {announcements.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                  <span className="flex items-center gap-1 font-medium">
                    <User size={12} className="text-slate-500" />
                    {currentItem.created_by || 'Super Admin'}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-slate-700" />
                  <span className="flex items-center gap-1 font-mono text-slate-400">
                    <Calendar size={12} className="text-slate-500" />
                    {new Date(currentItem.created_at).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Announcement Title */}
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug mb-3">
              {currentItem.title}
            </h2>

            {/* Announcement Body Content */}
            <div className="bg-[#0b0b0e] border border-white/5 rounded-2xl p-4 sm:p-5 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-[42vh] overflow-y-auto mb-6 whitespace-pre-wrap selection:bg-indigo-500/30">
              {currentItem.content}
            </div>

            {/* Footer Navigation & Confirmation Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/5">
              <div className="text-[11px] text-slate-500 font-medium order-2 sm:order-1">
                {announcements.length > 1 ? (
                  <span>Pemberitahuan penting ({currentIndex + 1}/{announcements.length})</span>
                ) : (
                  <span>Konfirmasi telah membaca pengumuman</span>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto order-1 sm:order-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  {language === 'id' ? 'Nanti Saja' : 'Dismiss'}
                </button>

                <button
                  type="button"
                  onClick={() => handleMarkAsRead(currentItem.id)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/40 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  <span>
                    {currentIndex < announcements.length - 1 
                      ? (language === 'id' ? 'Lanjut Berikutnya' : 'Next Notice')
                      : (language === 'id' ? 'Saya Mengerti (Tandai Dibaca)' : 'I Understand (Mark as Read)')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
