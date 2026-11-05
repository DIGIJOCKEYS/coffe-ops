'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type BusinessSettings = {
  businessName: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
};

const DEFAULT: BusinessSettings = {
  businessName: 'Nestation',
  logoUrl: null,
  backgroundUrl: null,
};

let _cache: BusinessSettings | null = null;

export function useBusinessSettings(): BusinessSettings {
  const [settings, setSettings] = useState<BusinessSettings>(_cache ?? DEFAULT);

  useEffect(() => {
    if (_cache) return;
    const supabase = createClient();
    supabase
      .from('business_settings')
      .select('business_name, logo_url, background_url')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          _cache = {
            businessName: data.business_name,
            logoUrl: data.logo_url,
            backgroundUrl: data.background_url,
          };
          setSettings(_cache);
        }
      });
  }, []);

  return settings;
}

export function invalidateBusinessSettingsCache() {
  _cache = null;
}
