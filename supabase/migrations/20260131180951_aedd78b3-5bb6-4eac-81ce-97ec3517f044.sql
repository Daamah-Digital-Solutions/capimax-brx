-- Family accounts table with bank integration
CREATE TABLE public.family_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL,
  member_name VARCHAR(100) NOT NULL,
  member_email VARCHAR(255) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  access_level VARCHAR(20) NOT NULL DEFAULT 'view_only' CHECK (access_level IN ('view_only', 'authorized')),
  allocated_returns_percent NUMERIC(5, 2) DEFAULT 0 CHECK (allocated_returns_percent >= 0 AND allocated_returns_percent <= 100),
  total_transferred NUMERIC(15, 2) DEFAULT 0,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Family bank accounts for automatic transfers
CREATE TABLE public.family_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_account_id UUID NOT NULL REFERENCES public.family_accounts(id) ON DELETE CASCADE,
  bank_name VARCHAR(100) NOT NULL,
  bank_code VARCHAR(20),
  account_holder_name VARCHAR(100) NOT NULL,
  account_number_masked VARCHAR(20) NOT NULL, -- Only store last 4 digits
  iban_masked VARCHAR(34), -- Only store last 4 characters
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Transfer schedules for automatic transfers
CREATE TABLE public.family_transfer_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_account_id UUID NOT NULL REFERENCES public.family_accounts(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.family_bank_accounts(id) ON DELETE CASCADE,
  schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('immediate', 'weekly', 'monthly', 'quarterly', 'threshold')),
  threshold_amount NUMERIC(15, 2), -- For threshold-based transfers
  next_transfer_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Transaction logs for auditing
CREATE TABLE public.family_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_account_id UUID NOT NULL REFERENCES public.family_accounts(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.family_bank_accounts(id),
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('allocation', 'transfer_initiated', 'transfer_completed', 'transfer_failed', 'schedule_created', 'schedule_updated', 'bank_linked', 'bank_verified')),
  amount NUMERIC(15, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  reference_number VARCHAR(50),
  description TEXT,
  metadata JSONB,
  initiated_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_transfer_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for family_accounts
CREATE POLICY "Investors can view their family accounts"
  ON public.family_accounts FOR SELECT
  USING (auth.uid() = investor_id);

CREATE POLICY "Investors can create family accounts"
  ON public.family_accounts FOR INSERT
  WITH CHECK (auth.uid() = investor_id);

CREATE POLICY "Investors can update their family accounts"
  ON public.family_accounts FOR UPDATE
  USING (auth.uid() = investor_id);

CREATE POLICY "Investors can delete their family accounts"
  ON public.family_accounts FOR DELETE
  USING (auth.uid() = investor_id);

-- RLS Policies for family_bank_accounts
CREATE POLICY "Users can view family bank accounts"
  ON public.family_bank_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_accounts fa
      WHERE fa.id = family_account_id AND fa.investor_id = auth.uid()
    )
  );

CREATE POLICY "Investors can manage family bank accounts"
  ON public.family_bank_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_accounts fa
      WHERE fa.id = family_account_id AND fa.investor_id = auth.uid()
    )
  );

CREATE POLICY "Investors can update family bank accounts"
  ON public.family_bank_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.family_accounts fa
      WHERE fa.id = family_account_id AND fa.investor_id = auth.uid()
    )
  );

CREATE POLICY "Investors can delete family bank accounts"
  ON public.family_bank_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.family_accounts fa
      WHERE fa.id = family_account_id AND fa.investor_id = auth.uid()
    )
  );

-- RLS Policies for family_transfer_schedules
CREATE POLICY "Users can view transfer schedules"
  ON public.family_transfer_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_accounts fa
      WHERE fa.id = family_account_id AND fa.investor_id = auth.uid()
    )
  );

CREATE POLICY "Investors can manage transfer schedules"
  ON public.family_transfer_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.family_accounts fa
      WHERE fa.id = family_account_id AND fa.investor_id = auth.uid()
    )
  );

-- RLS Policies for family_transactions
CREATE POLICY "Users can view family transactions"
  ON public.family_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_accounts fa
      WHERE fa.id = family_account_id AND fa.investor_id = auth.uid()
    )
  );

CREATE POLICY "Users can create family transactions"
  ON public.family_transactions FOR INSERT
  WITH CHECK (auth.uid() = initiated_by);

-- Triggers for updated_at
CREATE TRIGGER update_family_accounts_updated_at
  BEFORE UPDATE ON public.family_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_family_bank_accounts_updated_at
  BEFORE UPDATE ON public.family_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_family_transfer_schedules_updated_at
  BEFORE UPDATE ON public.family_transfer_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_transactions;