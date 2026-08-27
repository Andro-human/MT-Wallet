import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background relative selection:bg-gold/30 bg-grain">

      <main className="relative pb-24 z-10">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
