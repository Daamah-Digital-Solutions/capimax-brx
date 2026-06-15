-- Create reinvestments table for tracking reinvested returns
CREATE TABLE public.reinvestments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_amount NUMERIC NOT NULL,
  discount_percentage NUMERIC NOT NULL DEFAULT 5,
  discount_amount NUMERIC NOT NULL,
  net_investment_value NUMERIC NOT NULL,
  investment_id UUID REFERENCES public.investments(id),
  property_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reinvestments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own reinvestments"
ON public.reinvestments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reinvestments"
ON public.reinvestments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reinvestments"
ON public.reinvestments
FOR UPDATE
USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_reinvestments_user_id ON public.reinvestments(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_reinvestments_updated_at
BEFORE UPDATE ON public.reinvestments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();