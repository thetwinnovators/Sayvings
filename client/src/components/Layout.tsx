import { Link, useLocation } from 'wouter';
import { LayoutDashboard, CreditCard, Wallet, Target, Calendar, MessageCircle, TrendingUp } from 'lucide-react';

const navItems = [
  { path: '/',          icon: LayoutDashboard, label: 'Home' },
  { path: '/budget',    icon: Wallet,          label: 'Budget' },
  { path: '/goals',     icon: Target,          label: 'Goals' },
  { path: '/debt',      icon: CreditCard,      label: 'Debt' },
  { path: '/calendar',  icon: Calendar,        label: 'Calendar' },
  { path: '/chat',      icon: MessageCircle,   label: 'Finn' },
];

const sidebarItems = [
  { path: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/budget',    icon: Wallet,          label: 'Budget' },
  { path: '/goals',     icon: Target,          label: 'Goals' },
  { path: '/debt',      icon: CreditCard,      label: 'Debt Eliminator' },
  { path: '/calendar',  icon: Calendar,        label: 'Calendar' },
  { path: '/retirement',icon: TrendingUp,      label: '401k Advisor' },
  { path: '/chat',      icon: MessageCircle,   label: 'Ask Finn' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-1)', color: 'var(--text-primary)' }}>

      {/* Sidebar -- desktop */}
      <aside className="hidden md:flex flex-col w-52 fixed top-0 left-0 h-screen z-40 sv-sidebar">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-label="Sayvings logo">
            <circle cx="14" cy="14" r="13" stroke="var(--teal)" strokeWidth="2" />
            <path d="M8 14 C8 10.5 10.5 8 14 8 C17.5 8 20 10.5 20 14"
              stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="14" cy="19" r="2.5" fill="var(--teal)" />
            <line x1="14" y1="14" x2="14" y2="17" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Sayvings</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 flex flex-col gap-0.5">
          {sidebarItems.map(({ path, icon: Icon, label }) => {
            const active = location === path;
            return (
              <Link key={path} href={path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: active ? 'var(--surface-1)' : 'transparent',
                  color: active ? 'var(--teal)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400,
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}>
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 text-xs" style={{ color: 'var(--text-faint)' }}>
          Data stays on your device
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 md:ml-52 pb-20 md:pb-0 min-h-screen overflow-x-hidden w-full">
        {children}
      </main>

      {/* Bottom nav -- mobile */}
      <nav className="bottom-nav md:hidden">
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location === path;
          return (
            <Link key={path} href={path}
              className="flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium transition-all"
              style={{ color: active ? 'var(--teal)' : 'var(--text-faint)' }}>
              <Icon size={21} strokeWidth={active ? 2.2 : 1.7} />
              <span style={{ fontSize: 10 }}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
