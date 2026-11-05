import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import type { Metadata } from 'next';
import { SuppressRechartsWarning } from '@/components/shared/suppress-recharts-warning';
import { ThemeProvider } from '@/components/layout/theme-provider';

// Force dynamic rendering — required for Clerk auth to work correctly on Vercel
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nestation — Sistem Operasional',
  description: 'Sistem manajemen operasional internal Nestation.',
  icons: {
    icon: '/nestation-logo.png',
    shortcut: '/nestation-logo.png',
    apple: '/nestation-logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Use proxy URL for *.vercel.app domains (no custom subdomain available)
  const proxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL || undefined;
  return (
    <ClerkProvider {...(proxyUrl ? { proxyUrl } : {})}>
      <html lang="id" suppressHydrationWarning>
        <body className="antialiased" suppressHydrationWarning>
          <ThemeProvider>
            <SuppressRechartsWarning />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
