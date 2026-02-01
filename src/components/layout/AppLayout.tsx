import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Subtle gradient overlay for depth */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(252 87% 64% / 0.08), transparent)',
        }}
      />
      <main className="relative pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
