-- Create liquidity provider status enum
CREATE TYPE public.lp_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');

-- Create withdrawal status enum
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create liquidity_providers table
CREATE TABLE public.liquidity_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  investment_amount NUMERIC NOT NULL DEFAULT 0,
  status lp_status NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_iban TEXT,
  bank_swift TEXT,
  crypto_wallet_address TEXT,
  crypto_network TEXT,
  total_deposited NUMERIC NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC NOT NULL DEFAULT 0,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create LP transactions table
CREATE TABLE public.lp_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lp_id UUID NOT NULL REFERENCES public.liquidity_providers(id) ON DELETE CASCADE,
  tx_type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'earning', 'fee'
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status withdrawal_status NOT NULL DEFAULT 'pending',
  withdrawal_method TEXT, -- 'bank', 'crypto'
  bank_reference TEXT,
  crypto_tx_hash TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create LP documents table
CREATE TABLE public.lp_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lp_id UUID REFERENCES public.liquidity_providers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'business_model', 'terms', 'contract', 'report', 'other'
  file_path TEXT NOT NULL,
  file_size INTEGER,
  is_template BOOLEAN NOT NULL DEFAULT false,
  uploaded_by TEXT NOT NULL DEFAULT 'user', -- 'user' or 'admin'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.liquidity_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for liquidity_providers
CREATE POLICY "Users can view their own LP profile"
ON public.liquidity_providers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own LP application"
ON public.liquidity_providers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own LP profile"
ON public.liquidity_providers FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for lp_transactions
CREATE POLICY "Users can view their LP transactions"
ON public.lp_transactions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.liquidity_providers
  WHERE liquidity_providers.id = lp_transactions.lp_id
  AND liquidity_providers.user_id = auth.uid()
));

CREATE POLICY "Users can create withdrawal requests"
ON public.lp_transactions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.liquidity_providers
  WHERE liquidity_providers.id = lp_transactions.lp_id
  AND liquidity_providers.user_id = auth.uid()
));

-- RLS policies for lp_documents
CREATE POLICY "Users can view LP documents"
ON public.lp_documents FOR SELECT
USING (
  user_id = auth.uid() 
  OR is_template = true
  OR EXISTS (
    SELECT 1 FROM public.liquidity_providers
    WHERE liquidity_providers.id = lp_documents.lp_id
    AND liquidity_providers.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload their LP documents"
ON public.lp_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own LP documents"
ON public.lp_documents FOR DELETE
USING (auth.uid() = user_id AND uploaded_by = 'user');

-- Create storage bucket for LP documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lp-documents', 'lp-documents', false, 20971520, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']);

-- Storage policies for LP documents
CREATE POLICY "Users can view their own LP documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'lp-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload LP documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lp-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own LP documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'lp-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for updated_at
CREATE TRIGGER update_liquidity_providers_updated_at
BEFORE UPDATE ON public.liquidity_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();