'use client';

import { Clock3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/shared/table-pagination';
import { usePagination } from '@/hooks/use-pagination';
import { auditEntries, type AuditEntry } from '@/lib/mock-data';

const MODULE_STYLE: Record<string, string> = {
  'Ambil Barang': 'bg-brand/10 text-brand-dark',
  Penjualan: 'bg-emerald-50 text-emerald-700',
  Pengeluaran: 'bg-sky-50 text-sky-700',
  'Stok & Menu': 'bg-ink/5 text-ink',
};

export default function AuditLogsPage() {
  const sorted = [...auditEntries].sort((a, b) => a.time.localeCompare(b.time));
  const { page, totalPages, paged, total, pageSize, setPage } = usePagination(sorted, 10);

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Linimasa aktivitas: ambil barang, penjualan, pengeluaran, dan perubahan stok."
      />

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-24">Waktu</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead>Modul</TableHead>
                <TableHead>Aktivitas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((entry: AuditEntry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap tabular-nums text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      {entry.time}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-ink">{entry.user}</TableCell>
                  <TableCell>
                    <Badge className={MODULE_STYLE[entry.module] ?? 'bg-ink/5 text-ink'}>{entry.module}</Badge>
                  </TableCell>
                  <TableCell className="text-ink-muted">{entry.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <TablePagination page={page} pageCount={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Catatan: data audit log bersifat contoh (prototype). Saat database tersambung, entri akan terisi otomatis dari aktivitas ambil barang, penjualan, dan pengeluaran.
      </p>
    </>
  );
}
