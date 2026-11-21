import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  GraduationCap,
  History,
  Menu,
  Monitor,
  Moon,
  Sun,
  UserCheck,
} from 'lucide-react';
import { BRAND_NAME, ICON_URL, TELEGRAM_URL } from '../lib/constants';
import { Link, usePathname, useRouter } from '../lib/router';
import { applyTheme, getStoredTheme, type ThemeMode } from '../lib/storage';

interface NavItem {
  icon: 'study' | 'batches' | 'mybatches' | 'history' | 'telegram' | 'contact';
  text: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: 'study', text: 'Study', href: '/study' },
  { icon: 'batches', text: 'Batches', href: '/study/batches' },
  { icon: 'mybatches', text: 'My Batches', href: '/study/mybatches' },
  { icon: 'history', text: 'History', href: '/history' },
  { icon: 'telegram', text: 'Join Telegram', href: TELEGRAM_URL },
  { icon: 'contact', text: 'Contact Us', href: '/contact' },
];

function SidebarIcon({ name }: { name: NavItem['icon'] }) {
  if (name === 'study') {
    return <GraduationCap className="w-5 h-5 flex-shrink-0 text-[#5a4bda]" />;
  }
  if (name === 'batches') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
        <path
          d="M7.5 14.375V15.2145C7.5 15.8775 7.23661 16.5134 6.76777 16.9822L6.25 17.5H13.75L13.2322 16.9822C12.7634 16.5134 12.5 15.8775 12.5 15.2145V14.375M17.5 4.375V12.5C17.5 13.5355 16.6605 14.375 15.625 14.375H4.375C3.33947 14.375 2.5 13.5355 2.5 12.5V4.375M17.5 4.375C17.5 3.33947 16.6605 2.5 15.625 2.5H4.375C3.33947 2.5 2.5 3.33947 2.5 4.375M17.5 4.375V10C17.5 11.0355 16.6605 11.875 15.625 11.875H4.375C3.33947 11.875 2.5 11.0355 2.5 10V4.375"
          stroke="#5a4bda"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === 'mybatches') {
    return <UserCheck className="w-5 h-5 flex-shrink-0 text-[#5a4bda]" />;
  }
  if (name === 'history') {
    return <History className="w-5 h-5 flex-shrink-0 text-[#5a4bda]" />;
  }
  if (name === 'telegram') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
        <path
          d="M16.9 3.25 14.55 16c-.18.9-.68 1.12-1.38.7l-3.58-2.64-1.73 1.66c-.19.19-.35.35-.72.35l.26-3.65 6.64-6c.29-.26-.06-.4-.45-.14l-8.2 5.16-3.53-1.1c-.77-.24-.78-.77.16-1.14L15.82 3.9c.64-.24 1.2.15 1.08-.65Z"
          stroke="#5a4bda"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
      <path d="M10 10.25a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Z" stroke="#5a4bda" strokeWidth="1.35" />
      <path d="M4.3 16.2c.55-2.6 2.55-4.15 5.7-4.15s5.15 1.55 5.7 4.15" stroke="#5a4bda" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M3.15 3.6h2.1M14.75 3.6h2.1" stroke="#5a4bda" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'SYSTEM') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    if (!themeMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [themeMenuOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isStandalone =
    pathname === '/auth' ||
    pathname.startsWith('/auth/') ||
    pathname === '/watch' ||
    pathname.startsWith('/watch/') ||
    pathname === '/live' ||
    pathname.startsWith('/live/');

  if (isStandalone) {
    return <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background">{children}</div>;
  }

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-background nt-shimmer-scope">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 xl:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`z-50 w-64 bg-background border-r shadow-md transform transition-transform duration-200 ease-in-out fixed top-0 left-0 h-full ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } xl:fixed xl:top-0 xl:left-0 xl:translate-x-0 xl:h-screen xl:z-40`}
      >
        <div className="p-4 border-b sticky top-0 bg-background z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full dark:bg-foreground overflow-hidden shrink-0">
            <img
              src={ICON_URL}
              alt={`${BRAND_NAME} logo`}
              width={40}
              height={40}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-semibold text-foreground truncate">{BRAND_NAME}</span>
          <GraduationCap className="w-5 h-5 text-[#5a4bda] shrink-0" />
        </div>

        <nav className="p-2 space-y-2 overflow-y-auto h-[calc(100vh-5rem)]">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/study'
                ? pathname === '/study' || pathname === '/'
                : item.href === '/study/batches'
                  ? pathname === '/study/batches' || pathname.startsWith('/study/batches/')
                  : pathname === item.href;

            return (
              <Link key={item.text} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer text-sm transition-colors duration-200 ${
                    active
                      ? 'bg-foreground/90 !text-background sidebar-item-active font-medium'
                      : 'text-foreground hover:bg-foreground/15'
                  }`}
                >
                  <SidebarIcon name={item.icon} />
                  <span>{item.text}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 w-full max-w-full flex-1 flex-col xl:ml-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/50 p-2 backdrop-blur divshadow sm:p-4">
          <div className="flex items-center gap-2 rounded-lg bg-background/50 py-2 sm:px-2 md:ml-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle Menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground xl:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>

            {pathname !== '/study' && pathname !== '/study/' && pathname !== '/' && (
              <button
                type="button"
                onClick={() => router.back()}
                className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:opacity-80 transition-opacity"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setThemeMenuOpen((prev) => !prev)}
              className="rounded-md p-2 hover:bg-muted transition-colors"
              aria-label="Theme"
            >
              {theme === 'LIGHT' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {themeMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 z-50 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    setTheme('LIGHT');
                    setThemeMenuOpen(false);
                  }}
                  className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                    theme === 'LIGHT' ? 'bg-accent font-medium' : ''
                  }`}
                >
                  <Sun className="mr-2 h-4 w-4" /> Light
                </button>
                <div className="-mx-1 my-1 h-px bg-muted" />
                <button
                  type="button"
                  onClick={() => {
                    setTheme('DARK');
                    setThemeMenuOpen(false);
                  }}
                  className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                    theme === 'DARK' ? 'bg-accent font-medium' : ''
                  }`}
                >
                  <Moon className="mr-2 h-4 w-4" /> Dark
                </button>
                <div className="-mx-1 my-1 h-px bg-muted" />
                <button
                  type="button"
                  onClick={() => {
                    setTheme('SYSTEM');
                    setThemeMenuOpen(false);
                  }}
                  className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                    theme === 'SYSTEM' ? 'bg-accent font-medium' : ''
                  }`}
                >
                  <Monitor className="mr-2 h-4 w-4" /> System
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="min-w-0 w-full max-w-full flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
