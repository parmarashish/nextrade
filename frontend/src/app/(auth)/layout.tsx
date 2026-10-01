import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/branding/logo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full sm:max-w-[480px]">
        {children}

        {/* Security & Footer Notice */}
        <div className="mt-6 text-center text-xs text-[#706E6B] space-y-1">
          <p>NexTrade B2B Portal &copy; {new Date().getFullYear()} All rights reserved.</p>
          <p className="text-[11px] text-[#A09E9B]">
            Protected by SSL 256-bit enterprise encryption
          </p>
        </div>
      </div>
    </div>
  );
}
