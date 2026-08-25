import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { formatINR } from '@/lib/formatCurrency';

interface BudgetCircleProps {
  spent: number;
  budget: number;
}

export function BudgetCircle({ spent, budget }: BudgetCircleProps) {
  const { percentage, strokeDasharray, strokeDashoffset, color } = useMemo(() => {
    const pct = budget > 0 ? (spent / budget) * 100 : 0;
    const radius = 110;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(pct, 100);
    const offset = circumference - (clamped / 100) * circumference;

    // Color transitions: green → teal → blue → marigold → orange → vermilion (only when over budget)
    let c: string;
    if (pct <= 40) {
      c = 'hsl(108, 51%, 62%)'; // mandi green — comfortable
    } else if (pct <= 60) {
      c = 'hsl(176, 61%, 52%)'; // teal — still good
    } else if (pct <= 75) {
      c = 'hsl(210, 100%, 67%)'; // rickshaw blue — halfway mark
    } else if (pct <= 90) {
      c = 'hsl(36, 100%, 60%)'; // marigold — getting close
    } else if (pct <= 100) {
      c = 'hsl(20, 100%, 60%)'; // orange — nearing limit
    } else {
      c = 'hsl(7, 100%, 60%)';  // vermilion — over budget
    }

    return {
      percentage: pct,
      strokeDasharray: circumference,
      strokeDashoffset: offset,
      color: c,
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
            stroke="hsl(240, 10%, 14%)"
            strokeWidth="10"
          />
          {/* Glow filter */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Progress arc */}
          <motion.circle
            cx="120"
            cy="120"
            r="110"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            initial={{ strokeDashoffset: strokeDasharray }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            filter="url(#glow)"
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
              className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full shadow-lg"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 15px ${color}40`
              }}
            >
              <span
                className="text-xs font-bold text-black"
              >
                {percentage.toFixed(0)}%
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
