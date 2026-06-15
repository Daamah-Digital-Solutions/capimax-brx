-- Create table to track assets owned/purchased by Liquidity Providers
CREATE TABLE public.lp_holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lp_id UUID NOT NULL REFERENCES public.liquidity_providers(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.lp_market_listings(id),
  property_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_amount NUMERIC NOT NULL,
  purchase_price NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL,
  purchase_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'held', -- held, listed_lp, listed_secondary, sold
  listed_at TIMESTAMP WITH TIME ZONE,
  sold_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lp_holdings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lp_holdings
CREATE POLICY "LPs can view their own holdings"
  ON public.lp_holdings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.liquidity_providers lp
      WHERE lp.id = lp_holdings.lp_id
      AND lp.user_id = auth.uid()
    )
  );

CREATE POLICY "LPs can update their own holdings"
  ON public.lp_holdings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.liquidity_providers lp
      WHERE lp.id = lp_holdings.lp_id
      AND lp.user_id = auth.uid()
    )
  );

-- System can insert holdings (via edge function or service role)
CREATE POLICY "System can insert LP holdings"
  ON public.lp_holdings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.liquidity_providers lp
      WHERE lp.id = lp_holdings.lp_id
      AND lp.user_id = auth.uid()
      AND lp.status = 'approved'
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_lp_holdings_updated_at
  BEFORE UPDATE ON public.lp_holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for lp_holdings
ALTER PUBLICATION supabase_realtime ADD TABLE public.lp_holdings;

-- Create secondary_market_listings table for Secondary Market trading
CREATE TABLE public.secondary_market_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL, -- can be investor user_id or lp_id
  seller_type TEXT NOT NULL DEFAULT 'investor', -- investor, lp
  property_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_amount NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 100,
  total_value NUMERIC NOT NULL,
  platform_fee_percent NUMERIC NOT NULL DEFAULT 0.5, -- 0.5% for secondary market
  platform_fee_amount NUMERIC NOT NULL,
  net_amount NUMERIC NOT NULL,
  buyer_id UUID,
  buyer_type TEXT, -- investor, lp
  status TEXT NOT NULL DEFAULT 'listed', -- listed, pending, completed, cancelled
  listed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  purchased_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for secondary_market_listings
ALTER TABLE public.secondary_market_listings ENABLE ROW LEVEL SECURITY;

-- Policies for secondary_market_listings
CREATE POLICY "Users can view all listed secondary market assets"
  ON public.secondary_market_listings
  FOR SELECT
  USING (status = 'listed' OR seller_id = auth.uid());

CREATE POLICY "Users can create their own secondary market listings"
  ON public.secondary_market_listings
  FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Users can update their own secondary market listings"
  ON public.secondary_market_listings
  FOR UPDATE
  USING (seller_id = auth.uid() OR (status = 'listed'));

-- Trigger for secondary_market_listings
CREATE TRIGGER update_secondary_market_listings_updated_at
  BEFORE UPDATE ON public.secondary_market_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.secondary_market_listings;