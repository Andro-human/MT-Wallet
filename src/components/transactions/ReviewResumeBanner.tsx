import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookmarkCheck } from 'lucide-react';
import { useState } from 'react';
import { useClearReviewBookmark } from '@/hooks/useReviewBookmark';
import { useToast } from '@/hooks/use-toast';

interface ReviewResumeBannerProps {
  newCount: number;
  bookmarkDate: Date;
  onResume: () => void;
}

export function ReviewResumeBanner({
  newCount,
  bookmarkDate,
  onResume,
}: ReviewResumeBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const clearBookmark = useClearReviewBookmark();
  const { toast } = useToast();

  if (newCount <= 0 || dismissed) return null;

  const handleClear = async () => {
    try {
      await clearBookmark.mutateAsync();
      toast({ title: 'Bookmark cleared' });
    } catch {
      toast({ title: 'Failed to clear bookmark', variant: 'destructive' });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="glass-card p-3 mb-3 flex items-center gap-3 border-l-2 border-l-primary"
      >
        <button
          onClick={onResume}
          className="flex items-center gap-3 flex-1 text-left min-w-0"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <BookmarkCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Catch up — {newCount} new
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Since {format(bookmarkDate, 'MMM d, yyyy')}
            </p>
          </div>
        </button>

        <button
          onClick={handleClear}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
          aria-label="Clear bookmark"
          title="Clear bookmark"
        >
          <X className="w-4 h-4" />
        </button>

        <button
          onClick={() => setDismissed(true)}
          className="text-xs font-mono uppercase text-muted-foreground hover:text-foreground tracking-wider flex-shrink-0"
        >
          Hide
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
