import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background relative selection:bg-primary/30">
      {/* Neo Grid Background */}
      <div className="fixed inset-0 bg-grid-small opacity-20 pointer-events-none" />

      <main className="relative pb-24 z-10">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
