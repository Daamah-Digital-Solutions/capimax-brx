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

interface InvestmentRequest {
  property_id: string;
  property_name: string;
  amount: number;
  token_amount: number;
  token_symbol: string;
  price_per_token: number;
  ownership_percentage: number;
  payment_method: string;
}

// Input validation helper
function validateInvestmentData(data: unknown): { valid: boolean; error?: string } {
  const investmentData = data as Record<string, unknown>;
  
  // Validate required fields exist
  const requiredFields = ['property_id', 'property_name', 'amount', 'token_amount', 'token_symbol', 'price_per_token', 'ownership_percentage', 'payment_method'];
  for (const field of requiredFields) {
    if (!(field in investmentData)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  // Validate numeric fields - amount
  if (typeof investmentData.amount !== 'number' || investmentData.amount <= 0 || investmentData.amount > 10000000) {
    return { valid: false, error: 'Investment amount must be between $1 and $10,000,000' };
  }

  // Validate token_amount
  if (typeof investmentData.token_amount !== 'number' || investmentData.token_amount <= 0) {
    return { valid: false, error: 'Token amount must be positive' };
  }

  // Validate price_per_token
  if (typeof investmentData.price_per_token !== 'number' || investmentData.price_per_token <= 0) {
    return { valid: false, error: 'Price per token must be positive' };
  }

  // Validate ownership_percentage
  if (typeof investmentData.ownership_percentage !== 'number' || 
      investmentData.ownership_percentage <= 0 || 
      investmentData.ownership_percentage > 100) {
    return { valid: false, error: 'Ownership percentage must be between 0 and 100' };
  }

  // Validate string fields
  if (typeof investmentData.property_name !== 'string' || 
      investmentData.property_name.length === 0 || 
      investmentData.property_name.length > 200) {
    return { valid: false, error: 'Property name must be 1-200 characters' };
  }

  if (typeof investmentData.property_id !== 'string' || 
      investmentData.property_id.length === 0 || 
      investmentData.property_id.length > 100) {
    return { valid: false, error: 'Property ID must be 1-100 characters' };
  }

  if (typeof investmentData.token_symbol !== 'string' || 
      investmentData.token_symbol.length === 0 || 
      investmentData.token_symbol.length > 20) {
    return { valid: false, error: 'Token symbol must be 1-20 characters' };
  }

  if (typeof investmentData.payment_method !== 'string' || 
      investmentData.payment_method.length === 0 || 
      investmentData.payment_method.length > 50) {
    return { valid: false, error: 'Payment method must be 1-50 characters' };
  }

  return { valid: true };
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
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from auth header
    const { data: { user }, error: authError } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawData = await req.json();
    
    // Comprehensive input validation
    const validation = validateInvestmentData(rawData);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const investmentData = rawData as InvestmentRequest;

    console.log(`Processing investment for user: ${user.id}, property: ${investmentData.property_id}`);

    // Use admin client for database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user has a wallet
    const { data: wallet } = await adminClient
      .from("user_wallets")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    // Deduplication: block rapid duplicate pending/processing investments for same property
    const { data: recentDup } = await adminClient
      .from("investments")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("property_id", investmentData.property_id)
      .in("payment_status", ["pending", "processing"])
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .maybeSingle();

    if (recentDup) {
      return new Response(
        JSON.stringify({
          error: "Duplicate investment detected",
          details: "A recent investment for this property is still being processed. Please wait a moment and try again.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the investment record
    const { data: investment, error: investmentError } = await adminClient
      .from("investments")
      .insert({
        user_id: user.id,
        wallet_id: wallet?.id || null,
        property_id: investmentData.property_id,
        property_name: investmentData.property_name,
        amount_invested: investmentData.amount,
        token_amount: investmentData.token_amount,
        token_symbol: investmentData.token_symbol,
        price_per_token: investmentData.price_per_token,
        ownership_percentage: investmentData.ownership_percentage,
        payment_method: investmentData.payment_method,
        payment_status: "pending",
        tokens_minted: false,
      })
      .select()
      .single();

    if (investmentError) {
      console.error("Error creating investment:", investmentError);
      return new Response(
        JSON.stringify({ error: "Failed to create investment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Investment created: ${investment.id}`);

    // Simulate payment processing (in production, integrate with payment gateway)
    // For demo, we'll immediately mark as completed
    const { error: updateError } = await adminClient
      .from("investments")
      .update({ payment_status: "completed" })
      .eq("id", investment.id);

    if (updateError) {
      console.error("Error updating payment status:", updateError);
    }

    // If user has a wallet, automatically mint tokens
    let mintResult = null;
    if (wallet) {
      console.log(`User has wallet, auto-minting tokens...`);
      
      // Check for existing token
      const { data: existingToken } = await adminClient
        .from("ownership_tokens")
        .select("*")
        .eq("wallet_id", wallet.id)
        .eq("property_id", investmentData.property_id)
        .maybeSingle();

      if (existingToken) {
        // Update existing token
        const newAmount = Number(existingToken.token_amount) + Number(investmentData.token_amount);
        const newValue = Number(existingToken.token_value_usd) + Number(investmentData.amount);
        const newOwnership = Number(existingToken.ownership_percentage) + Number(investmentData.ownership_percentage);

        const { data: updatedToken, error: tokenError } = await adminClient
          .from("ownership_tokens")
          .update({
            token_amount: newAmount,
            token_value_usd: newValue,
            ownership_percentage: newOwnership,
          })
          .eq("id", existingToken.id)
          .select()
          .single();

        if (!tokenError) {
          mintResult = { token: updatedToken, updated: true };
        }
      } else {
        // Create new token
        const { data: newToken, error: tokenError } = await adminClient
          .from("ownership_tokens")
          .insert({
            wallet_id: wallet.id,
            property_id: investmentData.property_id,
            property_name: investmentData.property_name,
            token_symbol: investmentData.token_symbol,
            token_amount: investmentData.token_amount,
            token_value_usd: investmentData.amount,
            ownership_percentage: investmentData.ownership_percentage,
            acquisition_date: new Date().toISOString(),
            status: "active",
          })
          .select()
          .single();

        if (!tokenError) {
          mintResult = { token: newToken, created: true };
        }
      }

      if (mintResult) {
        // Generate transaction record
        const txHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");

        await adminClient.from("wallet_transactions").insert({
          wallet_id: wallet.id,
          tx_hash: txHash,
          tx_type: "receive",
          amount: investmentData.token_amount,
          token_symbol: investmentData.token_symbol,
          status: "confirmed",
          block_number: Math.floor(Math.random() * 1000000) + 19000000,
        });

        // Update investment as minted
        await adminClient
          .from("investments")
          .update({
            tokens_minted: true,
            minted_at: new Date().toISOString(),
            wallet_id: wallet.id,
          })
          .eq("id", investment.id);

        console.log(`Tokens minted successfully for investment: ${investment.id}`);
      }
    } else {
      console.log(`User has no wallet, tokens will be minted when wallet is created`);
    }

    // Generate provisional certificate
    let certificateGenerated = false;
    try {
      // Fetch user profile for investor name
      const { data: profile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const investorName = profile?.full_name || user.email?.split("@")[0] || "Investor";
      const investorIdMasked = `INV-${user.id.slice(0, 4)}****${user.id.slice(-4)}`;

      // Generate unique IDs
      const year = new Date().getFullYear();
      const spvCode = investmentData.property_id.slice(0, 3).toUpperCase().padEnd(3, "X");
      const uniqueCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const certificateId = `CERT-${year}-${spvCode}-${uniqueCode}`;
      
      const verificationCode = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
        .slice(0, 12);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const verificationUrl = `${supabaseUrl.replace(".supabase.co", ".lovable.app")}/verify/${verificationCode}`;

      // Create certificate record (PDF will be generated on-demand)
      const { error: certError } = await adminClient
        .from("certificates")
        .insert({
          certificate_id: certificateId,
          user_id: user.id,
          investment_id: investment.id,
          status: "provisional",
          issue_date: new Date().toISOString(),
          investor_name: investorName,
          investor_id_masked: investorIdMasked,
          spv_name: `${investmentData.property_name} SPV Ltd`,
          property_name: investmentData.property_name,
          property_location: "Dubai, UAE",
          listing_id: investmentData.property_id,
          investment_amount: investmentData.amount,
          units_purchased: investmentData.token_amount,
          unit_price: investmentData.price_per_token,
          ownership_percentage: investmentData.ownership_percentage,
          subscription_date: new Date().toISOString(),
          platform_fee: 0,
          verification_code: verificationCode,
          verification_url: verificationUrl,
        });

      if (!certError) {
        certificateGenerated = true;
        console.log(`Provisional certificate generated: ${certificateId}`);
      } else {
        console.error("Certificate generation error:", certError);
      }
    } catch (certErr) {
      console.error("Certificate generation failed:", certErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        investment_id: investment.id,
        tokens_minted: !!mintResult,
        certificate_generated: certificateGenerated,
        mint_result: mintResult,
        message: mintResult 
          ? "Investment completed and tokens minted successfully" 
          : "Investment completed. Create a wallet to receive your tokens.",
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