-- Create refund_links table to link refund transactions to original transactions
CREATE TABLE public.refund_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  refund_transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(original_transaction_id, refund_transaction_id)
);

-- Enable RLS
ALTER TABLE public.refund_links ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own refund links" 
ON public.refund_links 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own refund links" 
ON public.refund_links 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own refund links" 
ON public.refund_links 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create an index for faster lookups
CREATE INDEX idx_refund_links_original_transaction ON public.refund_links(original_transaction_id);
CREATE INDEX idx_refund_links_refund_transaction ON public.refund_links(refund_transaction_id);