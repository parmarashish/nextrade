'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCredentials, logout, updateToken } from '@/store/slices/authSlice';
import { useGetMeQuery } from '@/features/auth/authApi';
import { bootstrapAccessToken } from '@/lib/auth-bootstrap';
import { NavProvider, useNav } from '@/components/layout/nav-context';
import { Toaster } from '@/components/ui/toast';
import { ConfirmHost } from '@/components/ui/confirm-dialog';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard', brands: 'Brands', categories: 'Categories', products: 'Products', inventory: 'Inventory',
  warehouses: 'Warehouses', dealers: 'Dealers', orders: 'Orders', dispatch: 'Dispatch',
  invoices: 'Invoices', reports: 'Reports', settings: 'Settings', cart: 'Cart', checkout: 'Checkout',
  movements: 'Stock Movements',
};

function NavBackdrop() {
  const { navOpen, setNavOpen } = useNav();
  if (!navOpen) return null;
  return <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { user, token } = useAppSelector((state) => state.auth);

  // Central role guard: admin-only sections bounce dealers to /orders.
  useEffect(() => {
    const root = (pathname || '').split('/').filter(Boolean)[0];
    if (user && user.role !== 'ADMIN' && ['dealers', 'reports', 'settings', 'brands', 'categories', 'warehouses'].includes(root)) {
      router.replace('/orders');
    }
  }, [pathname, user, router]);

  // ESC closes the top-most open modal/drawer by activating its close/cancel control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const layers = Array.from(document.querySelectorAll<HTMLElement>('.fixed.inset-0.z-50'));
      const top = layers[layers.length - 1];
      if (!top) return;
      const buttons = Array.from(top.querySelectorAll<HTMLButtonElement>('button'));
      const closer =
        buttons.find((b) => /^(close|dismiss)/i.test(b.getAttribute('aria-label') || b.title || '')) ||
        buttons.find((b) => /^(cancel|close|no,? keep)/i.test(b.textContent?.trim() || '')) ||
        buttons.find((b) => b.querySelector('svg.lucide-x'));
      if (closer) {
        e.preventDefault();
        closer.click();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const segs = (pathname || '').split('/').filter(Boolean);
    const root = PAGE_TITLES[segs[0]] || 'NexTrade';
    const detail = segs.length > 1 && segs[1] !== 'movements';
    const title = `${detail ? `${root} · Details` : segs[1] === 'movements' ? PAGE_TITLES.movements : root} | NexTrade`;
    document.title = title;
    // Next re-applies the static metadata title after hydration; keep ours authoritative.
    const observer = new MutationObserver(() => {
      if (document.title !== title) document.title = title;
    });
    const titleEl = document.querySelector('title');
    if (titleEl) observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  // The access token is memory-only: on a full reload, restore it via the refresh cookie first.
  const [booting, setBooting] = useState(!token);
  useEffect(() => {
    if (token) {
      setBooting(false);
      return;
    }
    let active = true;
    bootstrapAccessToken().then((t) => {
      if (!active) return;
      if (t) dispatch(updateToken(t));
      setBooting(false);
    });
    return () => {
      active = false;
    };
  }, [token, dispatch]);

  // The user profile is not persisted, so after a full page reload the user profile
  // (and therefore role-based UI/guards) must be rehydrated from /auth/me.
  const needsHydration = !!token && !user;
  const { data, isError } = useGetMeQuery(undefined, { skip: !needsHydration });

  useEffect(() => {
    if (needsHydration && data?.data?.user) {
      const u = data.data.user;
      const isImpersonating = Boolean(u.impersonatedBy);
      const adminName = u.impersonatedByName || 'Administrator';
      const impersonatedBy = u.impersonatedBy
        ? typeof u.impersonatedBy === 'object'
          ? u.impersonatedBy
          : { id: String(u.impersonatedBy), name: adminName }
        : null;

      dispatch(
        setCredentials({
          user: u,
          token: token!,
          isImpersonated: isImpersonating,
          impersonatedBy,
        })
      );
    }
  }, [needsHydration, data, token, dispatch]);

  useEffect(() => {
    if (booting) return;
    if (!token || isError) {
      dispatch(logout());
      router.replace('/login');
    }
  }, [booting, token, isError, dispatch, router]);

  if (booting || !token) {
    return <div className="min-h-screen bg-[#F3F3F3]" />;
  }

  return (
    <NavProvider>
    <div className="min-h-screen bg-[#F3F3F3] flex">
      <NavBackdrop />
      {/* 240px sidebar (>=1024px), 48px icon rail (768-1023px), slide-over drawer (<768px) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col ml-0 md:ml-12 lg:ml-[240px] min-h-screen min-w-0">
        {/* 52px Sticky Topbar with Breadcrumbs & Impersonation Banner */}
        <Topbar />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-3 sm:p-6 overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
      <Toaster />
      <ConfirmHost />
    </div>
    </NavProvider>
  );
}
