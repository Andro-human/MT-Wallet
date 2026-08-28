import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Wand2, Trash2, Search, Tag, Wallet, Banknote, Edit3, Plus, Pencil } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useMerchantMappings, useDeleteMerchantMapping, UserMerchantMapping } from '@/hooks/useMerchantMappings';
import { useCategories } from '@/hooks/useCategories';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AddRuleDialog } from '@/components/settings/AddRuleDialog';
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

interface RuleLineProps {
  mapping: UserMerchantMapping;
  category?: { icon: string; name: string };
}

// Qualifiers narrow when the rule fires; effects are what it does. Neither is
// money, so neither takes the money colours: DESIGN.md forbids red for expense
// and green for income, and this page had both.
function RuleLine({ mapping, category }: RuleLineProps) {
  const qualifiers: string[] = [];
  if (mapping.match_type === 'contains') qualifiers.push('contains');
  if (mapping.amount_operator) qualifiers.push(`amt ${mapping.amount_operator} \u20B9${mapping.amount_threshold}`);
  if (mapping.date_operator) qualifiers.push(`day ${mapping.date_operator} ${mapping.date_threshold}`);

  const effects: string[] = [];
  if (mapping.mapped_merchant && mapping.mapped_merchant !== mapping.raw_merchant) {
    effects.push(`rename to ${mapping.mapped_merchant}`);
  }
  if (category) effects.push(`file under ${category.icon} ${category.name}`);
  if (mapping.default_is_expense !== null) {
    effects.push(mapping.default_is_expense ? 'force expense' : 'never an expense');
  }
  if (mapping.default_is_income !== null) {
    effects.push(mapping.default_is_income ? 'force income' : 'never an income');
  }

  return (
    <>
      {qualifiers.length > 0 && (
        <span className="text-2xs font-mono text-muted-foreground shrink-0">
          {qualifiers.join('  ')}
        </span>
      )}
      <span className="text-2xs text-foreground/80 truncate">
        {effects.length > 0 ? effects.join('  \u00B7  ') : <span className="text-muted-foreground">no effect set</span>}
      </span>
    </>
  );
}

export default function MerchantRulesPage() {
  const navigate = useNavigate();
  const { data: mappings = [], isLoading } = useMerchantMappings();
  const { data: categories = [] } = useCategories();
  const deleteMapping = useDeleteMerchantMapping();

  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<UserMerchantMapping | null>(null);

  const categoryMap = useMemo(() => {
    return new Map(categories.map(c => [c.id, c]));
  }, [categories]);

  const filteredMappings = useMemo(() => {
    if (!search.trim()) return mappings;
    const q = search.toLowerCase();
    return mappings.filter(m => 
      m.raw_merchant.toLowerCase().includes(q) || 
      (m.mapped_merchant && m.mapped_merchant.toLowerCase().includes(q))
    );
  }, [mappings, search]);

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteMapping.mutateAsync(deletingId);
    setDeletingId(null);
  };

  return (
    <AppLayout>
      {/* Sticky page header — matches Bank Accounts / Categories pattern */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/95 border-b border-border/30 safe-area-top">
        <div className="flex items-center gap-3 px-5 py-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors -ml-1"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground flex-1">Automation Rules</h1>
          <Button
            onClick={() => {
              setEditingRule(null);
              setShowAddDialog(true);
            }}
            size="sm"
            className="rounded-xl gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </Button>
        </div>
      </div>

      <div className="px-5 py-6 pb-24 min-h-screen page-shell">
        {/* Subtitle — count of active rules */}
        <p className="text-base text-muted-foreground mb-4">
          {mappings.length} active rule{mappings.length === 1 ? '' : 's'}
        </p>

        {/* Info Card */}
        <motion.div
           initial={{ opacity: 0, y: 16 }}
           animate={{ opacity: 1, y: 0 }}
           className="neo-card p-5 mb-6 bg-primary/5 border-primary/20"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Wand2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">How rules work</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Rules are created automatically when you check "Remember this for future transactions" while editing a transaction. They are applied instantly when a new SMS matching the raw merchant name is ingested.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules by merchant name..."
            className="pl-10 h-12 bg-muted/10 border-border rounded-xl focus:bg-background focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Rules List */}
        <div>
          {isLoading ? (
            Array(8).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded mb-1" />
            ))
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-border rounded-3xl">
              <Wand2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-bold text-foreground">No rules found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? 'Try adjusting your search.' : 'You haven\'t created any automation rules yet.'}
              </p>
            </div>
          ) : (
            filteredMappings.map((mapping, index) => (
              <motion.div
                key={mapping.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 15) * 0.015, duration: 0.2 }}
                className="group flex flex-wrap sm:flex-nowrap items-start sm:items-baseline gap-x-3 border-b border-border/40 last:border-b-0 py-2.5"
              >
                <span
                  className="font-mono text-xs text-foreground truncate flex-1 sm:flex-none sm:basis-[26%] shrink-0 order-1"
                  title={mapping.raw_merchant}
                >
                  {mapping.raw_merchant}
                </span>

                <span className="basis-full sm:basis-auto sm:flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2.5 order-3 sm:order-2">
                  <RuleLine
                    mapping={mapping}
                    category={
                      mapping.default_category_id
                        ? categoryMap.get(mapping.default_category_id)
                        : undefined
                    }
                  />
                </span>

                <span className="flex items-center justify-end gap-0.5 w-[3.25rem] shrink-0 order-2 sm:order-3">
                  <button
                    onClick={() => {
                      setEditingRule(mapping);
                      setShowAddDialog(true);
                    }}
                    aria-label={`Edit rule for ${mapping.raw_merchant}`}
                    className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingId(mapping.id)}
                    aria-label={`Delete rule for ${mapping.raw_merchant}`}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <AddRuleDialog 
        open={showAddDialog} 
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) setEditingRule(null);
        }} 
        categories={categories} 
        editingRule={editingRule}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent className="glass-elevated border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Automation Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the saved automation preferences for this merchant. Future transactions from this merchant will rely entirely on the AI categorizer instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
