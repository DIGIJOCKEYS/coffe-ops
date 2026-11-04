'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TablePagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const showNav = pageCount > 1;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Menampilkan <span className="font-medium text-foreground">{from}–{to}</span> dari {total}
      </p>
      {showNav && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Halaman sebelumnya">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Sebelum</span>
          </Button>
          <span className="px-2 text-xs tabular-nums text-muted-foreground">Hal. {page} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label="Halaman berikutnya">
            <span className="hidden sm:inline">Berikut</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
