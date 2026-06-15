
-- =====================================================
-- Wallet balances, Visa cards, and card transactions
-- =====================================================

-- Wallet balance per user (single row)
CREATE TABLE IF NOT EXISTS public.wallet_balances (
  user_id UUID PRIMARY KEY,
  available_balance NUMERIC NOT NULL DEFAULT 0,
  pending_balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own balance"
  ON public.wallet_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own balance"
  ON public.wallet_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_wallet_balances_updated
  BEFORE UPDATE ON public.wallet_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Visa cards
CREATE TABLE IF NOT EXISTS public.visa_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_type TEXT NOT NULL CHECK (card_type IN ('virtual','physical')),
  card_brand TEXT NOT NULL DEFAULT 'visa',
  card_last_four TEXT NOT NULL,
  card_number_masked TEXT NOT NULL,
  cardholder_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','pending','cancelled')),
  spending_limit NUMERIC NOT NULL DEFAULT 5000,
  spent_this_month NUMERIC NOT NULL DEFAULT 0,
  expiry_month INT NOT NULL DEFAULT 12,
  expiry_year INT NOT NULL DEFAULT (EXTRACT(YEAR FROM now())::INT + 4),
  role_at_issue TEXT,
  shipping_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visa_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own visa cards"
  ON public.visa_cards FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own visa cards"
  ON public.visa_cards FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own visa cards"
  ON public.visa_cards FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own visa cards"
  ON public.visa_cards FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_visa_cards_updated
  BEFORE UPDATE ON public.visa_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_visa_cards_user ON public.visa_cards(user_id);

-- Card transactions
CREATE TABLE IF NOT EXISTS public.card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  tx_type TEXT NOT NULL CHECK (tx_type IN ('purchase','refund','topup','fee')),
  merchant TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending','declined','reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own card transactions"
  ON public.card_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_card_tx_user ON public.card_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_card_tx_card ON public.card_transactions(card_id);

-- =====================================================
-- RPC: spend_with_card
-- Validates ownership, status, balance and limit, then
-- debits wallet and records transaction atomically.
-- =====================================================
CREATE OR REPLACE FUNCTION public.spend_with_card(
  _card_id UUID,
  _amount NUMERIC,
  _merchant TEXT DEFAULT NULL,
  _category TEXT DEFAULT NULL
)
RETURNS public.card_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_card public.visa_cards%ROWTYPE;
  v_bal NUMERIC;
  v_tx public.card_transactions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT * INTO v_card FROM public.visa_cards
   WHERE id = _card_id AND user_id = v_user
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  IF v_card.status <> 'active' THEN
    RAISE EXCEPTION 'Card is %', v_card.status;
  END IF;

  IF (v_card.spent_this_month + _amount) > v_card.spending_limit THEN
    RAISE EXCEPTION 'Spending limit exceeded';
  END IF;

  -- Ensure wallet row exists
  INSERT INTO public.wallet_balances(user_id, available_balance)
  VALUES (v_user, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT available_balance INTO v_bal
    FROM public.wallet_balances
   WHERE user_id = v_user
   FOR UPDATE;

  IF v_bal < _amount THEN
    INSERT INTO public.card_transactions(card_id, user_id, amount, tx_type, merchant, category, status)
    VALUES (_card_id, v_user, _amount, 'purchase', _merchant, _category, 'declined')
    RETURNING * INTO v_tx;
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.wallet_balances
     SET available_balance = available_balance - _amount,
         updated_at = now()
   WHERE user_id = v_user;

  UPDATE public.visa_cards
     SET spent_this_month = spent_this_month + _amount,
         updated_at = now()
   WHERE id = _card_id;

  INSERT INTO public.card_transactions(card_id, user_id, amount, tx_type, merchant, category, status)
  VALUES (_card_id, v_user, _amount, 'purchase', _merchant, _category, 'completed')
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$$;

-- Helper: top up wallet (demo / linked funding)
CREATE OR REPLACE FUNCTION public.topup_wallet(_amount NUMERIC)
RETURNS public.wallet_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.wallet_balances%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  INSERT INTO public.wallet_balances(user_id, available_balance)
  VALUES (v_user, _amount)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance = wallet_balances.available_balance + EXCLUDED.available_balance,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
