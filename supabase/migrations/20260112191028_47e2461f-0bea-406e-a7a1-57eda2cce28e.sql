-- Add KYB status enum
CREATE TYPE public.kyb_status AS ENUM ('not_started', 'documents_pending', 'under_review', 'approved', 'rejected');

-- Add KYB fields to liquidity_providers table
ALTER TABLE public.liquidity_providers
ADD COLUMN kyb_status kyb_status NOT NULL DEFAULT 'not_started',
ADD COLUMN business_type TEXT,
ADD COLUMN business_registration_number TEXT,
ADD COLUMN tax_id TEXT,
ADD COLUMN business_address TEXT,
ADD COLUMN business_description TEXT,
ADD COLUMN annual_revenue TEXT,
ADD COLUMN source_of_funds TEXT,
ADD COLUMN kyb_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN kyb_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN kyb_rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN kyb_rejection_reason TEXT;

-- Create KYB documents table for business verification documents
CREATE TABLE public.lp_kyb_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lp_id UUID NOT NULL REFERENCES public.liquidity_providers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL, -- 'business_license', 'incorporation_certificate', 'tax_certificate', 'bank_statement', 'proof_of_address', 'id_document', 'other'
  document_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.lp_kyb_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for lp_kyb_documents
CREATE POLICY "Users can view their own KYB documents"
ON public.lp_kyb_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can upload their KYB documents"
ON public.lp_kyb_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their pending KYB documents"
ON public.lp_kyb_documents FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');