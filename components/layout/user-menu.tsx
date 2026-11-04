'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth, useRole } from '@/components/layout/role-context';
import { useToast } from '@/hooks/use-toast';

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`
    : parts[0].slice(0, 2);
  return <span className="text-sm font-semibold uppercase">{initials}</span>;
}

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const { role } = useRole();
  const router = useRouter();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  const displayName = profile?.name ?? user?.fullName ?? user?.firstName ?? 'Pengguna';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const avatar = user?.imageUrl;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/sign-in');
    } catch {
      toast({ title: 'Gagal keluar', description: 'Silakan coba lagi.', variant: 'destructive' });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right md:block">
        <p className="text-xs font-medium text-ink-muted">
          {role === 'admin' ? 'Admin / Pemilik' : 'Staff / Barista'}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#e00000] text-white ring-2 ring-[#e00000]/20 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Menu akun"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <Initials name={displayName} />
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-ink leading-tight">{displayName}</p>
              {email && <p className="truncate text-xs text-ink-muted">{email}</p>}
              <p className="mt-1 text-[11px] text-ink-muted">
                {role === 'admin' ? 'Admin / Pemilik' : 'Staff / Barista'}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {role === 'admin' && (
            <DropdownMenuItem onClick={() => router.push('/users')} className="cursor-pointer gap-2">
              <User className="h-4 w-4" />
              Kelola Pengguna
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-red-600 focus:bg-red-50 focus:text-red-700"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            {signingOut ? 'Keluar…' : 'Keluar'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
