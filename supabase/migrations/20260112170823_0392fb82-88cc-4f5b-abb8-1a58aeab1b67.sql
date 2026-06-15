-- Create ownership_tokens table
CREATE TABLE public.ownership_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_amount DECIMAL(20, 8) NOT NULL DEFAULT 0,
  token_value_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
  ownership_percentage DECIMAL(10, 6) NOT NULL DEFAULT 0,
  acquisition_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_distribution_date TIMESTAMP WITH TIME ZONE,
  total_distributions DECIMAL(20, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_ownership_tokens_wallet_id ON public.ownership_tokens(wallet_id);
CREATE INDEX idx_ownership_tokens_property_id ON public.ownership_tokens(property_id);

-- Enable RLS
ALTER TABLE public.ownership_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policy - users can view their own tokens
CREATE POLICY "Users can view their own tokens"
ON public.ownership_tokens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_wallets 
    WHERE id = ownership_tokens.wallet_id 
    AND user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_ownership_tokens_updated_at
BEFORE UPDATE ON public.ownership_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for ownership_tokens
ALTER TABLE public.ownership_tokens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ownership_tokens;