# Nestation — Coffee Operations & Inventory System

Sistem manajemen operasional dan inventaris internal modern untuk jaringan kedai kopi **Nestation**, dibangun dengan fokus pada keakuratan pembukuan, pelacakan stok multi-lokasi, keamanan berbasis peran (RBAC), dan sinkronisasi data real-time.

---

## 🚀 Fitur Utama

### 1. Multi-Location Stock Tracking (Gudang & Outlet)
- **Pemisahan Stok**: Stok gudang dan stok outlet dicatat secara terpisah dan transparan.
- **Mutasi Stok (Stock Movement)**:
  - Transfer stok dari gudang utama ke outlet dengan pencatatan nilai modal (HPP transfer).
  - Pencatatan kerusakan/tumpah (*waste*) di outlet yang otomatis mengkalkulasi nilai kerugian dan membukukan pengeluaran kategori **Kerugian Stok**.
  - Wajib melampirkan foto bukti fisik dengan kompresi thumbnail otomatis di browser.
- **Stock Opname**: Rekonsiliasi berkala antara stok tercatat di sistem dengan hitungan fisik riil di gudang atau outlet, dilengkapi log audit selisih otomatis.

### 2. Penjualan Shift & Kasir
- **Pencatatan Berdasarkan Shift**: Shift Pagi–Siang dan Siang–Sore.
- **Otomatisasi Stok**: Setiap transaksi penjualan langsung mengurangi saldo stok outlet terkait secara atomik melalui transaksi database Supabase.
- **Integritas Data**: Mengubah atau membatalkan penjualan otomatis memulihkan saldo stok outlet secara presisi.

### 3. Pengeluaran & Finansial
- **Kategori Terstruktur**: Pembelian Stok, Operasional, Kerugian Stok, dan Lainnya.
- **Restock Otomatis**: Penambahan stok gudang otomatis membukukan pengeluaran *Pembelian Stok*.
- **Foto Nota / Kuitansi**: Dilengkapi penampil foto dan thumbnail ringkas.
- **Ringkasan Finansial Realtime**: Omzet, Estimasi HPP, Biaya Kerugian, Biaya Operasional, dan Estimasi Laba Bersih.

### 4. Laporan & Ekspor Excel Profesional
- Dashboard interaktif dengan grafik penjualan 7 hari terakhir dan 6 bulan terakhir via Recharts.
- Ekspor spreadsheet berformat resmi (`.xlsx`) multi-sheet (Ringkasan, Penjualan per Shift, Pengeluaran, Stok & Menu, Menu Terlaris, dan Kerugian Stok) menggunakan **ExcelJS**.

