-- Create investments table to track user investments
CREATE TABLE public.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  wallet_id UUID REFERENCES public.user_wallets(id),
  property_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  amount_invested DECIMAL(20, 2) NOT NULL,
  token_amount DECIMAL(20, 8) NOT NULL,
  token_symbol TEXT NOT NULL,
  price_per_token DECIMAL(20, 4) NOT NULL,
  ownership_percentage DECIMAL(10, 6) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  tokens_minted BOOLEAN NOT NULL DEFAULT false,
  minted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_investments_user_id ON public.investments(user_id);
CREATE INDEX idx_investments_property_id ON public.investments(property_id);
CREATE INDEX idx_investments_payment_status ON public.investments(payment_status);

-- Enable RLS
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own investments"
ON public.investments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own investments"
ON public.investments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_investments_updated_at
BEFORE UPDATE ON public.investments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for investments
ALTER TABLE public.investments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.investments;