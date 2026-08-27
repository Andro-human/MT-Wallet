import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FolderKanban,
  Trash2,
  Pencil,
  Plus,
  Loader2,
  AlertTriangle,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import {
  TransactionGroup,
  useTransactionGroups,
  useDeleteTransactionGroup,
  useArchiveTransactionGroup,
  useUnarchiveTransactionGroup,
} from '@/hooks/useTransactionGroups';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CreateGroupDialog } from '@/components/transactions/CreateGroupDialog';
import { entityColor } from '@/lib/categoryColors';
import { useEntityTotals } from '@/hooks/useEntityTotals';
import { formatINRCompact } from '@/lib/formatCurrency';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function GroupsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: groups = [], isLoading } = useTransactionGroups();
  const { byGroup, maxGroupSpent } = useEntityTotals();

  // Live groups first, then heaviest spend: archived ones are history and
  // belong at the bottom, not interleaved by size.
  const ranked = useMemo(
    () =>
      [...groups].sort((a, b) => {
        const arch = Number(!!a.archived_at) - Number(!!b.archived_at);
        if (arch !== 0) return arch;
        const d = (byGroup[b.id]?.spent ?? 0) - (byGroup[a.id]?.spent ?? 0);
        return d !== 0 ? d : a.name.localeCompare(b.name);
      }),
    [groups, byGroup],
  );
  const deleteGroup = useDeleteTransactionGroup();
  const archiveGroup = useArchiveTransactionGroup();
  const unarchiveGroup = useUnarchiveTransactionGroup();

  const [dialog, setDialog] = useState<{ open: boolean; group: TransactionGroup | null }>({
    open: false,
    group: null,
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    groupId: string;
    groupName: string;
    count: number;
  }>({ open: false, groupId: '', groupName: '', count: 0 });

  const handleDelete = async () => {
    try {
      await deleteGroup.mutateAsync(deleteDialog.groupId);
      toast({ title: `Group "${deleteDialog.groupName}" deleted` });
      setDeleteDialog({ open: false, groupId: '', groupName: '', count: 0 });
    } catch {
      toast({ title: 'Failed to delete group', variant: 'destructive' });
    }
  };

  const handleArchive = async (group: TransactionGroup) => {
    try {
      if (group.archived_at) {
        await unarchiveGroup.mutateAsync(group.id);
        toast({ title: 'Group unarchived' });
      } else {
        await archiveGroup.mutateAsync(group.id);
        toast({ title: 'Group archived' });
      }
    } catch {
      toast({ title: 'Failed to update group', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(252 87% 64% / 0.08), transparent)',
        }}
      />

      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border/30 safe-area-top">
        <div className="flex items-center justify-between px-5 py-3 page-shell">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors -ml-1"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">Groups</h1>
          </div>
          <Button
            size="sm"
            onClick={() => setDialog({ open: true, group: null })}
            className="rounded-xl gap-1.5 h-9"
          >
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>
      </div>

      <div className="px-5 py-6 pb-24 relative safe-area-bottom page-shell">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-2"
        >
          <p className="text-base text-muted-foreground">
            {groups.length} group{groups.length !== 1 ? 's' : ''}
          </p>
        </motion.div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <FolderKanban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base text-muted-foreground">No groups yet</p>
            <Button
              className="mt-4 rounded-xl gap-2"
              onClick={() => setDialog({ open: true, group: null })}
            >
              <Plus className="w-4 h-4" />
              Create Group
            </Button>
          </motion.div>
        ) : (
          <div>
            {ranked.map((group, i) => {
              const total = byGroup[group.id];
              const spent = total?.spent ?? 0;
              const counted = total?.counted ?? 0;
              const barWidth = maxGroupSpent > 0 ? (spent / maxGroupSpent) * 100 : 0;
              const isArchived = !!group.archived_at;
              return (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.02, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className={`group border-b border-border/50 last:border-b-0 py-3.5 ${isArchived ? 'opacity-55' : ''}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <button
                      onClick={() => navigate(`/transactions?group=${group.id}`)}
                      className="flex items-baseline gap-2.5 min-w-0 text-left"
                    >
                      <span className="text-base leading-none shrink-0">{group.icon}</span>
                      <span className="font-heading text-lg font-normal truncate group-hover:text-primary transition-colors">
                        {group.name}
                      </span>
                      {isArchived && (
                        <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground/50 shrink-0">
                          archived
                        </span>
                      )}
                    </button>

                    <span className="flex items-baseline gap-2.5 shrink-0">
                      <span className="hidden sm:inline text-2xs text-muted-foreground/70">
                        {counted} txn{counted !== 1 ? 's' : ''}
                      </span>
                      <span className="amount text-sm">{formatINRCompact(spent)}</span>
                      <span className="flex items-center justify-end gap-0.5 w-[4.75rem]">
                        <button
                          onClick={() => handleArchive(group)}
                          className="p-1 rounded text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                          title={isArchived ? 'Unarchive' : 'Archive'}
                          aria-label={isArchived ? 'Unarchive group' : 'Archive group'}
                        >
                          {isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setDialog({ open: true, group })}
                          className="p-1 rounded text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Edit group"
                          aria-label="Edit group"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              groupId: group.id,
                              groupName: group.name,
                              count: counted,
                            })
                          }
                          className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete group"
                          aria-label="Delete group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </span>
                  </div>

                  {group.description && (
                    <p className="mt-0.5 text-2xs text-muted-foreground/70 truncate prose-column">
                      {group.description}
                    </p>
                  )}

                  {spent > 0 && (
                    <div className="mt-2 h-1 w-full rounded-full bg-muted/25 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(barWidth, 0.6)}%`, background: entityColor(group.id) }}
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent className="glass-elevated border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Delete Group
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-base">
                  Are you sure you want to delete{' '}
                  <strong className="text-foreground">{deleteDialog.groupName}</strong>?
                </p>
                {deleteDialog.count > 0 && (
                  <p className="text-warning font-medium text-base">
                    {deleteDialog.count} transaction
                    {deleteDialog.count !== 1 ? 's' : ''} will become ungrouped.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  The transactions themselves won't be deleted. Consider archiving if you
                  want to keep the history.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteGroup.isPending}
            >
              {deleteGroup.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateGroupDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        initialGroup={dialog.group}
      />
    </div>
  );
}
