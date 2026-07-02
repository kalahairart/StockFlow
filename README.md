# 📦 StockFlow WMS (Warehouse Management System)

StockFlow adalah sistem manajemen inventaris dan pergudangan modern (*Warehouse Management System*) berbasis **Next.js 15+ App Router**, **Supabase**, dan **Tailwind CSS**. Sistem ini dirancang untuk melacak sisa stok unit, mengelola siklus operasional *laundry* pencucian (linen/pakaian), melacak log transaksi pergudangan secara *real-time*, serta terintegrasi langsung dengan **Telegram Bot** untuk pemberitahuan alarm instan dan kueri interaktif.

---

## 🚀 Fitur Utama & Kemampuan Sistem

### 1. 📊 Dashboard Ringkasan & Metrik Inventaris
*   **Aset Real-time:** Menampilkan visualisasi total jenis SKU, sisa unit fisik di gudang, jumlah barang dengan stok kritis (di bawah batas minimal), dan total estimasi nilai aset dalam **Rupiah (IDR)**.
*   **Grafik Tren & Arus Barang:** visualisasi sirkulasi barang masuk (*inflow*) dan keluar (*outflow*) untuk menganalisis siklus barang secara berkala.

### 2. 📦 Modul Inventaris & Kontrol Stok (*Safety Stock*)
*   **Multi-Kategori Produk:** Kelola produk berdasarkan kategori, ID SKU unik, dan deskripsi lengkap.
*   **Ambang Batas Minimum (*Min Stock Alert*):** Fitur pencegahan kehabisan stok (*stockout*) dengan memberikan tanda peringatan warna jingga/merah apabila unit fisik berada di bawah batas keamanan (*safety stock*).
*   **Manajemen Mutasi Stok:** Kemudahan melakukan penyesuaian stok (*restock* atau *outgoing*) secara instan lewat jendela pop-up interaktif lengkap dengan catatan operator dan biaya unit.

### 3. 🧺 Operasional & Manajemen Sirkulasi Laundry
*   **Pelacakan Laundry Linen:** Alur kerja khusus untuk mengirim barang kotor ke vendor laundry, mencatat status pengerjaan (*sent, processing, ready, returned*), jumlah kuantitas keluar/masuk, sisa unit yang belum kembali, hingga estimasi biaya operasional cucian.
*   **Akuntabilitas Operator:** Mencatat operator yang bertanggung jawab atas pengiriman dan penerimaan cucian kembali ke gudang pusat.

### 4. 🤖 Integrasi Asisten Bot Telegram & Webhook
*   **Interaksi Dua Arah:** Kueri basis data langsung dari aplikasi Telegram menggunakan perintah bot kustom:
    *   `/stok` – Ringkasan instan seluruh isi gudang & nilai valuasi aset (Rupiah).
    *   `/kosong` – Menampilkan seluruh item yang habis total (stok = 0).
    *   `/tipis` – Daftar barang yang mendekati batas keamanan stok minimum.
    *   `/cari [nama_barang]` – Mencari unit barang spesifik di sistem secara dinamis.
    *   `/laundry` – Menampilkan rangkuman pakaian/linen yang sedang diproses di laundry.
    *   `/myid` – Mengambil Chat ID pengguna secara instan untuk tujuan set-up.
*   **Registrasi Webhook Sekali Klik:** Panel pengaturan dilengkapi tombol pintas untuk mendaftarkan URL *webhook* secara dinamis ke server Telegram API serta tombol uji coba (*Send Test Notification*).

### 5. 🛡️ Sistem Otoritas & Kontrol Akses Admin (*Role-based Auth*)
*   **Sistem Proteksi Lapis Ganda:** Halaman pengaturan sistem utama sensitif (seperti konfigurasi tautan bot Telegram) diamankan menggunakan *role-based access control* (RBAC). 
*   **Guard Clause Admin:** Hanya pengguna dengan peran **Admin** yang diizinkan memodifikasi atau melihat konfigurasi tingkat tinggi, sedangkan pengguna dengan peran biasa akan dialihkan dengan tampilan akses ditolak demi keamanan operasional.

### 6. 🌐 Dual Bahasa & Sentuhan Desain Premium
*   **Multilingual:** Mendukung perpindahan bahasa secara dinamis antara **Bahasa Indonesia** dan **English** untuk seluruh antarmuka.
*   **Desain Modern Minimalis (Dark Theme):** Mengusung tema malam *Midnight Slate* dengan porsi ruang negatif (*negative space*) yang seimbang, sudut membulat elegan (*rounded layouts*), ikon dari *Lucide React*, serta transisi animasi mikro yang halus menggunakan *Framer Motion*.
*   **Mata Uang Rupiah (IDR):** Seluruh laporan biaya, estimasi nilai aset, harga satuan, dan pengeluaran laundry telah dikonfigurasi penuh menggunakan penulisan rupiah standar `Rp`.

---

## 🛠️ Arsitektur Teknologi (Tech Stack)

*   **Frontend & Framework:** [Next.js 15+](https://nextjs.org/) (React, App Router, TypeScript, Server Components)
*   **Styling & UI:** [Tailwind CSS v4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/) (Animations), [Lucide React](https://lucide.dev/) (Icons)
*   **Database & Backend-as-a-Service:** [Supabase](https://supabase.com/) (PostgreSQL database client)
*   **Notifikasi & Komunikasi:** Telegram Bot API (via Dynamic Webhooks & HTTP Fetch)
*   **State & Form Handling:** React Hook Form & Zod Validation

---

## ⚙️ Variabel Lingkungan (.env)

Buat file `.env.local` di direktori utama proyek Anda dan isi variabel berikut:

```env
# Koneksi Supabase Backend
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key

# Integrasi Telegram Bot (Gunakan bot dari @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_api_token
TELEGRAM_CHAT_ID=your_telegram_chat_id_for_notifications