### 5. Keamanan & Role-Based Access Control (RBAC)
- **Admin / Pemilik**: Akses penuh ke seluruh data keuangan, analitik, pengaturan stok gudang, stock opname, laporan laba/rugi, dan manajemen pengguna.
- **Staff / Barista**: Tampilan terfokus untuk input operasional (mutasi stok, pelaporan kerusakan, penjualan shift, pengeluaran operasional outlet).
- **Aktivasi Pengguna**: Setiap pendaftar baru berstatus non-aktif secara default sampai diverifikasi dan diaktifkan oleh Admin aktif, mencegah akses tidak sah.
- **Perlindungan Admin Terakhir**: Sistem secara otomatis mengunci status agar Admin aktif terakhir tidak dapat dinonaktifkan secara sengaja maupun tidak sengaja.
- **Audit Log Lengkap**: Seluruh aktivitas krusial dicatat di tabel audit dengan detail JSON terstruktur.
- **Notifikasi Real-time**: Lonceng notifikasi dengan pembaruan instan aktivitas tim melalui Supabase Realtime.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Components & Client Components)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/) (Strict Type Checking)
- **Styling**: [Tailwind CSS 3](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/) (Radix UI Primitives)
- **Authentication**: [Clerk](https://clerk.com/) (OAuth Google + Email/Password + Session Middleware)
- **Database**: [Supabase PostgreSQL](https://supabase.com/) (Stored Procedures, Triggers, RLS, Realtime)
- **Visualisasi & Reporting**: [Recharts](https://recharts.org/) & [ExcelJS](https://github.com/exceljs/exceljs)
- **Iconography**: [Lucide React](https://lucide.dev/)

---

## 📁 Struktur Direktori

```text
coffe-ops/
├── app/
│   ├── (dashboard)/            # Route dashboard dengan DashboardShell & RoleGuard
│   │   ├── audit-logs/         # Linimasa audit aktivitas pengguna
│   │   ├── dashboard/          # Beranda KPI harian & grafik penjualan
│   │   ├── expenses/           # Manajemen pengeluaran & upload bukti
│   │   ├── reports/            # Laporan keuangan & stok
│   │   ├── sales/              # Pencatatan & riwayat penjualan per shift
│   │   ├── stock/              # Manajemen master stok & katalog menu
│   │   ├── stock-opname/       # Hitung fisik stok gudang & outlet
│   │   ├── stock-takes/        # Mutasi transfer & kerugian barang
│   │   ├── users/              # Manajemen akun & aktivasi pengguna (Admin)
│   │   └── [slug]/             # Dynamic placeholder modul
│   ├── login/                  # Redirect route ke /sign-in
│   ├── sign-in/                # Custom Clerk Sign In page bermerek Nestation
│   ├── sign-up/                # Custom Clerk Sign Up page dengan verifikasi email
│   ├── sso-callback/           # Clerk OAuth callback handler
│   ├── globals.css             # Konfigurasi Tailwind, tokens warna, & Dark Mode
│   └── layout.tsx              # Root layout dengan Clerk & Theme Provider
├── components/
│   ├── dashboard/              # Widget KPI cards, grafik, & activity list
│   ├── layout/                 # Navbar, Sidebar, RoleContext, RoleGuard, Theme
│   ├── reports/                # Toolbar cetak & export Excel
│   ├── shared/                 # CardShell, DataState, DateRangeFilter, TablePagination
│   ├── stock/                  # Form modal & sheet detail item
│   └── ui/                     # Komponen UI dasar berbasis Radix UI
├── hooks/
│   ├── use-pagination.ts       # Hook paginasi client-side
│   ├── use-supabase-query.ts   # Data fetching hook dengan loading & error state
│   ├── use-supabase-realtime.ts# Subscription postgres_changes Supabase
│   └── use-toast.ts            # Notifikasi toast sonner
├── lib/
│   ├── export-report.ts        # Generator file Excel multi-sheet (.xlsx)
│   ├── format.ts               # Formatter mata uang Rupiah & angka
│   ├── metrics.ts              # Rumus agregasi omzet, HPP, & estimasi laba
│   ├── nav-config.ts           # Definisi navigasi & izin akses per role
│   ├── operations-data.ts      # Data access layer ke Supabase (CRUD & RPC)
│   ├── stock.ts                # Penentuan status ketersediaan stok
│   └── supabase/               # Inisialisasi client browser & server
├── public/                     # Asset grafis (logo, background, favicon)
├── supabase/
│   ├── schema.sql              # Master database schema lengkap (DDL, Functions, Triggers, RLS)
│   └── *.sql                   # Arsip migrasi inkremental
├── middleware.ts               # Clerk route protection & security matcher
├── next.config.js              # Optimasi Next.js bundle & images
└── package.json
```

---

## ⚙️ Persiapan & Instalasi

### 1. Prasyarat
- **Node.js**: Versi `>= 18.18.0` (disarankan Node.js 20 LTS)
- **NPM**: Versi `>= 9.0.0`
- Akun **Supabase** (Database PostgreSQL gratis/berbayar)
- Akun **Clerk** (Autentikasi gratis/berbayar)

### 2. Kloning & Install Dependencies
```bash
git clone <repository-url>
cd coffe-ops
npm install
```

### 3. Konfigurasi Environment Variables
Salin template `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Isi variabel pada `.env.local`:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Clerk Authentication Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
```

> [!IMPORTANT]
> Jangan pernah meng-commit file `.env.local` atau kredensial rahasia apa pun ke dalam repository Git. File `.env*.local` telah dimasukkan ke dalam `.gitignore`.

---

## 🗄️ Setup Database Supabase

1. Buka dashboard project Anda di [Supabase Dashboard](https://supabase.com/dashboard).
2. Masuk ke menu **SQL Editor**.
3. Buka file `supabase/schema.sql` pada repository ini, salin seluruh kodenya, dan tempelkan ke SQL Editor Supabase.
4. Klik **Run**. Skrip akan:
   - Membuat seluruh tabel utama (`profiles`, `stock_items`, `shift_sales`, `sales_lines`, `expenses`, `expense_totals`, `stock_takes`, `audit_entries`, `audit_entry_reads`, `daily_inventory_snapshots`).
   - Mendaftarkan fungsi bisnis atomik: `save_stock_item_with_expense`, `record_shift_sale`, `record_stock_movement`, `get_inventory_snapshot`, `get_expense_summary`, `set_profile_active`, dan manajemen notifikasi.
   - Mengaktifkan Row Level Security (RLS) serta trigger integritas data.
   - Mengaktifkan publikasi `supabase_realtime` untuk sinkronisasi instan ke frontend.

---

## 🔒 Konfigurasi Autentikasi Clerk

1. Buka dashboard aplikasi Anda di [Clerk Dashboard](https://dashboard.clerk.com/).
2. Di menu **User & Authentication > Email, Phone, Username**:
   - Aktifkan **Email address** (Verifikasi via Kode Email).
   - Nonaktifkan pendaftaran bebas jika ingin sistem sepenuhnya tertutup, atau gunakan alur aktivasi admin default Nestation.
3. Di menu **User & Authentication > Social Connections**:
   - Aktifkan **Google** jika ingin mengizinkan Sign In dengan akun Google perusahaan.
4. Pada akun pertama yang mendaftar di sistem Nestation:
   - Sistem secara otomatis menetapkan role **Admin** dan status **Aktif** untuk pendaftar pertama (inisialisasi pemilik).
   - Pengguna berikutnya yang mendaftar akan mendapatkan role **Staff** dengan status **Nonaktif**, dan memerlukan aktivasi oleh Admin melalui menu **Pengguna**.

---

## 💻 Menjalankan di Lingkungan Pengembangan

Jalankan perintah berikut untuk memulai server lokal:
```bash
npm run dev
```

Buka peramban di [http://localhost:3000](http://localhost:3000). Aplikasi akan mengarahkan ke halaman login `/sign-in`.

### Verifikasi Kualitas Kode
```bash
# Pemeriksaan tipe TypeScript
npm run typecheck

# Pemeriksaan linter ESLint
npm run lint

# Pengujian build produksi
npm run build
```

---

## 🚀 Panduan Deployment

### Deployment ke Vercel (Disarankan)
1. Hubungkan repository GitHub ke [Vercel](https://vercel.com/).
2. Masukkan seluruh environment variables yang ada di `.env.example` pada pengaturan **Environment Variables** di Vercel Dashboard.
3. Biarkan framework preset terdeteksi otomatis sebagai **Next.js**.
4. Klik **Deploy**.

### Deployment ke Netlify
Project ini sudah dilengkapi konfigurasi `netlify.toml` dan `@netlify/plugin-nextjs`.
1. Hubungkan repository GitHub ke [Netlify](https://www.netlify.com/).
2. Tambahkan environment variables yang diperlukan di Netlify Site Settings.
3. Build command: `npm run build`
4. Publish directory: `.next`

---

## 📄 Lisensi & Hak Cipta

© 2026 Nestation Coffee. Hak cipta dilindungi undang-undang. Sistem operasional internal.

