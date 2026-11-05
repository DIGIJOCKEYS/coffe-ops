'use client';

import { useSignIn } from '@clerk/nextjs';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

function NestationLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" aria-hidden>
        <circle cx="18" cy="18" r="18" fill="#e00000" />
        <ellipse cx="18" cy="18" rx="10" ry="7" fill="#ff6b00" transform="rotate(-30 18 18)" />
        <ellipse cx="18" cy="18" rx="6" ry="3.5" fill="#e00000" transform="rotate(-30 18 18)" />
        <ellipse cx="14" cy="14" rx="4" ry="2.5" fill="#ffa500" opacity="0.7" transform="rotate(-30 14 14)" />
      </svg>
      <span className="text-lg font-black tracking-widest text-white uppercase select-none">Nestation</span>
    </div>
  );
}

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true); setError(null);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push('/dashboard');
      } else {
        // Show exact status so we can debug
        setError(`Login status: "${result.status}" — tolong screenshot ini dan kirim ke developer.`);
      }
    } catch (cause) {
      setError(isClerkAPIResponseError(cause)
        ? (cause.errors[0]?.longMessage ?? cause.errors[0]?.message ?? 'Login gagal.')
        : 'Terjadi kesalahan. Silakan coba lagi.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[58%_42%]">

      {/* ══ KIRI — foto + brand (desktop) ════════════════════════════ */}
      <div className="relative hidden lg:flex flex-col">
        <Image
          src="/nestation-bg.png" alt="Nestation booth" fill priority sizes="58vw"
          className="object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/80" />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <NestationLogo />
          <div className="space-y-4">
            <span className="inline-block rounded-full border border-white/25 bg-white/10 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-white/90 backdrop-blur-sm">
              Sistem Operasional Internal
            </span>
            <h2 className="text-4xl font-black leading-[1.15] text-white drop-shadow-lg xl:text-5xl">
              More Than Shipping,<br />
              <span className="text-[#ffb300]">More Possibilities.</span>
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-white/65">
              Kelola stok, shift, pengeluaran, dan laporan keuangan Nestation dalam satu platform terpadu.
            </p>
          </div>
          <p className="text-xs text-white/25">© {new Date().getFullYear()} Nestation. All rights reserved.</p>
        </div>
      </div>

      {/* ══ KANAN — form panel ═══════════════════════════════════════ */}
      {/*
        bg-white dark:bg-[#111520]  — panel utama ikut dark mode
      */}
      <div className="flex min-h-screen flex-col bg-white dark:bg-[#111520] lg:min-h-0">

        {/* Mobile header merah */}
        <div className="flex items-center bg-[#e00000] px-6 py-4 lg:hidden">
          <NestationLogo />
        </div>

        {/* Mobile hero foto */}
        <div className="relative h-40 overflow-hidden lg:hidden">
          <Image src="/nestation-bg.png" alt="Nestation" fill priority className="object-cover object-[center_40%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-[#111520]" />
        </div>

        {/* Form */}
        <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10 lg:py-0">
          <div className="w-full max-w-[380px]">

            {/* Heading */}
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Selamat datang kembali
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Masuk untuk mengakses dashboard operasional.
              </p>
            </div>

            {/* Form fields */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email */}
              <div>
                <label htmlFor="email"
                  className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Email
                </label>
                <input
                  id="email" type="email" autoComplete="email" placeholder="nama@email.com"
                  value={email} onChange={e => { setEmail(e.target.value); setError(null); }} required
                  className="h-12 w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition
                    focus:border-[#e00000] focus:bg-white focus:shadow-[0_0_0_4px_rgba(224,0,0,0.1)]
                    dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-gray-500
                    dark:focus:border-[#f03020] dark:focus:bg-white/8 dark:focus:shadow-[0_0_0_4px_rgba(240,48,32,0.15)]"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password"
                  className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                    placeholder="••••••••••••••••" value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }} required
                    className="h-12 w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 pr-12 text-sm text-gray-900 outline-none transition
                      focus:border-[#e00000] focus:bg-white focus:shadow-[0_0_0_4px_rgba(224,0,0,0.1)]
                      dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-gray-500
                      dark:focus:border-[#f03020] dark:focus:bg-white/8 dark:focus:shadow-[0_0_0_4px_rgba(240,48,32,0.15)]"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700
                  dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                  <span className="mt-px text-base leading-none">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading || !isLoaded}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e00000] text-sm font-bold text-white
                  shadow-lg shadow-red-200 transition-all hover:bg-[#c00000] active:scale-[0.98] disabled:opacity-60
                  dark:shadow-red-900/30 dark:hover:bg-[#cc0000]">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Memproses…</> : 'Masuk →'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Belum punya akun?{' '}
              <Link href="/sign-up" className="font-bold text-[#e00000] hover:underline dark:text-red-400">
                Daftar sekarang
              </Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
