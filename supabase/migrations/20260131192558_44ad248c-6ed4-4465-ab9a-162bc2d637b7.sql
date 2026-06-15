-- Create owner_documents table for Developer/Owner document management
CREATE TABLE public.owner_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id TEXT,
  property_name TEXT,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'ownership', 'legal', 'financial', 'transaction', 'certificate', 'contract', 'other'
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT, -- mime type
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'archived', 'pending_review'
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.owner_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for owner_documents
CREATE POLICY "Users can view their own documents" 
  ON public.owner_documents 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upload their own documents" 
  ON public.owner_documents 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" 
  ON public.owner_documents 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" 
  ON public.owner_documents 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_owner_documents_updated_at
  BEFORE UPDATE ON public.owner_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create owner-documents storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('owner-documents', 'owner-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for owner-documents bucket
CREATE POLICY "Users can view their own owner documents"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'owner-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own owner documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'owner-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own owner documents"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'owner-documents' AND auth.uid()::text = (storage.foldername(name))[1]);