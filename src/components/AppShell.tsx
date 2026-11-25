import React, { useState } from 'react';
import {
  Bell,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MailCheck,
  Menu,
  ShieldCheck,
  UserCog,
  X,
} from 'lucide-react';
import { Link, useRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { pathname, navigate } = useRouter();
  const { user, logout, unreadNotifications, pendingInvitations } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { to: '/app', label: 'Tableau de bord', icon: LayoutDashboard },
    { to: '/app/groups', label: 'Mes groupes', icon: FolderKanban },
    {
      to: '/app/invitations',
      label: 'Invitations',
      icon: MailCheck,
      count: pendingInvitations,
    },
    {
      to: '/app/notifications',
      label: 'Notifications',
      icon: Bell,
      count: unreadNotifications,
    },
    { to: '/app/compte', label: 'Mon compte', icon: UserCog },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/connexion');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-stone-200/90">
        <div className="h-16 px-6 flex items-center justify-between border-b border-stone-200/80">
          <Link to="/" className="font-display text-xl font-bold tracking-tight text-stone-900">
            KPATA
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === '/app'
                ? pathname === '/app'
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  active
                    ? 'bg-emerald-50 text-emerald-900 font-semibold'
                    : 'text-stone-600 hover:bg-stone-100/80 hover:text-stone-950'
                }`}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="font-mono text-xs font-semibold text-emerald-800 tabular-nums">
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}

          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <div className="pt-4 mt-4 border-t border-stone-200">
              <Link
                to="/admin"
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-100/80 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-800" />
                <span>Espace Propriétaire</span>
              </Link>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-stone-200/80 space-y-3">
          <div className="text-xs px-1">
            <p className="font-semibold text-stone-900 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-stone-500 truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-stone-700 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-stone-900/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-stone-200 z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-stone-200">
              <span className="font-display text-lg font-bold text-stone-900">KPATA</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100"
                aria-label="Fermer la navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.to === '/app' ? pathname === '/app' : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium ${
                      active ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'text-stone-700'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="font-mono text-xs font-semibold text-emerald-800">
                        {item.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-stone-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-stone-700 border border-stone-200 rounded-xl"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-[#FAF9F6]/92 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-stone-200 bg-white text-stone-700"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold text-stone-900 truncate">
                {title}
              </h1>
              {subtitle && <p className="text-xs text-stone-500 truncate hidden sm:block">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
