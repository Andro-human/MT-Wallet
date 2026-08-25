import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FolderKanban,
  ChevronRight,
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
  useTransactionCountsByGroup,
  useDeleteTransactionGroup,
  useArchiveTransactionGroup,
  useUnarchiveTransactionGroup,
} from '@/hooks/useTransactionGroups';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CreateGroupDialog } from '@/components/transactions/CreateGroupDialog';
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
  const { data: counts = {} } = useTransactionCountsByGroup();
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
        <div className="flex items-center justify-between px-5 py-3">
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

      <div className="px-5 py-6 pb-24 space-y-3 relative safe-area-bottom">
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
          groups.map((group, i) => {
            const txnCount = counts[group.id] ?? 0;
            const isArchived = !!group.archived_at;
            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={`glass-card p-5 group ${isArchived ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{
                      backgroundColor: `${group.color}18`,
                      boxShadow: `0 0 0 1px ${group.color}20 inset`,
                    }}
                  >
                    {group.icon}
                  </div>

                  <button
                    onClick={() => navigate(`/transactions?group=${group.id}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-foreground truncate">
                        {group.name}
                      </p>
                      {isArchived && (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border/50 px-1.5 py-0.5 rounded">
                          archived
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {txnCount} transaction{txnCount !== 1 ? 's' : ''}
                      {group.description && ` · ${group.description}`}
                    </p>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleArchive(group)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title={isArchived ? 'Unarchive' : 'Archive'}
                      aria-label={isArchived ? 'Unarchive group' : 'Archive group'}
                    >
                      {isArchived ? (
                        <ArchiveRestore className="w-4 h-4" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setDialog({ open: true, group })}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Edit group"
                      aria-label="Edit group"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteDialog({
                          open: true,
                          groupId: group.id,
                          groupName: group.name,
                          count: txnCount,
                        })
                      }
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete group"
                      aria-label="Delete group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/transactions?group=${group.id}`)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      aria-label="View transactions"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
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
