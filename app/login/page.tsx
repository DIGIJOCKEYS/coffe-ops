'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Coffee } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } else {
      if (password.length < 6) {
        setError('Password minimal 6 karakter.');
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) {
        setError(error.message);
      } else {
        toast({
          title: 'Akun dibuat',
          description: 'User pertama otomatis jadi admin. Silakan masuk.',
        });
        // Jika konfirmasi email nonaktif, session langsung ada -> arahkan ke dashboard.
        router.push('/dashboard');
        router.refresh();
      }
    }
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
            <Coffee className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Coffee Ops</h1>
            <p className="text-sm text-ink-muted">Sistem manajemen operasional kedai</p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-background p-1">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'}`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'}`}
            >
              Daftar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink-muted">Nama</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink-muted">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@kedai.id" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink-muted">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>

            {error && <p className="text-sm text-brand-dark">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-ink-muted">
          User pertama yang mendaftar otomatis menjadi admin.
        </p>
      </div>
    </main>
  );
}
