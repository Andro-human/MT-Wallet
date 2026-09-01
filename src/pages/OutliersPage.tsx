import { AppLayout } from '@/components/layout/AppLayout';
import { MonthDifferences } from '@/components/insights/MonthDifferences';

export default function OutliersPage() {
  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-28 page-shell">
        <div className="mb-1 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
          Insights
        </div>
        <h1 className="mb-3 font-heading text-[30px] leading-tight text-foreground">
          What made each month different
        </h1>
        <MonthDifferences />
      </div>
    </AppLayout>
  );
}
