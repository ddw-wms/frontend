// File Path = warehouse-frontend\app\layout.tsx
import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: "Divine WMS",
  description: "Warehouse Management System",
};

// Script to apply appearance settings immediately before React hydrates
const appearanceScript = `
(function() {
  try {
    var settings = localStorage.getItem('app_appearance_settings');
    var root = document.documentElement;
    var body = document.body;
    var isDark = false;
    
    if (settings) {
      var s = JSON.parse(settings);
      if (s.fontSize) root.style.setProperty('--app-font-size', s.fontSize + 'px');
      if (s.fontFamily) root.style.setProperty('--app-font-family', s.fontFamily);
      if (s.primaryColor) {
        root.style.setProperty('--app-primary-color', s.primaryColor);
      }
      if (s.tableRowDensity) {
        var rowHeight = s.tableRowDensity === 'compact' ? '36' : '44';
        root.style.setProperty('--app-table-row-height', rowHeight + 'px');
      }
      if (s.highContrastMode) root.classList.add('high-contrast');
      if (!s.showAnimations) root.setAttribute('data-animations', 'disabled');
      // Apply theme early to prevent flash
      if (s.theme) {
        var effectiveTheme = s.theme;
        if (s.theme === 'auto') {
          effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        root.setAttribute('data-theme', effectiveTheme);
        isDark = effectiveTheme === 'dark';
      }
    }
    
    // Set background color immediately to prevent flash
    body.style.backgroundColor = isDark ? '#0f172a' : '#f5f7fa';
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
      </head>
      <body suppressHydrationWarning className="min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
