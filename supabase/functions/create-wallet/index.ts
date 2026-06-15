import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS: Strict origin validation — exact match against allowlist or *.lovable.{app,dev}
const allowedOriginsExact = [
  Deno.env.get("ALLOWED_ORIGIN"),
  "https://lovable.dev",
  "https://capimax-dawn.lovable.app",
  "https://capimaxtokenization.store",
  "https://www.capimaxtokenization.store",
].filter((v): v is string => Boolean(v));

function getCorsHeaders(origin: string | null): Record<string, string> | null {
  if (!origin) return null;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return null;
  }
  const isAllowed =
    allowedOriginsExact.includes(origin) ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev");
  if (!isAllowed) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

// Generate a cryptographically secure Ethereum-like wallet address
async function generateWalletAddress(): Promise<string> {
  // Generate 20 random bytes (160 bits) for the address
  const randomBytes = new Uint8Array(20);
  crypto.getRandomValues(randomBytes);
  
  // Convert to hex string with 0x prefix
  const hexAddress = "0x" + Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  
  return hexAddress;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (!corsHeaders) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with user's auth token
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from auth header
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating wallet for user: ${user.id}`);

    // Check KYC status
    const { data: kycData, error: kycError } = await supabaseClient
      .from("user_kyc")
      .select("status")
      .eq("user_id", user.id)
      .single();

    if (kycError && kycError.code !== "PGRST116") {
      console.error("KYC lookup error:", kycError);
      return new Response(
        JSON.stringify({ error: "Failed to check KYC status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!kycData || kycData.status !== "approved") {
      console.log("KYC not approved for user:", user.id);
      return new Response(
        JSON.stringify({ error: "KYC approval required before wallet creation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if wallet already exists
    const { data: existingWallet, error: walletCheckError } = await supabaseClient
      .from("user_wallets")
      .select("wallet_address, network, created_at")
      .eq("user_id", user.id)
      .single();

    if (existingWallet) {
      console.log("Wallet already exists for user:", user.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          wallet: existingWallet,
          message: "Wallet already exists" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate new wallet address
    const walletAddress = await generateWalletAddress();
    console.log(`Generated wallet address: ${walletAddress}`);

    // Store wallet (using service role to bypass RLS for insert)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: newWallet, error: insertError } = await adminClient
      .from("user_wallets")
      .insert({
        user_id: user.id,
        wallet_address: walletAddress,
        network: "ethereum",
        wallet_type: "custodial",
      })
      .select("wallet_address, network, created_at")
      .single();

    if (insertError) {
      console.error("Wallet insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create wallet" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Wallet created successfully for user: ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        wallet: newWallet,
        message: "Wallet created successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});