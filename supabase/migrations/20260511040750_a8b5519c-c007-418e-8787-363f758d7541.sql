
ALTER TABLE public.visa_cards
  ADD COLUMN IF NOT EXISTS card_category text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS family_account_id uuid REFERENCES public.family_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS relationship text;

ALTER TABLE public.visa_cards
  DROP CONSTRAINT IF EXISTS visa_cards_card_category_check;

ALTER TABLE public.visa_cards
  ADD CONSTRAINT visa_cards_card_category_check
  CHECK (card_category IN ('personal','family','dependent'));

CREATE INDEX IF NOT EXISTS idx_visa_cards_family_account ON public.visa_cards(family_account_id);
