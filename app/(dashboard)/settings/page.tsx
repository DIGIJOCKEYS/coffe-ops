'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Camera, KeyRound, Loader2, Phone, Save, User } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user || initialized) return;
    setName(user.fullName ?? user.firstName ?? '');

    // Phone disimpan di Supabase profiles, bukan di Clerk
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.phone) setPhone(data.phone);
      });

    setInitialized(true);
  }, [isLoaded, user, initialized]);

  if (!isLoaded) {
    return (
      <>
        <PageHeader title="Pengaturan Akun" description="Kelola informasi profil dan keamanan akun Anda." />
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat…
        </div>
      </>
    );
  }

  if (!user) return null;

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast({ title: 'Nama tidak boleh kosong', variant: 'destructive' });
      return;
    }
    setSavingProfile(true);
    try {
      const nameParts = name.trim().split(/\s+/);
      await user.update({
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' ') || undefined,
      });

      const supabase = createClient();
      await supabase
        .from('profiles')
        .update({ name: name.trim(), phone: phone.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      setInitialized(false);
      toast({ title: 'Profil berhasil disimpan' });
    } catch (err) {
      toast({
        title: 'Gagal menyimpan profil',
        description: err instanceof Error ? err.message : 'Coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 15) {
      toast({ title: 'Password minimal 15 karakter', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Konfirmasi password tidak cocok', variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    try {
      await user.updatePassword({ newPassword });
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password berhasil diubah' });
    } catch (err) {
      toast({
        title: 'Gagal mengubah password',
        description: err instanceof Error ? err.message : 'Coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Ukuran foto maksimal 5MB', variant: 'destructive' });
      return;
    }
    setSavingProfile(true);
    try {
      await user.setProfileImage({ file });
      toast({ title: 'Foto profil berhasil diperbarui' });
    } catch (err) {
      toast({
        title: 'Gagal mengunggah foto',
        description: err instanceof Error ? err.message : 'Coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const email = user.primaryEmailAddress?.emailAddress ?? '';
  const avatar = user.imageUrl;
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <>
      <PageHeader title="Pengaturan Akun" description="Kelola informasi profil dan keamanan akun Anda." />

      <div className="max-w-2xl space-y-6">

        {/* Avatar */}
        <div className="flex items-center gap-5 rounded-xl border border-line bg-white p-6 shadow-sm">
          {/* accept="image/*" tanpa capture agar user bisa pilih dari galeri ATAU kamera */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={savingProfile}
            className="group relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e00000] text-white ring-4 ring-[#e00000]/10 transition-opacity hover:opacity-90 disabled:opacity-60"
            aria-label="Ganti foto profil"
          >
            {avatar
              ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
              : <span className="text-2xl font-bold">{initials}</span>
            }
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </button>
          <div>
            <p className="font-semibold text-ink">{name || 'Pengguna'}</p>
            <p className="text-sm text-ink-muted">{email}</p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={savingProfile}
              className="mt-1.5 text-xs text-[#e00000] hover:underline disabled:opacity-50"
            >
              Ganti foto profil
            </button>
          </div>
        </div>

        {/* Informasi Profil — tanpa username (Clerk tidak mengizinkan update via API) */}
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-ink-muted" />
            <h2 className="font-semibold text-ink">Informasi Profil</h2>
          </div>
          <Separator className="mb-5" />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama lengkap"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled className="cursor-not-allowed opacity-60" />
              <p className="text-xs text-ink-muted">Email tidak dapat diubah dari sini.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                Nomor HP
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={phone || '+62812xxxxxxxx'}
                type="tel"
              />
              <p className="text-xs text-ink-muted">Nomor HP disimpan di profil Nestation.</p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-2">
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan Profil
              </Button>
            </div>
          </div>
        </div>

        {/* Ubah Password */}
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-ink-muted" />
            <h2 className="font-semibold text-ink">Ubah Password</h2>
          </div>
          <Separator className="mb-5" />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Password Baru</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 15 karakter"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Konfirmasi Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSavePassword}
                disabled={savingPassword || !newPassword}
                variant="outline"
                className="gap-2"
              >
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Ubah Password
              </Button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
