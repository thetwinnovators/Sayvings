import { Router, Switch, Route } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { Toaster } from '@/components/ui/toaster';
import { useEffect, useState } from 'react';
import { loadData } from '@/lib/storage';
import Onboarding from '@/pages/Onboarding';
import Dashboard from '@/pages/Dashboard';
import Debt from '@/pages/Debt';
import Budget from '@/pages/Budget';
import Goals from '@/pages/Goals';
import Calendar from '@/pages/Calendar';
import Chat from '@/pages/Chat';
import Retirement from '@/pages/Retirement';
import Layout from '@/components/Layout';

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    const data = loadData();
    setOnboarded(!!data.profile?.onboardingComplete);
    setReady(true);
  }, []);

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-1)' }}>
      <div className="flex gap-2">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );

  if (!onboarded) return (
    <>
      <Onboarding onComplete={() => setOnboarded(true)} />
      <Toaster />
    </>
  );

  return (
    <>
      <Router hook={useHashLocation}>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/debt" component={Debt} />
            <Route path="/budget" component={Budget} />
            <Route path="/goals" component={Goals} />
            <Route path="/calendar" component={Calendar} />
            <Route path="/chat" component={Chat} />
            <Route path="/retirement" component={Retirement} />
          </Switch>
        </Layout>
      </Router>
      <Toaster />
    </>
  );
}
