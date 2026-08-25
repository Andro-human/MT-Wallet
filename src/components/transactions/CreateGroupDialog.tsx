import { useEffect, useState } from 'react';
import {
  TransactionGroup,
  useCreateTransactionGroup,
  useUpdateTransactionGroup,
} from '@/hooks/useTransactionGroups';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { PALETTE } from '@/lib/categoryColors';


interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (groupId: string) => void;
  /** When provided, the dialog opens in edit mode for this group. */
  initialGroup?: TransactionGroup | null;
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
  initialGroup,
}: CreateGroupDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateTransactionGroup();
  const updateMutation = useUpdateTransactionGroup();

  const isEdit = !!initialGroup;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState<string>(PALETTE[0]);

  useEffect(() => {
    if (!open) return;
    if (initialGroup) {
      setName(initialGroup.name);
      setDescription(initialGroup.description ?? '');
      setIcon(initialGroup.icon);
      setColor(initialGroup.color);
    } else {
      setName('');
      setDescription('');
      setIcon('📁');
      setColor(PALETTE[0]);
    }
  }, [open, initialGroup]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: 'Please enter a group name', variant: 'destructive' });
      return;
    }

    try {
      if (isEdit && initialGroup) {
        await updateMutation.mutateAsync({
          id: initialGroup.id,
          updates: {
            name: name.trim(),
            description: description.trim() || null,
            icon,
            color,
          },
        });
        toast({ title: 'Group updated' });
        onCreated?.(initialGroup.id);
      } else {
        const newGroup = await createMutation.mutateAsync({
          name: name.trim(),
          description: description.trim() || null,
          icon,
          color,
        });
        toast({ title: 'Group created' });
        onCreated?.(newGroup.id);
      }
      onOpenChange(false);
    } catch {
      toast({
        title: isEdit ? 'Failed to update group' : 'Failed to create group',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEdit ? 'Edit Group' : 'New Group'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="groupName" className="text-sm text-muted-foreground">Name</Label>
            <Input
              id="groupName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Goa Trip 2024"
              className="bg-muted/30 border-border/50 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupDesc" className="text-sm text-muted-foreground">Description (optional)</Label>
            <Textarea
              id="groupDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add some details..."
              className="bg-muted/30 border-border/50 rounded-xl min-h-[60px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Icon</Label>
            <EmojiPicker value={icon} onChange={setIcon} />
          </div>

        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-border/50"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending
              ? (isEdit ? 'Saving...' : 'Creating...')
              : (isEdit ? 'Save' : 'Create')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
