'use client';

import { useSignUp } from '@clerk/nextjs';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';

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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

/* Reusable styled input */
const inputCls =
  'h-12 w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition ' +
  'focus:border-[#e00000] focus:bg-white focus:shadow-[0_0_0_4px_rgba(224,0,0,0.1)] ' +
  'dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-gray-500 ' +
  'dark:focus:border-[#f03020] dark:focus:bg-white/8 dark:focus:shadow-[0_0_0_4px_rgba(240,48,32,0.15)]';

const labelCls = 'mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200';

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [firstName, setFirstName]       = useState('');
  const [lastName, setLastName]         = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [step, setStep]                 = useState<'form' | 'verify'>('form');
  const [code, setCode]                 = useState('');
  const [verifying, setVerifying]       = useState(false);

  const pwStrength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 15 ? 2 : 3;
  const pwBarColor  = ['', 'bg-red-400', 'bg-amber-400', 'bg-green-500'][pwStrength];
  const pwLabel     = ['', 'Lemah', 'Sedang', 'Kuat'][pwStrength];
  const pwTextColor = ['', 'text-red-400', 'text-amber-500', 'text-green-500'][pwStrength];

  const handleGoogle = async () => {
    if (!isLoaded) return;
    setGoogleLoading(true); setError(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/dashboard',
      });
    } catch (cause) {
      setError(isClerkAPIResponseError(cause) ? (cause.errors[0]?.longMessage ?? 'Gagal.') : 'Terjadi kesalahan.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    if (password.length < 15) { setError('Kata sandi minimal 15 karakter.'); return; }
    setLoading(true); setError(null);
    try {
      await signUp.create({
        firstName: firstName.trim(), lastName: lastName.trim(),
        emailAddress: email.trim(), password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (cause) {
      setError(isClerkAPIResponseError(cause) ? (cause.errors[0]?.longMessage ?? 'Pendaftaran gagal.') : 'Terjadi kesalahan.');
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setVerifying(true); setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push('/dashboard');
      } else {
        setError('Verifikasi belum selesai. Coba masukkan kode kembali.');
      }
    } catch (cause) {
      setError(isClerkAPIResponseError(cause) ? (cause.errors[0]?.longMessage ?? 'Verifikasi gagal.') : 'Terjadi kesalahan.');
    } finally { setVerifying(false); }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[58%_42%]">

      {/* ══ KIRI — brand panel ════════════════════════════════════════ */}
      <div className="relative hidden lg:flex flex-col">
        <Image src="/nestation-bg.png" alt="Nestation" fill priority sizes="58vw" className="object-cover object-[center_30%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/80" />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <NestationLogo />
          <div className="space-y-4">
            <span className="inline-block rounded-full border border-white/25 bg-white/10 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-white/90 backdrop-blur-sm">
              Sistem Operasional Internal
            </span>
            <h2 className="text-4xl font-black leading-[1.15] text-white xl:text-5xl">
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
      <div className="flex min-h-screen flex-col bg-white dark:bg-[#111520] lg:min-h-0">

        {/* Mobile header */}
        <div className="flex items-center bg-[#e00000] px-6 py-4 lg:hidden">
          <NestationLogo />
        </div>

        {/* Mobile hero */}
        <div className="relative h-36 overflow-hidden lg:hidden">
          <Image src="/nestation-bg.png" alt="Nestation" fill priority className="object-cover object-[center_40%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white dark:to-[#111520]" />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10 lg:py-0">
          <div className="w-full max-w-[380px]">

            {step === 'form' ? (
              <>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Buat akun baru ✨</h1>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Daftar untuk mengakses sistem Nestation.</p>
                </div>

                {/* Google */}
                <button type="button" onClick={handleGoogle} disabled={googleLoading || !isLoaded}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-gray-200 bg-white px-4 py-3.5 text-sm font-semibold text-gray-700 shadow-sm transition-all
                    hover:border-gray-300 hover:shadow-md active:scale-[0.98] disabled:opacity-60
                    dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/20 dark:hover:bg-white/10">
                  {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                  {googleLoading ? 'Menghubungkan…' : 'Daftar dengan Google'}
                </button>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500">atau isi form di bawah</span>
                  <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Nama */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Nama depan</label>
                      <input value={firstName} onChange={e => setFirstName(e.target.value)} required
                        placeholder="Budi" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Nama belakang</label>
                      <input value={lastName} onChange={e => setLastName(e.target.value)}
                        placeholder="Santoso" className={inputCls} />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className={labelCls}>Email</label>
                    <input id="email" type="email" autoComplete="email" placeholder="nama@email.com"
                      value={email} onChange={e => { setEmail(e.target.value); setError(null); }} required
                      className={inputCls} />
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className={labelCls}>Kata Sandi</label>
                    <div className="relative">
                      <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                        placeholder="Min. 15 karakter" value={password}
                        onChange={e => { setPassword(e.target.value); setError(null); }} required
                        className={`${inputCls} pr-12`} />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                        aria-label={showPassword ? 'Sembunyikan' : 'Tampilkan'}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Strength bar */}
                    {password.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex flex-1 gap-1">
                          {[1, 2, 3].map(i => (
                            <div key={i}
                              className={`h-1.5 flex-1 rounded-full transition-all ${i <= pwStrength ? pwBarColor : 'bg-gray-200 dark:bg-white/10'}`} />
                          ))}
                        </div>
                        <span className={`text-xs font-semibold ${pwTextColor}`}>{pwLabel}</span>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Minimal 15 karakter.</p>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700
                      dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                      <span className="mt-px">⚠</span><span>{error}</span>
                    </div>
                  )}

                  <button type="submit" disabled={loading || !isLoaded}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e00000] text-sm font-bold text-white
                      shadow-lg shadow-red-200 transition-all hover:bg-[#c00000] active:scale-[0.98] disabled:opacity-60
                      dark:shadow-red-900/30 dark:hover:bg-[#cc0000]">
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Memproses…</> : 'Buat Akun →'}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Sudah punya akun?{' '}
                  <Link href="/sign-in" className="font-bold text-[#e00000] hover:underline dark:text-red-400">
                    Masuk di sini
                  </Link>
                </p>
              </>
            ) : (
              /* ── Verifikasi OTP ─── */
              <>
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cek email Anda</h1>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Kode 6 digit dikirim ke</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{email}</p>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                  <div>
                    <label htmlFor="code" className={`${labelCls} text-center`}>Kode Verifikasi</label>
                    <input id="code" value={code}
                      onChange={e => { setCode(e.target.value); setError(null); }}
                      placeholder="· · · · · ·" required maxLength={6} inputMode="numeric" autoComplete="one-time-code"
                      className="h-14 w-full rounded-2xl border-2 border-gray-200 bg-gray-50 text-center text-2xl font-bold tracking-[0.5em] text-gray-900 outline-none transition
                        focus:border-[#e00000] focus:bg-white focus:shadow-[0_0_0_4px_rgba(224,0,0,0.1)]
                        dark:border-white/10 dark:bg-white/5 dark:text-white
                        dark:focus:border-[#f03020] dark:focus:bg-white/8 dark:focus:shadow-[0_0_0_4px_rgba(240,48,32,0.15)]"
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700
                      dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                      <span>⚠</span><span>{error}</span>
                    </div>
                  )}

                  <button type="submit" disabled={verifying || !isLoaded}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e00000] text-sm font-bold text-white
                      shadow-lg shadow-red-200 transition-all hover:bg-[#c00000] active:scale-[0.98] disabled:opacity-60
                      dark:shadow-red-900/30">
                    {verifying ? <><Loader2 className="h-4 w-4 animate-spin" />Memverifikasi…</> : 'Verifikasi & Masuk →'}
                  </button>
                </form>

                <button type="button" onClick={() => setStep('form')}
                  className="mt-4 w-full text-center text-sm text-gray-400 hover:text-gray-600 hover:underline dark:text-gray-500 dark:hover:text-gray-300">
                  ← Kembali dan ganti email
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
