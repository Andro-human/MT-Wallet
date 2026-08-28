import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight, Check, X, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  useCategorySuggestions,
  useResolveSuggestions,
  type CategorySuggestion,
  type SuggestionCategory,
  type SuggestionMove,
} from '@/hooks/useCategorySuggestions';
import { formatINR } from '@/lib/formatCurrency';
import { entityColor } from '@/lib/categoryColors';

function CategoryChip({ category }: { category: SuggestionCategory | null }) {
  if (!category) {
    return <span className="text-2xs text-muted-foreground">no category</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span
        className="w-2 h-2 shrink-0"
        style={{ backgroundColor: entityColor(category.id) }}
      />
      <span className="text-xs font-medium text-foreground truncate">
        {category.icon} {category.name}
      </span>
    </span>
  );
}

export default function SuggestionsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { moves, count, isLoading } = useCategorySuggestions();
  const resolve = useResolveSuggestions();

  const run = async (
    mode: 'apply' | 'dismiss',
    items: CategorySuggestion[],
    to: SuggestionCategory,
  ) => {
    try {
      await resolve.mutateAsync({
        mode,
        categoryId: mode === 'apply' ? to.id : undefined,
        items,
      });
      const n = items.length;
      toast({
        title:
          mode === 'apply'
            ? `Moved ${n} to ${to.name}`
            : `Dismissed ${n} suggestion${n === 1 ? '' : 's'}`,
      });
    } catch {
      toast({ title: 'Could not save that', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/95 border-b border-border/30 safe-area-top">
        <div className="flex items-center gap-3 px-5 py-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors -ml-1"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground flex-1">Suggestions</h1>
          {count > 0 && (
            <span className="amount text-xs text-muted-foreground">{count}</span>
          )}
        </div>
      </div>

      <div className="px-5 py-6 pb-24 min-h-screen page-shell">
        <p className="text-sm text-muted-foreground prose-column mb-6 leading-relaxed">
          The nightly review reads your notes and flags transactions that look filed
          under the wrong category. Nothing here has been applied. Identical moves are
          grouped, so eight Amazon rows heading to Groceries are one decision.
        </p>

        {isLoading ? (
          <div>
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded mb-2" />
              ))}
          </div>
        ) : moves.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-border rounded-2xl">
            <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground">Nothing to review</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Every suggestion has been applied or dismissed. The nightly run adds new
              ones when a note disagrees with a category.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {moves.map((move: SuggestionMove) => (
              <section key={move.key}>
                {/* The move is the headline, so on a phone it takes the whole
                    first line rather than competing with the count and the two
                    buttons: at 390px that squeezed both category names down to
                    "Sh..." and "Gro...". */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-2 mb-1 border-b border-border/50">
                  <div className="flex items-center gap-2 min-w-0 basis-full sm:basis-auto sm:flex-1">
                    <CategoryChip category={move.from} />
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <CategoryChip category={move.to} />
                  </div>

                  <span className="amount text-2xs text-muted-foreground shrink-0">
                    {move.items.length} · {formatINR(move.total)}
                  </span>

                  <span className="flex items-center gap-1 shrink-0 ml-auto">
                    <button
                      onClick={() => run('apply', move.items, move.to)}
                      disabled={resolve.isPending}
                      className="text-2xs font-medium text-primary px-2 py-1 rounded hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      Apply {move.items.length > 1 ? `all ${move.items.length}` : ''}
                    </button>
                    <button
                      onClick={() => run('dismiss', move.items, move.to)}
                      disabled={resolve.isPending}
                      className="text-2xs font-medium text-muted-foreground px-2 py-1 rounded hover:bg-muted/30 hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </span>
                </div>

                <div>
                  {move.items.map((s) => (
                    <div
                      key={s.transactionId}
                      className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0"
                    >
                      <Link
                        to={`/transactions/${s.transactionId}`}
                        className="min-w-0 flex-1 group"
                      >
                        <p className="text-xs text-foreground truncate group-hover:text-primary transition-colors">
                          {s.notes?.trim() || (
                            <span className="text-muted-foreground">no note</span>
                          )}
                        </p>
                        <p className="text-2xs text-muted-foreground truncate mt-0.5">
                          {s.merchant || 'unknown'} ·{' '}
                          {format(new Date(s.transactedAt), 'd MMM yyyy')}
                        </p>
                      </Link>

                      <span className="amount text-xs text-foreground shrink-0">
                        {formatINR(s.amount)}
                      </span>

                      {/* Muted at rest, accent on hover. Every row here needs a
                          decision, so a vermilion check on all 51 of them
                          colours the normal case and leaves the accent meaning
                          nothing. The group's Apply all keeps it. */}
                      <span className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => run('apply', [s], s.to)}
                          disabled={resolve.isPending}
                          title={`Move to ${s.to.name}`}
                          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => run('dismiss', [s], s.to)}
                          disabled={resolve.isPending}
                          title="Dismiss"
                          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
