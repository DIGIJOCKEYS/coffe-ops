import { cn } from '@/lib/utils';
import type { StockStatus } from '@/lib/mock-data';

const STATUS_STYLES: Record<StockStatus, { label: string; className: string }> = {
  aman: { label: 'Aman', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' },
  menipis: { label: 'Menipis', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  habis: { label: 'Habis', className: 'bg-ink text-white ring-ink/10' },
  kritis: { label: 'Kritis', className: 'bg-brand/10 text-brand-dark ring-brand/20' },
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}
