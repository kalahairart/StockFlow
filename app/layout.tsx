import type { Metadata } from 'next';
import './globals.css';
import AppLayout from '@/components/layout';
import { AuthProvider } from '@/hooks/use-auth';
import { AuthGuard } from '@/components/auth-guard';

export const metadata: Metadata = {
  title: 'StockFlow Obsidian 1',
  description: 'Logistics Asset Control Mesh',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body suppressHydrationWarning>
        <AuthProvider>
          <AuthGuard>
            <AppLayout>{children}</AppLayout>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
