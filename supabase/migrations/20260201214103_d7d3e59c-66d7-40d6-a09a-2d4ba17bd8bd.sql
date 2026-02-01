-- Create transaction_groups table
CREATE TABLE public.transaction_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#8B5CF6',
  icon TEXT NOT NULL DEFAULT '📁',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for transaction_groups
CREATE POLICY "Users can view their own groups" 
ON public.transaction_groups 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own groups" 
ON public.transaction_groups 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups" 
ON public.transaction_groups 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own groups" 
ON public.transaction_groups 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add group_id to transactions table
ALTER TABLE public.transactions 
ADD COLUMN group_id UUID REFERENCES public.transaction_groups(id) ON DELETE SET NULL;

-- Create trigger for updating updated_at
CREATE TRIGGER update_transaction_groups_updated_at
BEFORE UPDATE ON public.transaction_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();