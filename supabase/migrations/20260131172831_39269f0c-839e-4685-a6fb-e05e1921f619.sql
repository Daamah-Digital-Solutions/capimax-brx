-- Create LP Market Listings table for investor-to-LP asset sales
CREATE TABLE public.lp_market_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  investor_id UUID NOT NULL,
  lp_id UUID REFERENCES public.liquidity_providers(id),
  property_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_amount NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 100,
  total_value NUMERIC NOT NULL,
  platform_fee_percent NUMERIC NOT NULL DEFAULT 1,
  platform_fee_amount NUMERIC NOT NULL,
  net_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'listed' CHECK (status IN ('listed', 'pending', 'completed', 'cancelled', 'expired')),
  listed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  purchased_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lp_market_listings ENABLE ROW LEVEL SECURITY;

-- Investors can create their own listings
CREATE POLICY "Investors can create their own listings"
ON public.lp_market_listings
FOR INSERT
WITH CHECK (auth.uid() = investor_id);

-- Investors can view their own listings
CREATE POLICY "Investors can view their own listings"
ON public.lp_market_listings
FOR SELECT
USING (auth.uid() = investor_id);

-- Investors can cancel their own listed items
CREATE POLICY "Investors can update their own listings"
ON public.lp_market_listings
FOR UPDATE
USING (auth.uid() = investor_id AND status = 'listed');

-- LPs can view all listed assets
CREATE POLICY "LPs can view listed assets"
ON public.lp_market_listings
FOR SELECT
USING (
  status = 'listed' AND
  EXISTS (
    SELECT 1 FROM liquidity_providers 
    WHERE user_id = auth.uid() AND status = 'approved'
  )
);

-- LPs can purchase (update) listed assets
CREATE POLICY "LPs can purchase listed assets"
ON public.lp_market_listings
FOR UPDATE
USING (
  status = 'listed' AND
  EXISTS (
    SELECT 1 FROM liquidity_providers lp
    WHERE lp.user_id = auth.uid() AND lp.status = 'approved'
  )
);

-- Enable realtime for LP market listings
ALTER PUBLICATION supabase_realtime ADD TABLE public.lp_market_listings;

-- Create trigger for updated_at
CREATE TRIGGER update_lp_market_listings_updated_at
BEFORE UPDATE ON public.lp_market_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();