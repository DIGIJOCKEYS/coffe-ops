import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function CardShell({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col rounded-xl border border-line bg-white shadow-sm', className)}>
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
        </div>
        {action}
      </header>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}
