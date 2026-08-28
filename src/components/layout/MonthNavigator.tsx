import { format, addMonths, subMonths, isSameMonth, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Arrows and a month name. The same control Activity uses, so moving between
 *  months feels identical wherever it appears.
 *
 *  Forward is disabled at the current month: there is no data ahead of today,
 *  and an arrow that does nothing is worse than one that is visibly spent. */
export function MonthNavigator({
  month,
  onChange,
  className = '',
}: {
  month: Date;
  onChange: (next: Date) => void;
  className?: string;
}) {
  const canGoNext = !isSameMonth(month, new Date());

  return (
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(startOfMonth(subMonths(month, 1)))}
        aria-label="Previous month"
        className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 active:bg-muted/60 active:scale-95 transition-all touch-manipulation"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <span className="text-sm font-medium text-foreground min-w-[130px] text-center select-none tabular-nums">
        {format(month, 'MMMM yyyy')}
      </span>
      <button
        type="button"
        onClick={() => onChange(startOfMonth(addMonths(month, 1)))}
        disabled={!canGoNext}
        aria-label="Next month"
        className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 active:bg-muted/60 active:scale-95 transition-all touch-manipulation disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:active:scale-100"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
