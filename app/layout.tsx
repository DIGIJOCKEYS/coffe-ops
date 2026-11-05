import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import type { Metadata } from 'next';
import { SuppressRechartsWarning } from '@/components/shared/suppress-recharts-warning';
import { ThemeProvider } from '@/components/layout/theme-provider';

// Force dynamic rendering — required so Clerk env vars are available at runtime
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
  return (
    // proxyUrl tells the Clerk browser SDK to load clerk.browser.js through
    // /__clerk instead of the default clerk.<domain> subdomain.
    // This is required for *.vercel.app which does not support arbitrary subdomains.
    <ClerkProvider proxyUrl="https://nestation-ops.vercel.app/__clerk">
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
