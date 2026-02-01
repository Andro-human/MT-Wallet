import { NavLink, useLocation } from 'react-router-dom';
import { Home, Receipt, TrendingUp, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/transactions', icon: Receipt, label: 'Activity' },
  { to: '/insights', icon: TrendingUp, label: 'Insights' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-2 safe-area-bottom">
      <div className="nav-pill flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          const Icon = item.icon;
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="relative flex flex-col items-center justify-center w-16 h-full"
            >
              <div className="relative">
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -inset-3 rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, hsl(252 87% 64% / 0.2) 0%, hsl(280 85% 55% / 0.1) 100%)',
                      boxShadow: '0 0 20px -4px hsl(252 87% 64% / 0.3)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon
                  className={cn(
                    'relative w-5 h-5 transition-all duration-300',
                    isActive 
                      ? 'text-primary drop-shadow-[0_0_8px_hsl(252_87%_64%/0.5)]' 
                      : 'text-muted-foreground'
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] mt-1.5 font-medium tracking-wide transition-colors duration-300',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
