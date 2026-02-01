import { useState } from 'react';
import { useCreateTransactionGroup } from '@/hooks/useTransactionGroups';
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

const COLOR_OPTIONS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#6366F1', '#14B8A6'];

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (groupId: string) => void;
}

export function CreateGroupDialog({ open, onOpenChange, onCreated }: CreateGroupDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateTransactionGroup();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState('#8B5CF6');

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Please enter a group name', variant: 'destructive' });
      return;
    }

    try {
      const newGroup = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        icon,
        color,
      });
      toast({ title: 'Group created' });
      onCreated?.(newGroup.id);
      onOpenChange(false);
      setName('');
      setDescription('');
      setIcon('📁');
      setColor('#8B5CF6');
    } catch {
      toast({ title: 'Failed to create group', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Group</DialogTitle>
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

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-offset-background ring-primary' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
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
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
