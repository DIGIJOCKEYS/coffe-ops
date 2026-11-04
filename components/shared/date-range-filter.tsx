'use client';

import { Input } from '@/components/ui/input';

export type DateRange = { from: string; to: string };

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3" aria-label="Filter rentang tanggal">
      <label className="grid gap-1 text-xs font-medium text-ink-muted">
        Dari
        <Input
          type="date"
          value={value.from}
          max={value.to}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
          className="w-40"
          aria-label="Tanggal mulai"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-ink-muted">
        Sampai
        <Input
          type="date"
          value={value.to}
          min={value.from}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
          className="w-40"
          aria-label="Tanggal akhir"
        />
      </label>
    </div>
  );
}