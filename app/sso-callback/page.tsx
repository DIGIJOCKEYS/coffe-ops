'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-white dark:bg-[#111520]">
      {/* Logo SVG inline — tidak ada background putih */}
      <div className="flex items-center gap-2.5">
        <svg width="40" height="40" viewBox="0 0 36 36" fill="none" aria-hidden>
          <circle cx="18" cy="18" r="18" fill="#e00000" />
          <ellipse cx="18" cy="18" rx="10" ry="7" fill="#ff6b00" transform="rotate(-30 18 18)" />
          <ellipse cx="18" cy="18" rx="6" ry="3.5" fill="#e00000" transform="rotate(-30 18 18)" />
          <ellipse cx="14" cy="14" rx="4" ry="2.5" fill="#ffa500" opacity="0.7" transform="rotate(-30 14 14)" />
        </svg>
        <span className="text-xl font-black uppercase tracking-widest text-gray-900 dark:text-white">Nestation</span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin text-[#e00000]" />
          Menyelesaikan login…
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">Mohon tunggu sebentar</p>
      </div>

      {/* Komponen Clerk yang menyelesaikan OAuth flow dan redirect ke /dashboard */}
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
