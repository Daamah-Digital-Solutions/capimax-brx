
DROP FUNCTION IF EXISTS public.verify_certificate(text);

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
  verification_url text,
  revocation_reason text,
  listing_id text,
  investment_amount numeric,
  platform_fee numeric,
  digital_signature_hash text,
  finalized_at timestamptz
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
    c.verification_url,
    c.revocation_reason,
    c.listing_id,
    c.investment_amount,
    c.platform_fee,
    c.digital_signature_hash,
    c.finalized_at
  FROM public.certificates c
  WHERE c.verification_code = p_code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;
