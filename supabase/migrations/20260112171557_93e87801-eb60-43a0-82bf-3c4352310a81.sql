-- Create certificate status enum
CREATE TYPE public.certificate_status AS ENUM ('provisional', 'final', 'revoked');

-- Create certificates table
CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  investment_id UUID REFERENCES public.investments(id),
  
  -- Status
  status public.certificate_status NOT NULL DEFAULT 'provisional',
  issue_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finalized_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT,
  
  -- Investor details
  investor_name TEXT NOT NULL,
  investor_id_masked TEXT,
  
  -- SPV/Property details
  spv_name TEXT NOT NULL,
  spv_registration_ref TEXT,
  property_name TEXT NOT NULL,
  property_location TEXT,
  listing_id TEXT NOT NULL,
  
  -- Investment details
  investment_amount DECIMAL(20, 2) NOT NULL,
  units_purchased DECIMAL(20, 8) NOT NULL,
  unit_price DECIMAL(20, 4) NOT NULL,
  ownership_percentage DECIMAL(10, 6) NOT NULL,
  subscription_date TIMESTAMP WITH TIME ZONE NOT NULL,
  platform_fee DECIMAL(20, 2),
  
  -- Verification
  verification_code TEXT NOT NULL UNIQUE,
  verification_url TEXT NOT NULL,
  qr_code_data TEXT,
  
  -- Signature
  authorized_signatory TEXT NOT NULL DEFAULT 'Capimax RT Authorized Officer',
  digital_signature_hash TEXT,
  
  -- PDF storage
  pdf_url TEXT,
  pdf_path TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_certificates_user_id ON public.certificates(user_id);
CREATE INDEX idx_certificates_investment_id ON public.certificates(investment_id);
CREATE INDEX idx_certificates_status ON public.certificates(status);
CREATE INDEX idx_certificates_verification_code ON public.certificates(verification_code);

-- Enable RLS
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own certificates"
ON public.certificates FOR SELECT
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_certificates_updated_at
BEFORE UPDATE ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER TABLE public.certificates REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.certificates;

-- Create storage bucket for certificates
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificates', 'certificates', false, 10485760, ARRAY['application/pdf']);

-- Storage policies for certificates bucket
CREATE POLICY "Users can view their own certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "System can upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'certificates');