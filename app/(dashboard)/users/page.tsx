'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataState } from '@/components/shared/data-state';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/components/layout/role-context';
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { useToast } from '@/hooks/use-toast';
import { fetchUserProfiles, setUserActiveStatus } from '@/lib/operations-data';

const DATE_FORMAT = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export default function UsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: usersData, loading, error, refresh } = useSupabaseQuery(fetchUserProfiles);
  const users = usersData ?? [];
  const [savingId, setSavingId] = useState<string | null>(null);
  useSupabaseRealtime(['profiles'], refresh);

  const changeStatus = async (targetId: string, isActive: boolean) => {
    if (!user?.id) return;
    setSavingId(targetId);
    try {
      await setUserActiveStatus(user.id, targetId, isActive);
      await refresh();
      toast({
        title: isActive ? 'Akun diaktifkan' : 'Akun dinonaktifkan',
        description: users.find((item) => item.id === targetId)?.name ?? 'Pengguna',
      });
    } catch (cause) {
      toast({
        title: 'Status pengguna gagal diubah',
        description: cause instanceof Error ? cause.message : 'Coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const activeCount = users.filter((item) => item.isActive).length;
  const activeAdminCount = users.filter((item) => item.isActive && item.role === 'admin').length;
  const inactiveCount = users.length - activeCount;

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Kelola akun Admin dan Staff serta akses mereka ke Nestation."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-lg border border-line bg-white px-4 py-3">
          <p className="text-xs text-ink-muted">Aktif</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-line bg-white px-4 py-3">
          <p className="text-xs text-ink-muted">Nonaktif</p>
          <p className="mt-1 text-xl font-semibold text-ink-muted">{inactiveCount}</p>
        </div>
      </div>

      <DataState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          {users.length === 0 ? (
            <p className="px-6 py-14 text-center text-sm text-ink-muted">Belum ada pengguna terdaftar.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Terdaftar</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((item) => {
                    const isSelf = item.id === user?.id;
                    const isLastActiveAdmin = item.role === 'admin' && item.isActive && activeAdminCount <= 1;
                    const disabled = isSelf || isLastActiveAdmin || savingId === item.id;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-ink">{item.name || 'Tanpa nama'}{isSelf ? ' (Anda)' : ''}</TableCell>
                        <TableCell className="text-ink-muted">{item.email || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={item.role === 'admin' ? 'default' : 'outline'}>
                            {item.role === 'admin' ? 'Admin' : 'Staff'}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-ink-muted">
                          {DATE_FORMAT.format(new Date(item.createdAt))}
                        </TableCell>
                        <TableCell>
                          <Badge className={item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-ink/5 text-ink-muted'}>
                            {item.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              checked={item.isActive}
                              disabled={disabled}
                              onCheckedChange={(checked) => changeStatus(item.id, checked)}
                              aria-label={`${item.isActive ? 'Nonaktifkan' : 'Aktifkan'} akun ${item.name}`}
                            />
                            {isSelf && <span className="text-xs text-ink-muted">Akun Anda</span>}
                            {isLastActiveAdmin && <span className="text-xs text-ink-muted">Admin terakhir</span>}
                            {savingId === item.id && <span className="text-xs text-ink-muted">Menyimpan…</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-ink-muted">Akun nonaktif tidak dapat memakai halaman operasional Nestation.</p>
    </>
  );
}