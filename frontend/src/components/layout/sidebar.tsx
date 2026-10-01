'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Tag,
  Package,
  Bookmark,
  Boxes,
  Warehouse,
  Users,
  ShoppingCart,
  Truck,
  FileText,
  BarChart2,
  Settings,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { Logo } from '../branding/logo';
import { useNav } from './nav-context';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useLogoutMutation } from '@/features/auth/authApi';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'CATALOG',
    items: [
      { label: 'Categories', href: '/categories', icon: Tag, adminOnly: true },
      { label: 'Products', href: '/products', icon: Package },
      { label: 'Brands', href: '/brands', icon: Bookmark, adminOnly: true },
    ],
  },
  {
    title: 'INVENTORY',
    items: [
      { label: 'Inventory', href: '/inventory', icon: Boxes },
      { label: 'Warehouses', href: '/warehouses', icon: Warehouse, adminOnly: true },
    ],
  },
  {
    title: 'DEALERS',
    items: [
      { label: 'Dealers', href: '/dealers', icon: Users, adminOnly: true },
    ],
  },
  {
    title: 'ORDERS',
    items: [
      { label: 'Orders', href: '/orders', icon: ShoppingCart },
      { label: 'Dispatch', href: '/dispatch', icon: Truck },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { label: 'Invoices', href: '/invoices', icon: FileText },
      { label: 'Reports', href: '/reports', icon: BarChart2, adminOnly: true },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === 'ADMIN';

  const { navOpen, setNavOpen } = useNav();
  // Collapsed rail (icon-only) between 768-1023px; labels return when the drawer is open or at >=1024px.
  const label = navOpen ? 'inline' : 'hidden lg:inline';

  useEffect(() => {
    setNavOpen(false);
  }, [pathname, setNavOpen]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen, setNavOpen]);

  const [logoutRequest] = useLogoutMutation();

  const handleLogout = async () => {
    // Revoke the server session + refresh cookie, otherwise a reload silently signs the user back in.
    try {
      await logoutRequest().unwrap();
    } catch {
      /* session may already be expired; still leave */
    }
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

  return (
    <aside
      className={cn(
        'h-screen bg-[#032D60] text-[#B0C4DE] flex flex-col fixed left-0 top-0 z-40 select-none border-r border-[#021f42] transition-all duration-200',
        navOpen ? 'w-[240px] translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0 w-[240px] md:w-12 lg:w-[240px]'
      )}
    >
      {/* Brand Logo Header */}
      <div className={cn("h-[52px] flex items-center border-b border-white/10 bg-[#02234c]", navOpen ? "px-5" : "px-5 md:px-0 md:justify-center lg:px-5 lg:justify-start")}>
        <Link href="/dashboard" className="flex items-center">
          <span className={cn(navOpen ? 'hidden' : 'hidden md:inline lg:hidden')}>
            <Logo size="sm" variant="icon-only" inverted={true} />
          </span>
          <span className={cn(navOpen ? 'inline' : 'md:hidden lg:inline')}>
            <Logo size="md" variant="full" inverted={true} />
          </span>
        </Link>
      </div>

      {/* Navigation Groups */}
      <div className={cn("flex-1 overflow-y-auto py-3 space-y-4 sidebar-scroll", navOpen ? "px-3" : "px-3 md:px-1 lg:px-3")}>
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.adminOnly || isAdmin
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              <div className={cn("px-3 text-[10px] font-bold tracking-wider text-[#7B96B2] uppercase", navOpen ? "block" : "md:hidden lg:block")}>
                {section.title}
              </div>

              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      aria-label={item.label}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium transition-colors duration-150',
                        !navOpen && 'md:justify-center md:px-0 lg:justify-start lg:px-3',
                        isActive
                          ? 'bg-[#0176D3] text-white shadow-sm'
                          : 'text-[#B0C4DE] hover:bg-white/[0.08] hover:text-white'
                      )}
                    >
                      <Icon size={17} className={cn('shrink-0', isActive ? 'text-white' : 'text-[#8EA8C4]')} />
                      <span className={cn("truncate", label)}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* User Profile & Logout Bottom Bar */}
      <div className={cn("border-t border-white/10 bg-[#02234c]", navOpen ? "p-3" : "p-3 md:p-1 lg:p-3")}>
        <div className={cn("flex items-center justify-between gap-2", !navOpen && "md:flex-col lg:flex-row")}>
          <div className="flex items-center gap-2.5 min-w-0">
            {/* User Avatar Initials */}
            <div className="w-8 h-8 rounded-full bg-[#0176D3] text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-inner">
              {getInitials(user?.name || user?.businessName || 'Admin')}
            </div>

            <div className={cn("min-w-0", navOpen ? "block" : "md:hidden lg:block")}>
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {user?.name || 'Administrator'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={cn(
                    'text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full',
                    isAdmin
                      ? 'bg-amber-400/20 text-amber-300'
                      : 'bg-blue-400/20 text-blue-300'
                  )}
                >
                  {user?.role || 'ADMIN'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 rounded hover:bg-white/10 text-[#8EA8C4] hover:text-red-300 transition-colors shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
