import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/store/provider';

export const metadata: Metadata = {
  title: 'NexTrade — B2B Industrial E-Commerce',
  description: "India's Premier B2B Industrial Marketplace for Wholesale Hardware & Tools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F3F3F3] text-[#181818]">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
