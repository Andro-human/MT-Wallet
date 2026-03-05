import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { UserMerchantMapping, useUpdateMerchantMapping } from '@/hooks/useMerchantMappings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Category } from '@/types/database';
import { Switch } from '@/components/ui/switch';
import { Wand2, Plus, ArrowRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AddRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  editingRule?: UserMerchantMapping | null;
}

export function AddRuleDialog({ open, onOpenChange, categories, editingRule }: AddRuleDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rawMerchant, setRawMerchant] = useState('');
  const [matchType, setMatchType] = useState<'exact' | 'contains'>('exact');
  
  const [amountOperator, setAmountOperator] = useState<'<' | '>' | '<=' | '>=' | '=' | 'any'>('any');
  const [amountThreshold, setAmountThreshold] = useState('');

  const [dateOperator, setDateOperator] = useState<'<' | '>' | '<=' | '>=' | '=' | 'any'>('any');
  const [dateThreshold, setDateThreshold] = useState('');

  const [mappedMerchant, setMappedMerchant] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  
  const [forceExpense, setForceExpense] = useState<boolean | 'none'>('none');
  const [forceIncome, setForceIncome] = useState<boolean | 'none'>('none');

  const updateRule = useUpdateMerchantMapping();

  const createRule = useMutation({
    mutationFn: async (rule: Partial<UserMerchantMapping>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await (supabase as any)
        .from('user_merchant_mappings')
        .insert([{
          ...rule,
          user_id: user.id
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-mappings'] });
      toast({ title: 'Automation rule created successfully!' });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: 'Failed to create rule', description: err.message, variant: 'destructive' });
    }
  });

  useEffect(() => {
    if (open) {
      if (editingRule) {
        setRawMerchant(editingRule.raw_merchant || '');
        setMatchType(editingRule.match_type || 'exact');
        setAmountOperator(editingRule.amount_operator || 'any');
        setAmountThreshold(editingRule.amount_threshold ? String(editingRule.amount_threshold) : '');
        setDateOperator(editingRule.date_operator || 'any');
        setDateThreshold(editingRule.date_threshold ? String(editingRule.date_threshold) : '');
        setMappedMerchant(editingRule.mapped_merchant || '');
        setCategoryId(editingRule.default_category_id || '');
        setForceExpense(editingRule.default_is_expense === null ? 'none' : editingRule.default_is_expense);
        setForceIncome(editingRule.default_is_income === null ? 'none' : editingRule.default_is_income);
      } else {
        resetForm();
      }
    }
  }, [open, editingRule]);

  const resetForm = () => {
    setRawMerchant('');
    setMatchType('exact');
    setAmountOperator('any');
    setAmountThreshold('');
    setDateOperator('any');
    setDateThreshold('');
    setMappedMerchant('');
    setCategoryId('');
    setForceExpense('none');
    setForceIncome('none');
  };

  const handleSave = () => {
    if (!rawMerchant.trim()) {
      toast({ title: 'Merchant name is required', variant: 'destructive' });
      return;
    }

    const payload = {
      raw_merchant: rawMerchant.trim(),
      match_type: matchType,
      amount_operator: amountOperator === 'any' ? null : amountOperator,
      amount_threshold: amountOperator === 'any' || !amountThreshold ? null : Number(amountThreshold),
      date_operator: dateOperator === 'any' ? null : dateOperator,
      date_threshold: dateOperator === 'any' || !dateThreshold ? null : Number(dateThreshold),
      mapped_merchant: mappedMerchant.trim() || rawMerchant.trim(),
      default_category_id: categoryId || null,
      default_is_expense: forceExpense === 'none' ? null : forceExpense,
      default_is_income: forceIncome === 'none' ? null : forceIncome,
    };

    if (editingRule) {
      updateRule.mutate({ id: editingRule.id, updates: payload }, {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        }
      });
    } else {
      createRule.mutate(payload);
    }
  };

  const categoryOptions = categories.map(c => ({
    value: c.id,
    label: `${c.icon} ${c.name}`,
    searchText: c.name
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] glass-elevated border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle>{editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground border-b border-border/50 pb-2">1. When SMS Matches</h4>
            
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Merchant Name</label>
              <div className="flex gap-2">
                <Select value={matchType} onValueChange={(v: any) => setMatchType(v)}>
                  <SelectTrigger className="w-[110px] bg-muted/20 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                  </SelectContent>
                </Select>
                <Input 
                  value={rawMerchant} 
                  onChange={e => setRawMerchant(e.target.value)} 
                  placeholder="e.g. Zomato"
                  className="bg-muted/20 border-border/50"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount Condition (Optional)</label>
              <div className="flex gap-2">
                <Select value={amountOperator} onValueChange={(v: any) => setAmountOperator(v)}>
                  <SelectTrigger className="w-[110px] bg-muted/20 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Amt</SelectItem>
                    <SelectItem value="<">Less (&lt;)</SelectItem>
                    <SelectItem value="<=">Less or Eq (&le;)</SelectItem>
                    <SelectItem value="=">Equals (=)</SelectItem>
                    <SelectItem value=">=">Greater or Eq (&ge;)</SelectItem>
                    <SelectItem value=">">Greater (&gt;)</SelectItem>
                  </SelectContent>
                </Select>
                {amountOperator !== 'any' && (
                  <Input 
                    type="number"
                    value={amountThreshold} 
                    onChange={e => setAmountThreshold(e.target.value)} 
                    placeholder="e.g. 200"
                    className="bg-muted/20 border-border/50"
                  />
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date Condition (Optional)</label>
              <div className="flex gap-2">
                <Select value={dateOperator} onValueChange={(v: any) => setDateOperator(v)}>
                  <SelectTrigger className="w-[110px] bg-muted/20 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Day</SelectItem>
                    <SelectItem value="<">Before Day</SelectItem>
                    <SelectItem value="<=">Before/On Day</SelectItem>
                    <SelectItem value="=">On Day</SelectItem>
                    <SelectItem value=">=">After/On Day</SelectItem>
                    <SelectItem value=">">After Day</SelectItem>
                  </SelectContent>
                </Select>
                {dateOperator !== 'any' && (
                  <Input 
                    type="number"
                    min="1"
                    max="31"
                    value={dateThreshold} 
                    onChange={e => setDateThreshold(e.target.value)} 
                    placeholder="e.g. 15"
                    className="bg-muted/20 border-border/50"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground border-b border-border/50 pb-2">2. Then Apply Actions</h4>
            
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">Rename Merchant To</label>
              <Input 
                value={mappedMerchant} 
                onChange={e => setMappedMerchant(e.target.value)} 
                placeholder="Leave blank to keep original"
                className="bg-muted/20 border-border/50"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">Categorize As</label>
              <SearchableSelect
                options={categoryOptions}
                value={categoryId}
                onValueChange={setCategoryId}
                placeholder="Select category..."
                className="bg-muted/20"
              />
            </div>
            
            <div className="grid gap-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Force Expense Status</label>
                <Select value={String(forceExpense)} onValueChange={(v: any) => setForceExpense(v === 'none' ? 'none' : v === 'true')}>
                  <SelectTrigger className="w-[140px] h-8 text-xs bg-muted/20 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">AI Decides</SelectItem>
                    <SelectItem value="true" className="text-destructive font-medium">Always Expense</SelectItem>
                    <SelectItem value="false" className="font-medium">Never Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Force Income Status</label>
                <Select value={String(forceIncome)} onValueChange={(v: any) => setForceIncome(v === 'none' ? 'none' : v === 'true')}>
                  <SelectTrigger className="w-[140px] h-8 text-xs bg-muted/20 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">AI Decides</SelectItem>
                    <SelectItem value="true" className="text-success font-medium">Always Income</SelectItem>
                    <SelectItem value="false" className="font-medium">Never Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={createRule.isPending}>
            {createRule.isPending ? 'Saving...' : 'Save Rule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
