
-- 1) Certificates: drop overly broad public read policy, expose verification via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Public certificate verification by code" ON public.certificates;

CREATE OR REPLACE FUNCTION public.verify_certificate(p_code text)
RETURNS TABLE (
  certificate_id text,
  verification_code text,
  property_name text,
  property_location text,
  spv_name text,
  spv_registration_ref text,
  units_purchased numeric,
  unit_price numeric,
  ownership_percentage numeric,
  subscription_date timestamptz,
  issue_date timestamptz,
  status certificate_status,
  authorized_signatory text,
  investor_id_masked text,
  investor_name text,
  verification_url text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    c.certificate_id,
    c.verification_code,
    c.property_name,
    c.property_location,
    c.spv_name,
    c.spv_registration_ref,
    c.units_purchased,
    c.unit_price,
    c.ownership_percentage,
    c.subscription_date,
    c.issue_date,
    c.status,
    c.authorized_signatory,
    c.investor_id_masked,
    c.investor_name,
    c.verification_url
  FROM public.certificates c
  WHERE c.verification_code = p_code
    AND c.revoked_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

-- 2) Storage: certificates bucket — drop unrestricted INSERT (uploads only via service role)
DROP POLICY IF EXISTS "System can upload certificates" ON storage.objects;

-- 3) Storage: add UPDATE policies for owner-documents and lp-documents (user-scoped)
DROP POLICY IF EXISTS "Users can update their own owner documents" ON storage.objects;
CREATE POLICY "Users can update their own owner documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'owner-documents' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'owner-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own lp documents" ON storage.objects;
CREATE POLICY "Users can update their own lp documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'lp-documents' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'lp-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4) secondary_market_listings: lock UPDATE to seller only; buyers must use a server-side flow
DROP POLICY IF EXISTS "Users can update their own secondary market listings" ON public.secondary_market_listings;
CREATE POLICY "Sellers can update their own secondary market listings"
ON public.secondary_market_listings FOR UPDATE TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

-- 5) profiles: prevent self-elevation on INSERT (role must be 'investor')
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'investor');

-- Prevent role escalation via UPDATE as well
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- 6) user_kyc: allow user to resubmit when pending or rejected
DROP POLICY IF EXISTS "Users can resubmit rejected or pending KYC" ON public.user_kyc;
CREATE POLICY "Users can resubmit rejected or pending KYC"
ON public.user_kyc FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status IN ('pending'::kyc_status, 'rejected'::kyc_status))
WITH CHECK (auth.uid() = user_id AND status IN ('pending'::kyc_status, 'submitted'::kyc_status));

-- 7) investments: prevent rapid duplicate pending investments per (user, property)
CREATE UNIQUE INDEX IF NOT EXISTS idx_investments_pending_unique
ON public.investments(user_id, property_id)
WHERE payment_status IN ('pending', 'processing');
