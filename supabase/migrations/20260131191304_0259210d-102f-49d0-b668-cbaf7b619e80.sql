-- Create investor bank accounts table
CREATE TABLE public.investor_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_name TEXT NOT NULL,
  bank_code TEXT,
  account_holder_name TEXT NOT NULL,
  account_number_masked TEXT NOT NULL,
  iban_masked TEXT,
  swift_code TEXT,
  country TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_verified BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create investor crypto wallets table
CREATE TABLE public.investor_crypto_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  wallet_label TEXT,
  network TEXT NOT NULL DEFAULT 'ethereum',
  is_verified BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create withdrawal requests table with audit trail
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  withdrawal_method TEXT NOT NULL, -- 'bank', 'crypto', 'card'
  bank_account_id UUID REFERENCES public.investor_bank_accounts(id),
  crypto_wallet_id UUID REFERENCES public.investor_crypto_wallets(id),
  card_id UUID REFERENCES public.payment_methods(id),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  otp_verified BOOLEAN DEFAULT false,
  otp_verified_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment method audit log for security compliance
CREATE TABLE public.payment_method_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'add', 'edit', 'delete', 'verify', 'withdrawal_request'
  method_type TEXT NOT NULL, -- 'bank', 'crypto', 'card'
  method_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.investor_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_crypto_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for investor_bank_accounts
CREATE POLICY "Users can view their own bank accounts"
  ON public.investor_bank_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bank accounts"
  ON public.investor_bank_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank accounts"
  ON public.investor_bank_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank accounts"
  ON public.investor_bank_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for investor_crypto_wallets
CREATE POLICY "Users can view their own crypto wallets"
  ON public.investor_crypto_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own crypto wallets"
  ON public.investor_crypto_wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own crypto wallets"
  ON public.investor_crypto_wallets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own crypto wallets"
  ON public.investor_crypto_wallets FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for withdrawal_requests
CREATE POLICY "Users can view their own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own withdrawal requests"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their pending withdrawal requests"
  ON public.withdrawal_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- RLS Policies for audit log (read-only for users)
CREATE POLICY "Users can view their own audit logs"
  ON public.payment_method_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create audit logs"
  ON public.payment_method_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_investor_bank_accounts_updated_at
  BEFORE UPDATE ON public.investor_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_investor_crypto_wallets_updated_at
  BEFORE UPDATE ON public.investor_crypto_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();