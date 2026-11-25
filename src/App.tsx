import React from 'react';
import { MotionConfig } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RouterProvider, useRouter } from './lib/router';
import {
  ContactPage,
  FaqPage,
  FeaturesPage,
  GroupsShowcasePage,
  HomePage,
  NotFoundPage,
  PricingPage,
  PrivacyPage,
  TermsPage,
} from './pages/PublicPages';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/AuthPages';
import {
  AccountPage,
  GroupsListPage,
  InvitationsPage,
  NotificationsPage,
  PersonalDashboardPage,
} from './pages/DashboardPages';
import { GroupWorkspacePage } from './pages/GroupWorkspacePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { SubscriptionCheckoutPage } from './pages/SubscriptionCheckoutPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { navigate } = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      navigate('/connexion');
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-sm text-slate-600">Chargement de votre espace KPATA...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { pathname } = useRouter();
  const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  // Public indexable pages
  if (cleanPath === '/') return <HomePage />;
  if (cleanPath === '/fonctionnalites') return <FeaturesPage />;
  if (cleanPath === '/groupes') return <GroupsShowcasePage />;
  if (cleanPath === '/tarifs') return <PricingPage />;
  if (cleanPath === '/faq') return <FaqPage />;
  if (cleanPath === '/contact') return <ContactPage />;
  if (cleanPath === '/conditions-generales') return <TermsPage />;
  if (cleanPath === '/confidentialite') return <PrivacyPage />;

  // Authentication pages (noindex)
  if (cleanPath === '/connexion') return <LoginPage />;
  if (cleanPath === '/inscription') return <RegisterPage />;
  if (cleanPath === '/mot-de-passe-oublie' || cleanPath === '/reinitialiser-mot-de-passe') {
    return <ForgotPasswordPage />;
  }
  if (cleanPath === '/verifier-email') return <LoginPage />;

  // Central Admin workspace (noindex)
  if (cleanPath === '/admin') return <AdminDashboardPage />;

  // Private application routes (noindex + auth protected)
  if (cleanPath === '/app') {
    return (
      <ProtectedRoute>
        <PersonalDashboardPage />
      </ProtectedRoute>
    );
  }
  if (cleanPath === '/app/abonnement') {
    return (
      <ProtectedRoute>
        <SubscriptionCheckoutPage />
      </ProtectedRoute>
    );
  }
  if (cleanPath === '/app/groups') {
    return (
      <ProtectedRoute>
        <GroupsListPage />
      </ProtectedRoute>
    );
  }
  if (cleanPath.startsWith('/app/groups/')) {
    const groupId = decodeURIComponent(cleanPath.replace('/app/groups/', '').split('/')[0] || '');
    if (!groupId) return <NotFoundPage />;
    return (
      <ProtectedRoute>
        <GroupWorkspacePage groupId={groupId} />
      </ProtectedRoute>
    );
  }
  if (cleanPath === '/app/invitations') {
    return (
      <ProtectedRoute>
        <InvitationsPage />
      </ProtectedRoute>
    );
  }
  if (cleanPath === '/app/notifications') {
    return (
      <ProtectedRoute>
        <NotificationsPage />
      </ProtectedRoute>
    );
  }
  if (cleanPath === '/app/compte') {
    return (
      <ProtectedRoute>
        <AccountPage />
      </ProtectedRoute>
    );
  }

  return <NotFoundPage />;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <RouterProvider>
          <AppRoutes />
        </RouterProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
