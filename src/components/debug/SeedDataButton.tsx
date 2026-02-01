import { useState } from 'react';
import { Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { seedSampleData } from '@/lib/seedData';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export function SeedDataButton() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const result = await seedSampleData(user.id);
      if (result.success) {
        toast({ title: 'Sample data added successfully!' });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      } else {
        toast({ title: 'Failed to add sample data', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'An error occurred', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSeed}
      disabled={loading}
      className="gap-2"
    >
      <Database className="w-4 h-4" />
      {loading ? 'Adding...' : 'Add Sample Data'}
    </Button>
  );
}
