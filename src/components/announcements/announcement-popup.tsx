import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  AlertTriangle, 
  AlertCircle, 
  Wrench, 
  Info, 
  X, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Calendar, 
  User, 
  Shield, 
  Megaphone,
  Radio
} from 'lucide-react';
import { Announcement, AnnouncementType, AnnouncementTarget } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-auth';
import { useLanguage } from '../../hooks/use-language';

interface AnnouncementPopupProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const READ_ANNOUNCEMENTS_KEY = 'stockflow_read_announcements';

export default function AnnouncementPopup({ forceOpen = false, onClose }: AnnouncementPopupProps) {
  const { user, isAdmin, isEngineering, userRole } = useAuth();
  const { t, language } = useLanguage();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Determine current active user role
  const currentUserRole: AnnouncementTarget = isAdmin 
    ? 'admin' 
    : isEngineering 
    ? 'engineering' 
    : 'operator';

  const fetchAnnouncements = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let allActive: Announcement[] = data || [];

      // Filter based on target role
      const targeted = allActive.filter((ann: Announcement) => {
        if (!ann.is_active) return false;
        if (ann.target_role === 'all') return true;
        if (ann.target_role === 'admin' && isAdmin) return true;
        if (ann.target_role === 'engineering' && (isEngineering || isAdmin)) return true;
        if (ann.target_role === 'operator' && (!isEngineering && !isAdmin)) return true;
        return false;
      });

      setAnnouncements(targeted);

      // Check which ones have NOT been dismissed/read yet
      if (targeted.length > 0) {
        if (forceOpen) {
          setIsOpen(true);
        } else {
          const readIds: string[] = JSON.parse(localStorage.getItem(READ_ANNOUNCEMENTS_KEY) || '[]');
          const unread = targeted.filter((ann) => !readIds.includes(ann.id));
          
          if (unread.length > 0) {
            // Find index of first unread
            const firstUnreadIndex = targeted.findIndex((ann) => !readIds.includes(ann.id));
            setCurrentIndex(firstUnreadIndex >= 0 ? firstUnreadIndex : 0);
            
            // Trigger auto pop-up with a tiny graceful delay after dashboard mount
            const timer = setTimeout(() => {
              setIsOpen(true);
            }, 600);
            return () => clearTimeout(timer);
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching announcements:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [userRole, forceOpen]);

  const handleMarkAsRead = async (announcementId: string) => {
    // 1. Record in local cache to avoid immediate reprompt
    const readIds: string[] = JSON.parse(localStorage.getItem(READ_ANNOUNCEMENTS_KEY) || '[]');
    if (!readIds.includes(announcementId)) {
      readIds.push(announcementId);
      localStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify(readIds));
    }

    // 2. Persist to database (announcement_reads)
    try {
      const readerName = user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Staff');
      const readerEmail = user?.email || 'operator@stockflow.com';
      const readerRole = isAdmin ? 'admin' : isEngineering ? 'engineering' : 'operator';
      const readRecord = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `read-${Date.now()}`,
        announcement_id: announcementId,
        user_id: user?.id || 'u2',
        user_name: readerName,
        user_email: readerEmail,
        user_role: readerRole,
        read_at: new Date().toISOString()
      };

      // Check if this user already has a read entry for this announcement
      const { data: existing } = await supabase
        .from('announcement_reads')
        .select('id')
        .eq('announcement_id', announcementId)
        .eq('user_id', user?.id || 'u2');

      if (!existing || existing.length === 0) {
        await supabase.from('announcement_reads').insert([readRecord]);
      }
    } catch (err) {
      console.warn('Failed to record announcement read receipt:', err);
    }

    // Check if there are other announcements in list
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
          label: language === 'id' ? 'PERINGATAN' : 'WARNING',
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
          label: language === 'id' ? 'INFORMASI' : 'INFORMATION',
          glow: 'shadow-indigo-900/30'
        };
    }
  };

  const style = getTypeStyle(currentItem.type);
  const TypeIcon = style.icon;

  const getTargetLabel = (target: AnnouncementTarget) => {
    switch (target) {
      case 'all': return language === 'id' ? 'Semua Staf' : 'All Staff';
      case 'admin': return 'Super Admin';
      case 'engineering': return 'Engineering';
      case 'operator': return language === 'id' ? 'Gym Attendance' : 'Gym Attendance';
      default: return target;
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="announcement-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          id="announcement-modal-card"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`bg-[#121216] border ${style.headerBorder} rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh] my-auto`}
        >
          {/* Top Radial Glow Banner */}
          <div className={`absolute top-0 inset-x-0 h-36 bg-gradient-to-b ${style.gradientBg} pointer-events-none`} />

          {/* Modal Header */}
          <div className="relative p-6 sm:p-7 pb-4 flex items-start justify-between border-b border-white/5">
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-2xl border ${style.badgeBg} flex items-center justify-center shrink-0 shadow-lg relative`}>
                <TypeIcon size={24} className={style.accentColor} />
                {currentItem.type === 'urgent' && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                  </span>
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border ${style.badgeBg}`}>
                    {style.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 flex items-center gap-1">
                    <Shield size={10} className="text-slate-500" />
                    {getTargetLabel(currentItem.target_role)}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                  {currentItem.title}
                </h3>
              </div>
            </div>

            <button
              id="announcement-close-btn"
              onClick={handleDismiss}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all cursor-pointer shrink-0 ml-2"
              title={language === 'id' ? 'Tutup Sementara' : 'Dismiss'}
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body / Announcement Content */}
          <div className="relative p-6 sm:p-7 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
            <div className="bg-[#0b0b0e] border border-white/5 rounded-2xl p-4 sm:p-5 whitespace-pre-wrap selection:bg-indigo-500/30">
              {currentItem.content}
            </div>

            {/* Metadata Footer: Author & Timestamp */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 pt-1">
              <div className="flex items-center gap-1.5 font-medium">
                <User size={13} className="text-slate-500" />
                <span>{language === 'id' ? 'Diumumkan oleh' : 'Broadcasted by'}:</span>
                <span className="text-slate-200 font-bold">{currentItem.created_by || 'Super Administrator'}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-slate-400">
                <Calendar size={13} className="text-slate-500" />
                <span>
                  {new Date(currentItem.created_at).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Navigation Carousel Indicators if multiple announcements */}
            {announcements.length > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                  {language === 'id' ? `Pemberitahuan ${currentIndex + 1} dari ${announcements.length}` : `Notice ${currentIndex + 1} of ${announcements.length}`}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                    className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={currentIndex === announcements.length - 1}
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                    className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions Footer */}
          <div className="p-4 sm:p-6 bg-[#0e0e12] border-t border-white/5 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <button
              id="announcement-dismiss-later-btn"
              type="button"
              onClick={handleDismiss}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer text-center"
            >
              {language === 'id' ? 'Nanti Saja (Tutup)' : 'Remind Me Later'}
            </button>

            <button
              id="announcement-confirm-read-btn"
              type="button"
              onClick={() => handleMarkAsRead(currentItem.id)}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/40 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 size={16} />
              <span>{language === 'id' ? 'Saya Mengerti (Tandai Dibaca)' : 'I Understand (Acknowledge)'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
