import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Wand2, Trash2, Search, Tag, Wallet, Banknote, Edit3 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useMerchantMappings, useDeleteMerchantMapping } from '@/hooks/useMerchantMappings';
import { useCategories } from '@/hooks/useCategories';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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

export default function MerchantRulesPage() {
  const navigate = useNavigate();
  const { data: mappings = [], isLoading } = useMerchantMappings();
  const { data: categories = [] } = useCategories();
  const deleteMapping = useDeleteMerchantMapping();

  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      <div className="px-5 pt-6 md:pt-12 pb-24 safe-area-top min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border/50 pb-4 mb-6">
          <div className="flex items-center gap-3">
             <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors -ml-2"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground leading-none">Automation Rules</h1>
              <p className="text-xs font-mono text-muted-foreground mt-1 uppercase tracking-widest">
                {mappings.length} ACTIVE {mappings.length === 1 ? 'RULE' : 'RULES'}
              </p>
            </div>
          </div>
        </div>

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
        <div className="space-y-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-border rounded-3xl">
              <Wand2 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-foreground">No rules found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? 'Try adjusting your search.' : 'You haven\'t created any automation rules yet.'}
              </p>
            </div>
          ) : (
            filteredMappings.map((mapping, index) => (
              <motion.div
                key={mapping.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="neo-card p-0 overflow-hidden group"
              >
                <div className="p-4 border-b border-border/50 bg-muted/5 flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
                      When SMS From
                    </span>
                    <h3 className="text-base font-bold text-foreground mt-0.5">
                      {mapping.raw_merchant}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setDeletingId(mapping.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="p-4 bg-background space-y-3">
                  <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider block mb-2">
                    Automatically Apply
                  </span>
                  
                  {/* Name Mapping */}
                  {mapping.mapped_merchant && mapping.mapped_merchant !== mapping.raw_merchant && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-6 flex justify-center"><Edit3 className="w-4 h-4 text-muted-foreground" /></div>
                      <span className="text-muted-foreground">Rename to</span>
                      <span className="font-semibold text-foreground">{mapping.mapped_merchant}</span>
                    </div>
                  )}

                  {/* Category Mapping */}
                  {mapping.default_category_id && categoryMap.has(mapping.default_category_id) && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-6 flex justify-center"><Tag className="w-4 h-4 text-muted-foreground" /></div>
                      <span className="text-muted-foreground">Categorize as</span>
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        {categoryMap.get(mapping.default_category_id)?.icon}
                        {categoryMap.get(mapping.default_category_id)?.name}
                      </span>
                    </div>
                  )}

                  {/* Expense Constraint */}
                  {mapping.default_is_expense !== null && (
                    <div className="flex items-center gap-3 text-sm">
                       <div className="w-6 flex justify-center"><Wallet className="w-4 h-4 text-muted-foreground" /></div>
                       <span className="text-muted-foreground">Expense status</span>
                       <span className={`font-semibold ${mapping.default_is_expense ? 'text-destructive' : 'text-foreground'}`}>
                         {mapping.default_is_expense ? 'Force as Expense' : 'Never an Expense'}
                       </span>
                    </div>
                  )}

                  {/* Income Constraint */}
                  {mapping.default_is_income !== null && (
                    <div className="flex items-center gap-3 text-sm">
                       <div className="w-6 flex justify-center"><Banknote className="w-4 h-4 text-muted-foreground" /></div>
                       <span className="text-muted-foreground">Income status</span>
                       <span className={`font-semibold ${mapping.default_is_income ? 'text-success' : 'text-foreground'}`}>
                         {mapping.default_is_income ? 'Force as Income' : 'Never an Income'}
                       </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

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
