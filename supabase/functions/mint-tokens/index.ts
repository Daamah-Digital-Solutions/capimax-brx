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

interface MintRequest {
  investment_id: string;
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
    
    // Create client with user's auth token for validation
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

    const { investment_id }: MintRequest = await req.json();

    if (!investment_id) {
      return new Response(
        JSON.stringify({ error: "Investment ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing token minting for investment: ${investment_id}, user: ${user.id}`);

    // Use admin client for operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the investment
    const { data: investment, error: investmentError } = await adminClient
      .from("investments")
      .select("*")
      .eq("id", investment_id)
      .eq("user_id", user.id)
      .single();

    if (investmentError || !investment) {
      console.error("Investment not found:", investmentError);
      return new Response(
        JSON.stringify({ error: "Investment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already minted
    if (investment.tokens_minted) {
      console.log("Tokens already minted for investment:", investment_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Tokens already minted",
          already_minted: true 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check payment status
    if (investment.payment_status !== "completed") {
      console.log("Payment not completed for investment:", investment_id);
      return new Response(
        JSON.stringify({ error: "Payment must be completed before minting tokens" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await adminClient
      .from("user_wallets")
      .select("id, wallet_address")
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) {
      console.error("Wallet not found for user:", user.id);
      return new Response(
        JSON.stringify({ error: "User wallet not found. Please create a wallet first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Minting ${investment.token_amount} tokens to wallet ${wallet.wallet_address}`);

    // Check if token already exists for this property in this wallet
    const { data: existingToken, error: existingTokenError } = await adminClient
      .from("ownership_tokens")
      .select("*")
      .eq("wallet_id", wallet.id)
      .eq("property_id", investment.property_id)
      .maybeSingle();

    let tokenResult;

    if (existingToken) {
      // Update existing token balance
      const newAmount = Number(existingToken.token_amount) + Number(investment.token_amount);
      const newValue = Number(existingToken.token_value_usd) + Number(investment.amount_invested);
      const newOwnership = Number(existingToken.ownership_percentage) + Number(investment.ownership_percentage);

      const { data: updatedToken, error: updateError } = await adminClient
        .from("ownership_tokens")
        .update({
          token_amount: newAmount,
          token_value_usd: newValue,
          ownership_percentage: newOwnership,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingToken.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating token:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update token balance" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      tokenResult = updatedToken;
      console.log(`Updated existing token. New balance: ${newAmount}`);
    } else {
      // Create new ownership token
      const { data: newToken, error: createError } = await adminClient
        .from("ownership_tokens")
        .insert({
          wallet_id: wallet.id,
          property_id: investment.property_id,
          property_name: investment.property_name,
          token_symbol: investment.token_symbol,
          token_amount: investment.token_amount,
          token_value_usd: investment.amount_invested,
          ownership_percentage: investment.ownership_percentage,
          acquisition_date: new Date().toISOString(),
          status: "active",
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating token:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to mint tokens" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      tokenResult = newToken;
      console.log(`Created new token: ${newToken.id}`);
    }

    // Generate mock transaction hash for blockchain record
    const txHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Record the transaction
    const { error: txError } = await adminClient
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        tx_hash: txHash,
        tx_type: "receive",
        amount: investment.token_amount,
        token_symbol: investment.token_symbol,
        status: "confirmed",
        block_number: Math.floor(Math.random() * 1000000) + 19000000,
      });

    if (txError) {
      console.error("Error recording transaction:", txError);
      // Don't fail the whole operation for transaction logging
    }

    // Update investment as minted
    const { error: updateInvestmentError } = await adminClient
      .from("investments")
      .update({
        tokens_minted: true,
        minted_at: new Date().toISOString(),
        wallet_id: wallet.id,
      })
      .eq("id", investment_id);

    if (updateInvestmentError) {
      console.error("Error updating investment:", updateInvestmentError);
    }

    console.log(`Token minting completed for investment: ${investment_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Tokens minted successfully",
        token: tokenResult,
        transaction_hash: txHash,
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