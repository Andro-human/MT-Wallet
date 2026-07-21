import { NavLink, useLocation } from 'react-router-dom';
import { Home, Receipt, TrendingUp, Settings, Repeat, HandCoins } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/transactions', icon: Receipt, label: 'Activity' },
  { to: '/subscriptions', icon: Repeat, label: 'Subs' },
  { to: '/insights', icon: TrendingUp, label: 'Insights' },
  { to: '/debt', icon: HandCoins, label: 'Debt' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 md:bottom-6 left-0 right-0 z-50 px-6 pointer-events-none safe-area-bottom pb-2 md:pb-0">
      <div className="mx-auto max-w-sm pointer-events-auto">
        <div className="bg-card border border-border rounded-2xl shadow-2xl flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="relative flex flex-col items-center justify-center w-16 h-full group"
              >
                <div className="relative z-10">
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-all duration-200',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 w-8 h-0.5 bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className={cn(
                  "text-[9px] uppercase tracking-widest mt-1.5 font-mono",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {isActive ? item.label : ''}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
