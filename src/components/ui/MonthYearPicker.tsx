import { ChevronLeft, ChevronRight } from 'lucide-react';
import { setMonth, setYear, getYear, getMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface MonthYearPickerProps {
  value: Date;
  onChange: (d: Date) => void;
  label: string;
  maxDate?: Date;
}

export function MonthYearPicker({ value, onChange, label, maxDate }: MonthYearPickerProps) {
  const year = getYear(value);
  const month = getMonth(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Compare at month granularity. Comparing full Date instances breaks for the
  // current month because `new Date()` captured at compute time is always a
  // few ms later than the `maxDate={new Date()}` captured at render time, so
  // candidate > maxDate is true even when they're the same calendar month.
  const isMonthAfter = (candYear: number, candMonth: number, ref: Date) => {
    const refYear = getYear(ref);
    const refMonth = getMonth(ref);
    return candYear > refYear || (candYear === refYear && candMonth > refMonth);
  };

  const changeYear = (delta: number) => {
    let newDate = setYear(value, year + delta);
    if (maxDate && newDate > maxDate) {
      newDate = maxDate;
    }
    onChange(newDate);
  };

  const selectMonth = (m: number) => {
    let newDate = setMonth(value, m);
    if (maxDate && newDate > maxDate) {
      newDate = maxDate;
    }
    onChange(newDate);
  };

  const isMonthDisabled = (m: number) => {
    if (!maxDate) return false;
    return isMonthAfter(year, m, maxDate);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <div className="flex items-center justify-between">
        <button
          onClick={() => changeYear(-1)}
          className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-foreground">{year}</span>
        <button
          onClick={() => changeYear(1)}
          className={cn(
            'w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center transition-colors',
            maxDate && year >= getYear(maxDate) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-muted',
          )}
          disabled={maxDate ? year >= getYear(maxDate) : false}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {months.map((m, i) => (
          <button
            key={m}
            onClick={() => selectMonth(i)}
            disabled={isMonthDisabled(i)}
            className={cn(
              'py-2 rounded-lg text-xs font-medium transition-all duration-200',
              month === i
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : isMonthDisabled(i)
                  ? 'text-muted-foreground/30 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
