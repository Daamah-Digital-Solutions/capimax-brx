
REVOKE ALL ON FUNCTION public.spend_with_card(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.topup_wallet(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_with_card(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.topup_wallet(numeric) TO authenticated;
