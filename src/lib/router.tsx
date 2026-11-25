import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { applyClientSeo } from './seoClient';
import { initGa4IfConfigured, trackEngagementHeartbeat, trackPageView } from './analytics';

interface RouterContextValue {
  pathname: string;
  search: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextValue>({
  pathname: '/',
  search: '',
  navigate: () => {},
});

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [loc, setLoc] = useState(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  }));

  const navigate = useCallback((to: string) => {
    const url = new URL(to, window.location.origin);
    if (url.pathname === window.location.pathname && url.search === window.location.search) {
      return;
    }
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    setLoc({ pathname: url.pathname, search: url.search });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    initGa4IfConfigured();
    const onPop = () => {
      setLoc({
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    applyClientSeo(loc.pathname);
    trackPageView(loc.pathname);

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        trackEngagementHeartbeat(loc.pathname);
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [loc.pathname]);

  return (
    <RouterContext.Provider value={{ pathname: loc.pathname, search: loc.search, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}

export function Link({
  to,
  className = '',
  children,
  onClick,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onClick?.();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
