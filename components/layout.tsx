'use client';

import { Package, LayoutDashboard, Box, History, Settings, LogOut, Search, User, ChevronRight, Menu, X as CloseIcon, WashingMachine, HelpCircle } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const router = useRouter();

  const isAuthPage = pathname.startsWith('/auth');

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };

  if (isAuthPage) {
    return <main className="min-h-screen bg-[#050505]">{children}</main>;
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown User';
  const userRole = user?.email?.includes('admin') ? 'Super Admin' : 'Gym Attendance';

  return (
    <div className="flex h-screen bg-[#0A0A0C] text-slate-300 font-sans overflow-hidden">
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-[#0F0F12] border-r border-white/5 z-50 lg:hidden flex flex-col p-6"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <Package size={20} className="text-white" />
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500">
                  <CloseIcon size={24} />
                </button>
              </div>
                <nav className="flex-1 space-y-2">
          <NavItem icon={LayoutDashboard} label="Dashboard" href="/" active={pathname === '/'} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem icon={Box} label="Inventory" href="/inventory" active={pathname === '/inventory'} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem icon={WashingMachine} label="Laundry Ops" href="/laundry" active={pathname === '/laundry'} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem icon={History} label="Transactions" href="/transactions" active={pathname === '/transactions'} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem icon={HelpCircle} label="User Guide" href="/guide" active={pathname === '/guide'} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem icon={Settings} label="System Config" href="/settings" active={pathname === '/settings'} onClick={() => setIsMobileMenuOpen(false)} />
        </nav>

                <div className="pt-6 border-t border-white/5">
                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex-shrink-0 flex items-center justify-center border border-slate-600/30 overflow-hidden">
                        <User size={18} className="text-slate-300" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-sm" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-bold text-white truncate">{userName}</p>
                      <p className="text-[10px] text-slate-500 truncate font-medium">{userRole}</p>
                    </div>
                    <button onClick={handleSignOut} className="p-1 hover:text-rose-400 transition-colors">
                      <LogOut size={14} />
                    </button>
                  </div>
                </div>
              </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar Navigation (Desktop) */}
      <aside className="w-68 border-r border-slate-900 bg-[#0F0F12] flex flex-col hidden lg:flex relative z-20">
        <div className="p-8 flex items-center gap-3">
          <motion.div 
            initial={{ rotate: -10, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            className="w-10 h-10 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-900/30 flex items-center justify-center border border-indigo-400/20"
          >
            <Package size={20} color="white" strokeWidth={2.5} />
          </motion.div>
          <div>
            <span className="font-bold text-white tracking-tight text-xl block leading-none">StockFlow</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 block">Obsidian 1</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-1">
          <NavItem icon={LayoutDashboard} label="Dashboard" href="/" active={pathname === '/'} />
          <NavItem icon={Box} label="Inventory" href="/inventory" active={pathname === '/inventory'} />
          <NavItem icon={WashingMachine} label="Laundry Ops" href="/laundry" active={pathname === '/laundry'} />
          <NavItem icon={History} label="Transactions" href="/transactions" active={pathname === '/transactions'} />
          <NavItem icon={HelpCircle} label="User Guide" href="/guide" active={pathname === '/guide'} />
          <NavItem icon={Settings} label="System Config" href="/settings" active={pathname === '/settings'} />
        </nav>
        
        <div className="p-6 border-t border-slate-900">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 group transition-all hover:bg-slate-800/50 cursor-pointer">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex-shrink-0 flex items-center justify-center border border-slate-600/30 overflow-hidden">
                <User size={18} className="text-slate-300" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-sm" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{userName}</p>
              <p className="text-[10px] text-slate-500 truncate font-medium">{userRole}</p>
            </div>
            <button onClick={handleSignOut} className="p-1 hover:text-rose-400 transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#1e1e2d44,transparent)] pointer-events-none" />
        
        {/* Header */}
        <header className="h-20 border-b border-slate-900 bg-[#0A0A0C]/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-10 z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-white transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-lg lg:text-xl font-bold text-white tracking-tight">StockFlow</h1>
              <p className="text-[10px] lg:text-xs text-slate-500 font-medium">Obsidian 1</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 lg:gap-6 flex-1 justify-end">
            {/* Header Actions Removed */}
          </div>
        </header>

        {/* Page Content */}
        <div className="px-4 py-6 sm:px-10 sm:py-10 flex-1 overflow-y-auto scroll-smooth">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, href, active = false, onClick }: { icon: any, label: string, href: string, active?: boolean, onClick?: () => void }) {
  return (
    <Link 
      href={href} 
      onClick={onClick}
      prefetch={false}
      className={`flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all group relative ${
        active 
          ? 'bg-indigo-600/10 text-white border border-indigo-500/20 shadow-sm' 
          : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-100'
      }`}
    >
      <Icon size={18} className={active ? 'text-indigo-400' : 'group-hover:text-slate-300'} />
      <span className={`text-sm font-bold ${active ? 'text-indigo-100' : 'font-medium'}`}>{label}</span>
      {active && (
        <motion.div 
          layoutId="sidebar-active"
          className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
        />
      )}
      <ChevronRight size={14} className={`ml-auto opacity-0 group-hover:opacity-100 transition-all ${active ? 'text-indigo-800' : 'text-slate-700'}`} />
    </Link>
  );
}
