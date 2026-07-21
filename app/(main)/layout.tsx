'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import BackButton from '@/components/ui/BackButton';

// Pages/prefixes that already have their own back nav or don't need one
const NO_BACK_PAGES = new Set(['/dashboard']);
const NO_BACK_PREFIXES = ['/crowd-monitor/station/'];

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1f5f9' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', boxShadow: '0 0 20px rgba(59,130,246,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>F</span>
      </div>
      <div style={{ width: 20, height: 20, border: '2px solid #bfdbfe', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // mounted ensures the first client render matches the server render (both show Spinner),
  // preventing the hydration mismatch caused by localStorage being unavailable on the server.
  const [mounted, setMounted] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Close mobile drawer on navigation
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Prevent background scroll while the mobile drawer is open
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [navOpen]);

  if (!mounted || (isLoading && !isAuthenticated)) return <Spinner />;

  // Auth check complete — not logged in → nothing (useEffect above redirects to /login)
  if (!isAuthenticated) return null;

  return (
    <NotificationProvider>
      <div className="app-shell" style={{ display: 'flex', height: '100dvh', background: '#f1f5f9', overflow: 'hidden' }}>
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden', width: '100%' }}>
          <Header onMenuClick={() => setNavOpen(true)} />
          <main className="app-main" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {!NO_BACK_PAGES.has(pathname) &&
             !NO_BACK_PREFIXES.some(p => pathname.startsWith(p)) && (
              <div style={{ marginBottom: 12 }}>
                <BackButton />
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}
