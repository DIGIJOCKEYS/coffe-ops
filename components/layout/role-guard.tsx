'use client';

import type { ReactNode } from 'react';
import { Lock, PhoneCall, ShieldOff } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/layout/role-context';
import { canAccess, findNavItem } from '@/lib/nav-config';

export function RoleGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, profile, loading, error, signOut } = useAuth();

  // ── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-[#e00000]" />
      </div>
    );
  }

  // ── Error memuat profil ────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-lg font-semibold text-foreground">Profil belum dapat dimuat</h1>
        <p className="max-w-lg text-sm text-muted-foreground">{error}</p>
        <p className="max-w-lg text-sm text-muted-foreground">
          Periksa koneksi Supabase dan kebijakan akses tabel profiles, lalu muat ulang halaman.
        </p>
      </div>
    );
  }

  // ── Akun non-aktif ─────────────────────────────────────────────
  if (profile && !profile.isActive) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        {/* Ikon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
          <ShieldOff className="h-10 w-10 text-[#e00000]" />
        </div>

        {/* Pesan utama */}
        <h1 className="mt-6 text-2xl font-bold text-foreground">Akun Anda belum aktif</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Akun <span className="font-semibold text-foreground">{profile.name}</span> berhasil terdaftar,
          namun belum diaktifkan oleh Admin / Pemilik Nestation.
        </p>

        {/* Instruksi */}
        <div className="mt-6 w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-left shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e00000]/10">
              <PhoneCall className="h-4 w-4 text-[#e00000]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Langkah selanjutnya</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Silahkan hubungi Admin atau Pemilik Nestation untuk mengaktifkan akun Anda.
                Setelah diaktifkan, masuk kembali untuk mengakses sistem.
              </p>
            </div>
          </div>
        </div>

        {/* Tombol keluar */}
        <Button
          variant="outline"
          className="mt-6 gap-2"
          onClick={signOut}
        >
          <Lock className="h-4 w-4" />
          Keluar dari akun ini
        </Button>
      </div>
    );
  }

  // ── Akses role tidak cukup ─────────────────────────────────────
  const item = findNavItem(pathname);
  if (item && !canAccess(role, item)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e00000]/10 text-[#e00000]">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-semibold text-foreground">Akses dibatasi</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Halaman ini hanya tersedia untuk Admin / Pemilik.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
