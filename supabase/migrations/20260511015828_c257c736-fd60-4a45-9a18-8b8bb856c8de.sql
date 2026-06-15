CREATE TABLE IF NOT EXISTS public.withdrawal_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_request_id UUID NOT NULL,
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own OTP records"
ON public.withdrawal_otps
FOR SELECT
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_otps_request ON public.withdrawal_otps(withdrawal_request_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_otps_expires ON public.withdrawal_otps(expires_at);