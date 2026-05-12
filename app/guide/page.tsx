'use client';

import { 
  LayoutDashboard, 
  Box, 
  WashingMachine, 
  History, 
  Settings, 
  Plus, 
  Search, 
  Filter, 
  Layers, 
  ArrowUpRight, 
  AlertCircle,
  CheckCircle2,
  Package,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

export default function UserGuidePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-16 pb-20">
      {/* Header */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-indigo-600/20 rounded-2xl border border-indigo-500/20">
            <Package size={24} className="text-indigo-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">StockFlow User Guide</h1>
        </div>
        <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
          Sistem manajemen inventaris Obsidian (StockFlow) dirancang untuk efisiensi maksimal dalam pelacakan aset, operasional laundry, dan audit transaksi.
        </p>
      </section>

      {/* Feature Sections */}
      <GuideSection 
        icon={LayoutDashboard} 
        title="Dashboard Intelligence" 
        color="text-emerald-400"
        description="Pusat kontrol utama untuk memantau kesehatan inventaris Anda secara real-time."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          <GuideCard 
            title="Key Metrics" 
            content="Lihat total SKU, barang stok rendah, nilai aset, dan aliran keluar bulanan dalam satu tampilan cepat." 
          />
          <GuideCard 
            title="Real-time Updates" 
            content="Dashboard diperbarui secara otomatis saat transaksi terjadi di gudang." 
          />
        </div>
      </GuideSection>

      <GuideSection 
        icon={Box} 
        title="Manajemen Inventaris" 
        color="text-blue-400"
        description="Kelola ribuan SKU dengan mudah menggunakan sistem tabel dan grid kami yang fleksibel."
      >
        <div className="space-y-6 mt-8">
          <div className="bg-slate-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <Plus size={18} className="text-indigo-400" />
              <p className="text-sm font-bold text-white uppercase tracking-wider">Tambah & Edit Produk</p>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Gunakan tombol &apos;Add Product&apos; untuk memasukkan SKU baru. Anda dapat mengatur jumlah stok minimal untuk mendapatkan alarm otomatis saat stok menipis.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
             <div className="flex-1 bg-slate-900/50 rounded-2xl p-5 border border-white/5 flex items-center gap-4">
                <Search size={20} className="text-slate-500" />
                <p className="text-xs font-medium text-slate-400">Pencarian SKU instan berdasarkan nama atau ID.</p>
             </div>
             <div className="flex-1 bg-slate-900/50 rounded-2xl p-5 border border-white/5 flex items-center gap-4">
                <Filter size={20} className="text-slate-500" />
                <p className="text-xs font-medium text-slate-400">Filter berdasarkan kategori untuk navigasi cepat.</p>
             </div>
          </div>
        </div>
      </GuideSection>

      <GuideSection 
        icon={WashingMachine} 
        title="Operasional Laundry" 
        color="text-amber-400"
        description="Fitur khusus untuk melacak linen atau alat yang perlu dibersihkan secara reguler."
      >
        <div className="bg-[#111114] rounded-3xl p-8 border border-white/5 relative overflow-hidden mt-8">
           <div className="absolute top-0 right-0 p-8 opacity-5">
              <WashingMachine size={120} />
           </div>
           <ul className="space-y-4 relative z-10">
              <li className="flex items-start gap-3">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                <p className="text-sm text-slate-300"><span className="font-bold text-white">Sent:</span> Catat barang saat dikirim ke pihak laundry.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-sm text-slate-300"><span className="font-bold text-white">Returned:</span> Verifikasi saat barang kembali dan sistem akan otomatis memperbarui stok gudang.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <p className="text-sm text-slate-300"><span className="font-bold text-white">Cost Tracking:</span> Pantau pengeluaran operasional laundry per batch.</p>
              </li>
           </ul>
        </div>
      </GuideSection>

      <GuideSection 
        icon={History} 
        title="Audit Trail & Transaksi" 
        color="text-rose-400"
        description="Transparansi total untuk setiap pergerakan barang dalam inventaris Anda."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
           <div className="bg-rose-500/5 p-6 rounded-2xl border border-rose-500/10">
              <p className="text-xl font-black text-rose-400 mb-2">01</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Stock In</p>
              <p className="text-xs text-slate-400">Penambahan stok baru atau pengembalian dari laundry.</p>
           </div>
           <div className="bg-indigo-500/5 p-6 rounded-2xl border border-indigo-500/10">
              <p className="text-xl font-black text-indigo-400 mb-2">02</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Stock Out</p>
              <p className="text-xs text-slate-400">Pengurangan stok untuk penggunaan operasional.</p>
           </div>
           <div className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/10">
              <p className="text-xl font-black text-emerald-400 mb-2">03</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Operator ID</p>
              <p className="text-xs text-slate-400">Setiap perubahan mencatat siapa yang melakukan aksi tersebut.</p>
           </div>
        </div>
      </GuideSection>

      {/* Quick Tips */}
      <section className="bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-20 rotate-12">
            <CheckCircle2 size={160} />
        </div>
        <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-6 italic tracking-tight">Pro Tips for Efficiency</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                   <h4 className="text-sm font-black uppercase tracking-[0.2em] mb-2 text-indigo-200">Alerts</h4>
                   <p className="text-sm text-indigo-100 leading-relaxed">Selalu atur &apos;Min Stock&apos; pada setiap produk agar sistem memberi tanda merah saat stok kritis.</p>
                </div>
                <div>
                   <h4 className="text-sm font-black uppercase tracking-[0.2em] mb-2 text-indigo-200">View Toggle</h4>
                   <p className="text-sm text-indigo-100 leading-relaxed">Gunakan mode &apos;Grid&apos; untuk inspeksi visual dan mode &apos;Table&apos; untuk manajemen data massal.</p>
                </div>
            </div>
        </div>
      </section>

      {/* Footer support */}
      <footer className="text-center py-10">
         <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.4em]">End of Instruction Protocol</p>
         <p className="text-slate-500 mt-2 text-sm italic">Butuh bantuan lebih lanjut? Hubungi Super Admin sistem.</p>
      </footer>
    </div>
  );
}

function GuideSection({ icon: Icon, title, children, color, description }: { icon: any, title: string, children: React.ReactNode, color: string, description: string }) {
  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative"
    >
      <div className="flex items-center gap-3 mb-2">
        <Icon className={color} size={20} />
        <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
      </div>
      <p className="text-slate-500 text-sm mb-6">{description}</p>
      {children}
    </motion.section>
  );
}

function GuideCard({ title, content }: { title: string, content: string }) {
  return (
    <div className="p-6 bg-slate-900/30 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">{title}</h4>
        <ChevronRight size={14} className="text-slate-700 group-hover:text-indigo-400 transition-colors" />
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{content}</p>
    </div>
  );
}
