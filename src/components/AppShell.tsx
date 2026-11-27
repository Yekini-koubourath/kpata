import React, { useState } from 'react';
import { motion } from 'motion/react';
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#042F24] text-emerald-100">
        <div className="h-16 px-6 flex items-center justify-between border-b border-emerald-900/80">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-white">
            KPATA
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
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
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-sm'
                    : 'text-emerald-100/80 hover:bg-emerald-900/60 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="font-mono text-xs font-bold text-amber-300 tabular-nums">
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}

          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <div className="pt-4 mt-4 border-t border-emerald-900/80">
              <Link
                to="/admin"
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-amber-300 hover:bg-emerald-900/60 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Espace Propriétaire</span>
              </Link>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-emerald-900/80 bg-[#03241B] space-y-3">
          <div className="text-xs px-1">
            <p className="font-semibold text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-emerald-200/70 truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-emerald-100 border border-emerald-800 rounded-xl hover:bg-emerald-900/60 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-[#042F24] text-white h-full flex flex-col z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-emerald-900">
              <span className="font-display text-lg font-extrabold text-white">KPATA</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-emerald-100 hover:bg-emerald-900"
                aria-label="Fermer la navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.to === '/app' ? pathname === '/app' : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium ${
                      active ? 'bg-emerald-600 text-white font-semibold' : 'text-emerald-100/80'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="font-mono text-xs font-bold text-amber-300">
                        {item.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-emerald-900">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-emerald-100 border border-emerald-800 rounded-xl"
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
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-700"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
                {title}
              </h1>
              {subtitle && <p className="text-xs text-slate-500 truncate hidden sm:block">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
