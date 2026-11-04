import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { SuppressRechartsWarning } from '@/components/shared/suppress-recharts-warning';

const font = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'Nestation',
  description: 'Sistem manajemen operasional Nestation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="id">
        <body className={`${font.className} antialiased`}>
          <SuppressRechartsWarning />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
