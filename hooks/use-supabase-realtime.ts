'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useSupabaseRealtime(
  tables: readonly string[],
  onChange: () => void,
  enabled = true,
) {
  const tableKey = tables.join(',');

  useEffect(() => {
    if (!enabled || !tableKey) return;

    const supabase = createClient();
    let channel = supabase.channel(`live:${tableKey}`);
    for (const table of tableKey.split(',')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        onChange,
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, onChange, tableKey]);
}
