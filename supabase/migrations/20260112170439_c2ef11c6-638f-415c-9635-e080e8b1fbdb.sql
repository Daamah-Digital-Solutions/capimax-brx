-- Create KYC status enum
CREATE TYPE public.kyc_status AS ENUM ('pending', 'submitted', 'approved', 'rejected');

-- Create user_kyc table to track KYC status
CREATE TABLE public.user_kyc (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_wallets table
CREATE TABLE public.user_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL UNIQUE,
  network TEXT NOT NULL DEFAULT 'ethereum',
  wallet_type TEXT NOT NULL DEFAULT 'custodial',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallet_transactions table for tracking
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL UNIQUE,
  tx_type TEXT NOT NULL,
  amount DECIMAL(20, 8),
  token_symbol TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  block_number BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_kyc
CREATE POLICY "Users can view their own KYC status"
ON public.user_kyc FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own KYC"
ON public.user_kyc FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS policies for user_wallets
CREATE POLICY "Users can view their own wallet"
ON public.user_wallets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallets"
ON public.user_wallets FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS policies for wallet_transactions
CREATE POLICY "Users can view their wallet transactions"
ON public.wallet_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_wallets 
    WHERE id = wallet_transactions.wallet_id 
    AND user_id = auth.uid()
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_user_kyc_updated_at
BEFORE UPDATE ON public.user_kyc
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_wallets_updated_at
BEFORE UPDATE ON public.user_wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();