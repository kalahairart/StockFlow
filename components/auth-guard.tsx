'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      const isAuthPage = pathname.startsWith('/auth');
      
      if (!user && !isAuthPage) {
        router.push('/auth/login');
      } else if (user && isAuthPage) {
        router.push('/');
      }
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em] animate-pulse">Initializing Security Mesh</p>
        </div>
      </div>
    );
  }

  // If not logged in and not on auth page, we show nothing (pre-redirect)
  if (!user && !pathname.startsWith('/auth')) {
    return null;
  }

  return <>{children}</>;
}
