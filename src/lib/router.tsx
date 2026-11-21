import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface RouterContextValue {
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [locationState, setLocationState] = useState(() => ({
    pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
    search: typeof window !== 'undefined' ? window.location.search : '',
  }));

  useEffect(() => {
    const sync = () => {
      setLocationState({
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };
    const onAuthRequired = (e: Event) => {
      const target = (e as CustomEvent<string>).detail || '/auth';
      const targetUrl = new URL(target, window.location.origin);
      window.history.replaceState({}, '', targetUrl.pathname + targetUrl.search + targetUrl.hash);
      setLocationState({
        pathname: targetUrl.pathname,
        search: targetUrl.search,
      });
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('gb:auth-required', onAuthRequired);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('gb:auth-required', onAuthRequired);
    };
  }, []);

  const push = useCallback((href: string) => {
    if (!href) return;
    if (/^https?:\/\//i.test(href)) {
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    const targetUrl = new URL(href, window.location.origin);
    window.history.pushState({}, '', targetUrl.pathname + targetUrl.search + targetUrl.hash);
    setLocationState({
      pathname: targetUrl.pathname,
      search: targetUrl.search,
    });
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const replace = useCallback((href: string) => {
    if (!href) return;
    const targetUrl = new URL(href, window.location.origin);
    window.history.replaceState({}, '', targetUrl.pathname + targetUrl.search + targetUrl.hash);
    setLocationState({
      pathname: targetUrl.pathname,
      search: targetUrl.search,
    });
  }, []);

  const back = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      push('/study');
    }
  }, [push]);

  const searchParams = useMemo(() => new URLSearchParams(locationState.search), [locationState.search]);

  const value = useMemo<RouterContextValue>(
    () => ({
      pathname: locationState.pathname,
      search: locationState.search,
      searchParams,
      push,
      replace,
      back,
    }),
    [locationState.pathname, locationState.search, searchParams, push, replace, back],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider');
  return ctx;
}

export function usePathname() {
  return useRouter().pathname;
}

export function useSearchParams() {
  return useRouter().searchParams;
}

export function Link({
  href,
  children,
  className,
  onClick,
  target,
  rel,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  target?: string;
  rel?: string;
}) {
  const { push } = useRouter();
  const isExternal = /^https?:\/\//i.test(href);

  return (
    <a
      href={href}
      target={target || (isExternal ? '_blank' : undefined)}
      rel={rel || (isExternal ? 'noopener noreferrer' : undefined)}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (!isExternal && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && target !== '_blank') {
          e.preventDefault();
          push(href);
        }
      }}
    >
      {children}
    </a>
  );
}
