'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  ChevronRight,
  Home,
  User as UserIcon,
  LogOut,
  Shield,
  HelpCircle,
  ShoppingCart,
  Menu,
  CreditCard,
  AlertTriangle,
  Info,
  CheckCheck,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { ImpersonationBanner } from './impersonation-banner';
import { useNav } from './nav-context';
import { cn } from '@/lib/utils';
import { useGetCartQuery } from '@/features/orders/ordersApi';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '@/features/notifications/notificationsApi';

// Section mapping for breadcrumb navigation
const SECTION_MAP: Record<string, string> = {
  categories: 'Catalog',
  products: 'Catalog',
  brands: 'Catalog',
  inventory: 'Logistics',
  warehouses: 'Logistics',
  dispatch: 'Logistics',
  dealers: 'Management',
  orders: 'Orders',
  cart: 'Orders',
  checkout: 'Orders',
  invoices: 'Finance',
  reports: 'Analytics',
  settings: 'Administration',
};

export const Topbar: React.FC = () => {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { navOpen, setNavOpen } = useNav();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const isDealer = user?.role === 'DEALER';
  const { data: cartData } = useGetCartQuery(undefined, { skip: !isDealer });
  const cartItemCount = cartData?.data?.summary?.totalItems || 0;

  // Notifications API queries & mutations
  const { data: notifData } = useGetNotificationsQuery();
  const [markAllRead, { isLoading: isMarkingAll }] = useMarkAllNotificationsReadMutation();
  const [markRead] = useMarkNotificationReadMutation();

  const notifications = notifData?.data || [];
  const unreadCount = notifData?.unreadCount ?? notifications.filter((n) => !n.isRead).length;

  const handleLogout = () => {
    dispatch(logout());
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'NT';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const formatRelativeTime = (timestamp?: string) => {
    if (!timestamp) return 'Just now';
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ORDER':
        return {
          icon: <ShoppingCart size={13} className="text-blue-600" />,
          bg: 'bg-blue-50 border-blue-200',
        };
      case 'PAYMENT':
        return {
          icon: <CreditCard size={13} className="text-emerald-600" />,
          bg: 'bg-emerald-50 border-emerald-200',
        };
      case 'WARNING':
        return {
          icon: <AlertTriangle size={13} className="text-amber-600" />,
          bg: 'bg-amber-50 border-amber-200',
        };
      case 'INFO':
      default:
        return {
          icon: <Info size={13} className="text-slate-600" />,
          bg: 'bg-slate-100 border-slate-200',
        };
    }
  };

  // Breadcrumbs generation
  const pathSegments = (pathname || '').split('/').filter(Boolean);

  const renderBreadcrumbs = () => {
    // 1. Root or /dashboard -> 🏠 > Dashboard
    if (pathSegments.length === 0 || pathSegments[0] === 'dashboard') {
      return (
        <nav aria-label="Breadcrumb" className="flex items-center text-xs text-[#706E6B] font-medium gap-1.5">
          <Link
            href="/dashboard"
            className="flex items-center text-[#706E6B] hover:text-[#0176D3] transition-colors"
            title="Dashboard"
          >
            <Home size={14} />
          </Link>
          <ChevronRight size={12} className="text-[#A09E9B]" />
          <span className="text-[#181818] font-semibold">Dashboard</span>
        </nav>
      );
    }

    const firstSegment = pathSegments[0];
    const sectionName = SECTION_MAP[firstSegment];
    const formattedFirst = firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1).replace(/-/g, ' ');

    // 2. Single segment page (e.g. /products, /orders, /dealers)
    if (pathSegments.length === 1) {
      if (sectionName && sectionName.toLowerCase() !== formattedFirst.toLowerCase()) {
        return (
          <nav aria-label="Breadcrumb" className="flex items-center text-xs text-[#706E6B] font-medium gap-1.5">
            <Link
              href="/dashboard"
              className="flex items-center text-[#706E6B] hover:text-[#0176D3] transition-colors"
              title="Dashboard"
            >
              <Home size={14} />
            </Link>
            <ChevronRight size={12} className="text-[#A09E9B]" />
            <span className="text-[#706E6B]">{sectionName}</span>
            <ChevronRight size={12} className="text-[#A09E9B]" />
            <span className="text-[#181818] font-semibold">{formattedFirst}</span>
          </nav>
        );
      }

      return (
        <nav aria-label="Breadcrumb" className="flex items-center text-xs text-[#706E6B] font-medium gap-1.5">
          <Link
            href="/dashboard"
            className="flex items-center text-[#706E6B] hover:text-[#0176D3] transition-colors"
            title="Dashboard"
          >
            <Home size={14} />
          </Link>
          <ChevronRight size={12} className="text-[#A09E9B]" />
          <span className="text-[#181818] font-semibold">{formattedFirst}</span>
        </nav>
      );
    }

    // 3. Multi-segment page (e.g. /products/[id], /orders/[id], /dealers/[id])
    const secondSegment = pathSegments[1];
    const isCodeOrId =
      secondSegment.startsWith('ORD-') ||
      secondSegment.startsWith('INV-') ||
      secondSegment.startsWith('DSP-') ||
      secondSegment.startsWith('TRF-') ||
      secondSegment.length > 15;
    const isOpaqueId = secondSegment.length > 15 && !/^[A-Z]{3}-/.test(secondSegment);
    const formattedSecond = isOpaqueId
      ? 'Details'
      : isCodeOrId
      ? secondSegment
      : secondSegment.charAt(0).toUpperCase() + secondSegment.slice(1).replace(/-/g, ' ');

    return (
      <nav aria-label="Breadcrumb" className="flex items-center text-xs text-[#706E6B] font-medium gap-1.5">
        <Link
          href="/dashboard"
          className="flex items-center text-[#706E6B] hover:text-[#0176D3] transition-colors"
          title="Dashboard"
        >
          <Home size={14} />
        </Link>
        {sectionName && sectionName.toLowerCase() !== formattedFirst.toLowerCase() && (
          <>
            <ChevronRight size={12} className="text-[#A09E9B]" />
            <span className="text-[#706E6B]">{sectionName}</span>
          </>
        )}
        <ChevronRight size={12} className="text-[#A09E9B]" />
        <Link href={`/${firstSegment}`} className="hover:text-[#0176D3] transition-colors">
          {formattedFirst}
        </Link>
        <ChevronRight size={12} className="text-[#A09E9B]" />
        <span className={cn('text-[#181818] font-semibold', isCodeOrId && !isOpaqueId && 'font-mono text-[11px]')}>
          {formattedSecond}
        </span>
      </nav>
    );
  };

  return (
    <div className="sticky top-0 z-20 flex flex-col bg-white">
      {/* 52px Top Header Bar */}
      <header className="h-[52px] bg-white border-b border-[#DDDBDA] px-3 sm:px-6 flex items-center justify-between gap-2">
        {/* Left: Clean Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setNavOpen(!navOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={navOpen}
            className="lg:hidden p-2 -ml-1 rounded hover:bg-slate-100 text-[#444444]"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0 overflow-hidden">{renderBreadcrumbs()}</div>
        </div>

        {/* Right: Notifications & User Menu Dropdown */}
        <div className="flex items-center gap-3">
          {/* Dealer Shopping Cart */}
          {isDealer && (
            <Link
              href="/cart"
              title="Shopping Cart"
              className="relative p-2 rounded-full hover:bg-slate-100 text-[#444444] transition-colors"
            >
              <ShoppingCart size={18} />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-4 text-center bg-[#0176D3] text-white text-[10px] font-bold rounded-full ring-2 ring-white">
                  {cartItemCount}
                </span>
              )}
            </Link>
          )}

          {/* Notification Bell with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen((prev) => !prev)}
              title="Notifications"
              className={cn(
                'relative p-2 rounded-full hover:bg-slate-100 text-[#444444] transition-colors',
                notificationsOpen && 'bg-slate-100 text-[#0176D3]'
              )}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-[#BA0517] text-white text-[10px] font-bold rounded-full ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown Panel (360px wide, slides down) */}
            {notificationsOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setNotificationsOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-[360px] bg-white border border-[#DDDBDA] rounded-lg shadow-xl z-40 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100 flex flex-col max-h-[480px]">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-[#DDDBDA] flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#181818]">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#EAF5FE] text-[#0176D3] rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead()}
                        disabled={isMarkingAll}
                        className="text-xs text-[#0176D3] hover:text-[#014486] font-medium flex items-center gap-1 hover:underline transition-colors"
                      >
                        <CheckCheck size={14} />
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notification List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-[#F0EFEF]">
                    {notifications.length === 0 ? (
                      <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[#706E6B] mb-2">
                          <Bell size={20} />
                        </div>
                        <p className="text-xs font-semibold text-[#181818]">No notifications yet</p>
                        <p className="text-[11px] text-[#706E6B] mt-0.5">We'll alert you when important events occur</p>
                      </div>
                    ) : (
                      notifications.map((item) => {
                        const { icon, bg } = getNotificationIcon(item.type);
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (!item.isRead) {
                                markRead(item.id);
                              }
                            }}
                            className={cn(
                              'p-3 flex items-start gap-3 transition-colors cursor-pointer',
                              item.isRead
                                ? 'bg-white hover:bg-slate-50'
                                : 'bg-[#F2F7FC] hover:bg-[#EAF3FA]'
                            )}
                          >
                            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 border mt-0.5', bg)}>
                              {icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <p
                                  className={cn(
                                    'text-[13px] leading-snug truncate',
                                    item.isRead ? 'font-medium text-[#181818]' : 'font-bold text-[#181818]'
                                  )}
                                >
                                  {item.title}
                                </p>
                                <span className="text-[10px] text-[#706E6B] shrink-0">
                                  {formatRelativeTime(item.createdAt)}
                                </span>
                              </div>
                              <p className="text-[12px] text-[#706E6B] line-clamp-2 leading-relaxed">
                                {item.message}
                              </p>
                            </div>
                            {!item.isRead && (
                              <span className="w-2 h-2 rounded-full bg-[#0176D3] shrink-0 mt-1.5" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2 border-t border-[#DDDBDA] bg-slate-50/50 flex items-center justify-center text-center">
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs font-medium text-[#0176D3] hover:text-[#014486] transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Menu Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1 pl-2 rounded hover:bg-slate-50 border border-transparent hover:border-[#DDDBDA] transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-[#0176D3] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {getInitials(user?.name)}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-[#181818] leading-tight">
                  {user?.name || 'Administrator'}
                </span>
                <span className="text-[10px] text-[#706E6B] uppercase font-bold tracking-wider">
                  {user?.role || 'ADMIN'}
                </span>
              </div>
            </button>

            {/* Dropdown Menu Modal */}
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-56 bg-white border border-[#DDDBDA] rounded shadow-lg z-40 py-1.5 animate-in fade-in-50 zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-[#DDDBDA] bg-slate-50/50">
                    <p className="text-xs font-bold text-[#181818]">
                      {user?.name || 'Administrator'}
                    </p>
                    <p className="text-[11px] text-[#706E6B] truncate">
                      {user?.email || 'admin@nextrade.com'}
                    </p>
                    {user?.businessName && (
                      <p className="text-[11px] text-[#0176D3] font-medium mt-0.5 truncate">
                        {user.businessName}
                      </p>
                    )}
                  </div>

                  <div className="py-1">
                    <Link
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#444444] hover:bg-slate-100 transition-colors"
                    >
                      <Shield size={14} className="text-[#706E6B]" />
                      Account Settings
                    </Link>
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#444444] hover:bg-slate-100 transition-colors"
                    >
                      <HelpCircle size={14} className="text-[#706E6B]" />
                      Documentation & Help
                    </a>
                  </div>

                  <div className="border-t border-[#DDDBDA] pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#BA0517] hover:bg-red-50 transition-colors font-medium text-left"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Impersonation Banner Rendered when active */}
      <ImpersonationBanner />
    </div>
  );
};
