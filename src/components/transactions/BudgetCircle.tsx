import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { formatINR } from '@/lib/formatCurrency';

interface BudgetCircleProps {
  spent: number;
  budget: number;
}

export function BudgetCircle({ spent, budget }: BudgetCircleProps) {
  const { percentage, strokeDasharray, strokeDashoffset, color, fromColor } = useMemo(() => {
    const pct = budget > 0 ? (spent / budget) * 100 : 0;
    const radius = 110;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(pct, 100);
    const offset = circumference - (clamped / 100) * circumference;

    // The arc is a sweep, so give it two stops and let it travel. It leaves
    // gold, the colour money-still-yours carries everywhere else, and arrives
    // at whatever the pace has earned.
    let from: string;
    let c: string;
    if (pct <= 40) {
      from = '#E9C46A';
      c = '#7FCF6B'; // mandi green, comfortable
    } else if (pct <= 60) {
      from = '#9FD97F';
      c = '#3BD0C5'; // teal, still good
    } else if (pct <= 75) {
      from = '#5AC8A0';
      c = '#55A9FF'; // rickshaw blue, halfway
    } else if (pct <= 90) {
      from = '#E9C46A';
      c = '#FFAE33'; // marigold, getting close
    } else if (pct <= 100) {
      from = '#FFAE33';
      c = '#FF8C42'; // orange, nearing the limit
    } else {
      from = '#FF8C42';
      c = '#FF4B33'; // vermilion, over
    }

    return {
      percentage: pct,
      strokeDasharray: circumference,
      strokeDashoffset: offset,
      color: c,
      fromColor: from,
    };
  }, [spent, budget]);

  return (
    <div className="relative flex flex-col items-center">
      {/* SVG Circle */}
      <div className="relative w-56 h-56">
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 240 240"
        >
          {/* Background track */}
          <circle
            cx="120"
            cy="120"
            r="110"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
          />
          <defs>
            <linearGradient id="budget-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={fromColor} />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>
          {/* Progress arc */}
          <motion.circle
            cx="120"
            cy="120"
            r="110"
            fill="none"
            stroke="url(#budget-arc)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            initial={{ strokeDashoffset: strokeDasharray }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
          {/* Dot at the end of arc */}
          {budget > 0 && (
            <motion.circle
              cx="120"
              cy="10"
              r="5"
              fill={color}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              style={{
                transformOrigin: '120px 120px',
                transform: `rotate(${Math.min(percentage, 100) * 3.6}deg)`,
              }}
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <ArrowUpRight className="w-5 h-5 text-muted-foreground mb-1" />
          <p className="text-2xl font-bold text-foreground currency-display">
            {formatINR(spent)}
          </p>
          {budget > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full"
              style={{ backgroundColor: color }}
            >
              <span className="text-xs font-bold" style={{ color: '#241F18' }}>
                {percentage.toFixed(0)}%
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
