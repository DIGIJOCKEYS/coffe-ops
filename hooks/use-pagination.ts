import { useState } from 'react';

// Paginasi sisi client: memotong array jadi halaman berukuran pageSize.
// page yang dikembalikan sudah di-clamp supaya tidak pernah melebihi jumlah halaman.
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  return {
    page: currentPage,
    totalPages,
    paged,
    total: items.length,
    pageSize,
    setPage,
  };
}
