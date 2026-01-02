// File Path = warehouse-frontend\app\layout.tsx
import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: "Warehouse WMS",
  description: "Warehouse Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}