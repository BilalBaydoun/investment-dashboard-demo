'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Briefcase,
  Brain,
  Eye,
  Settings,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Sparkles,
  Grid3X3,
  BookOpen,
  Target,
  Calculator,
  Scale,
  Calendar,
  GitCompare,
  Wrench,
  Newspaper,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/heatmap', label: 'Market Heatmap', icon: Grid3X3 },
  { href: '/recommendations', label: 'AI Picks', icon: Sparkles },
  { href: '/analysis', label: 'AI Analysis', icon: Brain },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/compare', label: 'Compare', icon: GitCompare },
  { href: '/tools', label: 'Research Tools', icon: Wrench },
  { href: '/watchlist', label: 'Watchlist', icon: Eye },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/tax', label: 'Tax Center', icon: Calculator },
  { href: '/rebalance', label: 'Rebalance', icon: Scale },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/learn', label: 'Learn Trading', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden h-10 w-10"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300',
          // Desktop
          'hidden md:block',
          collapsed ? 'md:w-16' : 'md:w-64',
          // Mobile - slide in/out
          mobileOpen && '!block w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          {(!collapsed || mobileOpen) && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">InvestAI</span>
            </Link>
          )}
          {collapsed && !mobileOpen && (
            <Link href="/dashboard">
              <TrendingUp className="h-6 w-6 text-primary mx-auto" />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8 hidden md:flex', collapsed && 'mx-auto')}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-2 overflow-y-auto h-[calc(100vh-8rem)]">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const showLabel = !collapsed || mobileOpen;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  !showLabel && 'justify-center px-2'
                )}
                title={!showLabel ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {showLabel && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout (at bottom) */}
        <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-border">
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full',
              'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
              (!collapsed || mobileOpen) ? '' : 'justify-center px-2'
            )}
            title={collapsed && !mobileOpen ? 'Sign Out' : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {(!collapsed || mobileOpen) && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
