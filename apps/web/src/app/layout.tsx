import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AIoT Asset Platform',
  description: 'Asset management dashboard',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
