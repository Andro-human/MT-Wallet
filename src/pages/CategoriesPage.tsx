import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Tag, ChevronRight, Trash2, Pencil, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { useCategories, useCategoryTransactionCounts, useDeleteCategory, useUpdateCategory } from '@/hooks/useCategories';
import { Category } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { CreateCategoryDialog } from '@/components/transactions/CreateCategoryDialog';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const COLOR_OPTIONS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#6366F1', '#14B8A6', '#F97316', '#06B6D4'];

export default function CategoriesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: categories = [], isLoading } = useCategories();
  const { data: categoryCounts = {} } = useCategoryTransactionCounts();
  const deleteCategory = useDeleteCategory();
  const updateCategory = useUpdateCategory();

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    categoryId: string;
    categoryName: string;
    count: number;
  }>({ open: false, categoryId: '', categoryName: '', count: 0 });

  // Edit dialog
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    category: Category | null;
  }>({ open: false, category: null });
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');

  const openEditDialog = (category: Category) => {
    setEditDialog({ open: true, category });
    setEditName(category.name);
    setEditIcon(category.icon);
    setEditColor(category.color);
  };

  const handleDelete = async () => {
    try {
      await deleteCategory.mutateAsync(deleteDialog.categoryId);
      toast({ title: `Category "${deleteDialog.categoryName}" deleted` });
      setDeleteDialog({ open: false, categoryId: '', categoryName: '', count: 0 });
    } catch {
      toast({ title: 'Failed to delete category', variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!editDialog.category) return;
    if (!editName.trim()) {
      toast({ title: 'Name cannot be empty', variant: 'destructive' });
      return;
    }

    try {
      const slug = editName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      await updateCategory.mutateAsync({
        id: editDialog.category.id,
        updates: {
          name: editName.trim(),
          slug,
          icon: editIcon,
          color: editColor,
        },
      });
      toast({ title: 'Category updated' });
      setEditDialog({ open: false, category: null });
    } catch {
      toast({ title: 'Failed to update category', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(252 87% 64% / 0.08), transparent)',
        }}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border/30 safe-area-top">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors -ml-1"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">Categories</h1>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="rounded-xl gap-1.5 h-9"
          >
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>
      </div>

      <div className="px-5 py-6 space-y-3 relative">
        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-2"
        >
          <p className="text-base text-muted-foreground">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
          </p>
        </motion.div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Tag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base text-muted-foreground">No categories yet</p>
            <Button
              className="mt-4 rounded-xl gap-2"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4" />
              Create Category
            </Button>
          </motion.div>
        ) : (
          categories.map((category, i) => {
            const txnCount = categoryCounts[category.id] || 0;
            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="glass-card p-5 group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{
                      backgroundColor: `${category.color}18`,
                      boxShadow: `0 0 0 1px ${category.color}20 inset`,
                    }}
                  >
                    {category.icon}
                  </div>

                  <button
                    onClick={() => navigate(`/transactions?category=${category.id}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-base font-semibold text-foreground truncate">
                      {category.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {txnCount} transaction{txnCount !== 1 ? 's' : ''}
                      {category.is_system && ' · System'}
                    </p>
                  </button>

                  <div className="flex items-center gap-1">
                    {/* Edit — only user-owned categories */}
                    {!category.is_system && (
                      <button
                        onClick={() => openEditDialog(category)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Edit category"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {/* Delete — only user-owned categories */}
                    {!category.is_system && (
                      <button
                        onClick={() =>
                          setDeleteDialog({
                            open: true,
                            categoryId: category.id,
                            categoryName: category.name,
                            count: txnCount,
                          })
                        }
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {/* View transactions */}
                    <button
                      onClick={() => navigate(`/transactions?category=${category.id}`)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}>
        <AlertDialogContent className="glass-elevated border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Delete Category
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-base">
                  Are you sure you want to delete <strong className="text-foreground">{deleteDialog.categoryName}</strong>?
                </p>
                {deleteDialog.count > 0 && (
                  <p className="text-amber-400 font-medium text-base">
                    {deleteDialog.count} transaction{deleteDialog.count !== 1 ? 's' : ''} will be unlinked.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  The transactions themselves won't be deleted — only the category assignment will be cleared.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCategory.isPending}
            >
              {deleteCategory.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Category Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="glass-elevated border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Edit Category</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Icon and Name */}
            <div className="flex gap-3 items-end">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Icon</Label>
                <EmojiPicker value={editIcon} onChange={setEditIcon} />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="editCategoryName" className="text-sm text-muted-foreground">Name</Label>
                <Input
                  id="editCategoryName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Category name"
                  className="bg-muted/30 border-border/50 rounded-xl h-14"
                />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      editColor === c ? 'ring-2 ring-offset-2 ring-offset-background ring-primary' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
              <p className="text-sm text-muted-foreground mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{
                    backgroundColor: `${editColor}18`,
                    boxShadow: `0 0 0 1px ${editColor}20 inset`,
                  }}
                >
                  {editIcon}
                </div>
                <span className="text-base font-semibold text-foreground">{editName || 'Category'}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl border-border/50"
              onClick={() => setEditDialog({ open: false, category: null })}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl"
              onClick={handleUpdate}
              disabled={updateCategory.isPending}
            >
              {updateCategory.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Category Dialog */}
      <CreateCategoryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
