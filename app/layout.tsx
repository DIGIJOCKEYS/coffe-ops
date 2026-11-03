import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

const font = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'Coffee Ops',
  description: 'Sistem manajemen operasional kedai kopi.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={`${font.className} antialiased`}>{children}</body>
    </html>
  );
}
