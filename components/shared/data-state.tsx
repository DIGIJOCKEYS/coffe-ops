'use client';

import { Button } from '@/components/ui/button';

export function DataState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center" role="status">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-brand" />
      </div>
    );
  }
  if (!error) return null;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-white p-8 text-center">
      <p className="text-sm text-red-700">{error}</p>
      <Button variant="outline" onClick={onRetry}>Coba lagi</Button>
    </div>
  );
}
