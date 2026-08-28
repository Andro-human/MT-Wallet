import { Link } from 'react-router-dom';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useCategorySuggestions } from '@/hooks/useCategorySuggestions';

/** Home entry point for the suggestions inbox.
 *
 *  These labels were previously only visible by opening a transaction one at a
 *  time, so nobody ever saw them. Deliberately one quiet line rather than a
 *  filled vermilion banner: DESIGN.md reserves the accent for anomalies and its
 *  scarcity is the point, and a backlog that sits for weeks would burn it. The
 *  accent lands on the action word only.
 */
export function SuggestionsLine() {
  const { count, moves, isLoading } = useCategorySuggestions();

  if (isLoading || count === 0) return null;

  return (
    <Link
      to="/suggestions"
      className="group flex items-center gap-3 mb-6 md:mb-8 py-2.5 border-y border-border/50"
    >
      <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-foreground/90 min-w-0 flex-1 truncate">
        {count} transaction{count === 1 ? '' : 's'} may be filed under the wrong
        category
        <span className="text-muted-foreground">
          {' '}
          · {moves.length} move{moves.length === 1 ? '' : 's'}
        </span>
      </span>
      <span className="flex items-center gap-1 text-2xs font-mono uppercase tracking-wider text-primary shrink-0">
        Review
        <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
