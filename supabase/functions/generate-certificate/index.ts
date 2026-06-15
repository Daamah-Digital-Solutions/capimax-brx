import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

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

interface CertificateRequest {
  investment_id: string;
  status?: "provisional" | "final";
}

// Generate unique certificate ID: CERT-YYYY-SPV-XXXXXX
function generateCertificateId(propertyId: string): string {
  const year = new Date().getFullYear();
  const spvCode = propertyId.slice(0, 3).toUpperCase().padEnd(3, "X");
  const uniqueCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CERT-${year}-${spvCode}-${uniqueCode}`;
}

// Generate verification code
function generateVerificationCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .slice(0, 12);
}

// Create PDF certificate
async function createCertificatePDF(data: {
  certificateId: string;
  status: string;
  issueDate: string;
  investorName: string;
  investorIdMasked: string;
  spvName: string;
  propertyName: string;
  propertyLocation: string;
  investmentAmount: number;
  units: number;
  unitPrice: number;
  ownershipPercentage: number;
  subscriptionDate: string;
  verificationCode: string;
  verificationUrl: string;
  authorizedSignatory: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const primaryColor = rgb(0.1, 0.2, 0.4);
  const goldColor = rgb(0.78, 0.62, 0.24);
  const textColor = rgb(0.2, 0.2, 0.2);

  // Header background
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width: width,
    height: 120,
    color: primaryColor,
  });

  // Platform name
  page.drawText("CAPIMAX RT", {
    x: 50,
    y: height - 50,
    size: 24,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  // Certificate title
  page.drawText("INVESTMENT CERTIFICATE", {
    x: 50,
    y: height - 80,
    size: 16,
    font: helvetica,
    color: rgb(0.8, 0.8, 0.8),
  });

  // Status badge
  const statusText = data.status.toUpperCase();
  const statusColor = data.status === "final" ? rgb(0.2, 0.6, 0.2) : goldColor;
  page.drawText(statusText, {
    x: width - 150,
    y: height - 60,
    size: 14,
    font: helveticaBold,
    color: statusColor,
  });

  // Certificate ID
  page.drawText(`Certificate ID: ${data.certificateId}`, {
    x: width - 250,
    y: height - 100,
    size: 10,
    font: helvetica,
    color: rgb(0.7, 0.7, 0.7),
  });

  let yPos = height - 160;

  // Issue date
  page.drawText(`Issue Date: ${data.issueDate}`, {
    x: 50,
    y: yPos,
    size: 10,
    font: helvetica,
    color: textColor,
  });

  yPos -= 40;

  // Section: Investor Details
  page.drawText("INVESTOR DETAILS", {
    x: 50,
    y: yPos,
    size: 12,
    font: helveticaBold,
    color: primaryColor,
  });
  page.drawLine({
    start: { x: 50, y: yPos - 5 },
    end: { x: width - 50, y: yPos - 5 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  yPos -= 25;
  page.drawText(`Full Legal Name: ${data.investorName}`, {
    x: 50,
    y: yPos,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  yPos -= 18;
  page.drawText(`Investor ID: ${data.investorIdMasked}`, {
    x: 50,
    y: yPos,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  yPos -= 35;

  // Section: Property/SPV Details
  page.drawText("PROPERTY & SPV DETAILS", {
    x: 50,
    y: yPos,
    size: 12,
    font: helveticaBold,
    color: primaryColor,
  });
  page.drawLine({
    start: { x: 50, y: yPos - 5 },
    end: { x: width - 50, y: yPos - 5 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  yPos -= 25;
  page.drawText(`SPV Name: ${data.spvName}`, {
    x: 50,
    y: yPos,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  yPos -= 18;
  page.drawText(`Property: ${data.propertyName}`, {
    x: 50,
    y: yPos,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  yPos -= 18;
  page.drawText(`Location: ${data.propertyLocation}`, {
    x: 50,
    y: yPos,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  yPos -= 35;

  // Section: Investment Details
  page.drawText("INVESTMENT DETAILS", {
    x: 50,
    y: yPos,
    size: 12,
    font: helveticaBold,
    color: primaryColor,
  });
  page.drawLine({
    start: { x: 50, y: yPos - 5 },
    end: { x: width - 50, y: yPos - 5 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  yPos -= 25;
  const col1X = 50;
  const col2X = 320;

  page.drawText(`Investment Amount:`, { x: col1X, y: yPos, size: 10, font: helvetica, color: textColor });
  page.drawText(`$${data.investmentAmount.toLocaleString()}`, { x: col1X + 120, y: yPos, size: 10, font: helveticaBold, color: textColor });
  
  page.drawText(`Unit Price:`, { x: col2X, y: yPos, size: 10, font: helvetica, color: textColor });
  page.drawText(`$${data.unitPrice.toLocaleString()}`, { x: col2X + 80, y: yPos, size: 10, font: helveticaBold, color: textColor });

  yPos -= 18;
  page.drawText(`Units/Shares:`, { x: col1X, y: yPos, size: 10, font: helvetica, color: textColor });
  page.drawText(`${data.units}`, { x: col1X + 120, y: yPos, size: 10, font: helveticaBold, color: textColor });

  page.drawText(`Ownership:`, { x: col2X, y: yPos, size: 10, font: helvetica, color: textColor });
  page.drawText(`${data.ownershipPercentage.toFixed(4)}%`, { x: col2X + 80, y: yPos, size: 10, font: helveticaBold, color: textColor });

  yPos -= 18;
  page.drawText(`Subscription Date:`, { x: col1X, y: yPos, size: 10, font: helvetica, color: textColor });
  page.drawText(`${data.subscriptionDate}`, { x: col1X + 120, y: yPos, size: 10, font: helveticaBold, color: textColor });

  yPos -= 45;

  // Section: Verification
  page.drawText("VERIFICATION", {
    x: 50,
    y: yPos,
    size: 12,
    font: helveticaBold,
    color: primaryColor,
  });
  page.drawLine({
    start: { x: 50, y: yPos - 5 },
    end: { x: width - 50, y: yPos - 5 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  yPos -= 25;
  page.drawText(`Verification Code: ${data.verificationCode}`, {
    x: 50,
    y: yPos,
    size: 11,
    font: helveticaBold,
    color: textColor,
  });

  yPos -= 18;
  page.drawText(`Verify at: ${data.verificationUrl}`, {
    x: 50,
    y: yPos,
    size: 10,
    font: helvetica,
    color: rgb(0.2, 0.4, 0.8),
  });

  // QR Code placeholder
  page.drawRectangle({
    x: width - 130,
    y: yPos - 40,
    width: 80,
    height: 80,
    borderColor: textColor,
    borderWidth: 1,
  });
  page.drawText("QR Code", {
    x: width - 115,
    y: yPos - 5,
    size: 8,
    font: helvetica,
    color: textColor,
  });

  yPos -= 80;

  // Signature section
  page.drawLine({
    start: { x: 50, y: yPos },
    end: { x: 250, y: yPos },
    thickness: 1,
    color: textColor,
  });

  yPos -= 15;
  page.drawText(data.authorizedSignatory, {
    x: 50,
    y: yPos,
    size: 10,
    font: helveticaBold,
    color: textColor,
  });

  yPos -= 12;
  page.drawText("Authorized Signatory", {
    x: 50,
    y: yPos,
    size: 9,
    font: helvetica,
    color: textColor,
  });

  // Footer
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 40,
    color: rgb(0.95, 0.95, 0.95),
  });

  page.drawText("This certificate is digitally generated and verified by Capimax BRX Platform", {
    x: 50,
    y: 15,
    size: 8,
    font: helvetica,
    color: textColor,
  });

  page.drawText(`Generated: ${new Date().toISOString()}`, {
    x: width - 180,
    y: 15,
    size: 8,
    font: helvetica,
    color: textColor,
  });

  return await pdfDoc.save();
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

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { investment_id, status = "provisional" }: CertificateRequest = await req.json();

    if (!investment_id) {
      return new Response(
        JSON.stringify({ error: "Investment ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating ${status} certificate for investment: ${investment_id}`);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch investment details
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

    // Check if certificate already exists
    const { data: existingCert } = await adminClient
      .from("certificates")
      .select("*")
      .eq("investment_id", investment_id)
      .maybeSingle();

    if (existingCert) {
      console.log("Certificate already exists:", existingCert.certificate_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          certificate: existingCert,
          message: "Certificate already exists" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const investorName = profile?.full_name || user.email?.split("@")[0] || "Investor";
    const investorIdMasked = `INV-${user.id.slice(0, 4)}****${user.id.slice(-4)}`;

    // Generate certificate data
    const certificateId = generateCertificateId(investment.property_id);
    const verificationCode = generateVerificationCode();
    const verificationUrl = `${supabaseUrl.replace(".supabase.co", ".lovable.app")}/verify/${verificationCode}`;
    const issueDate = new Date().toISOString();

    // Create PDF
    const pdfData = await createCertificatePDF({
      certificateId,
      status,
      issueDate: new Date().toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "long", 
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      investorName,
      investorIdMasked,
      spvName: `${investment.property_name} SPV Ltd`,
      propertyName: investment.property_name,
      propertyLocation: "Dubai, UAE",
      investmentAmount: Number(investment.amount_invested),
      units: Number(investment.token_amount),
      unitPrice: Number(investment.price_per_token),
      ownershipPercentage: Number(investment.ownership_percentage),
      subscriptionDate: new Date(investment.created_at).toLocaleDateString("en-US"),
      verificationCode,
      verificationUrl,
      authorizedSignatory: "Capimax BRX Authorized Officer",
    });

    // Upload PDF to storage
    const pdfPath = `${user.id}/${certificateId}.pdf`;
    const { error: uploadError } = await adminClient.storage
      .from("certificates")
      .upload(pdfPath, pdfData, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("PDF upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload certificate PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get signed URL for the PDF
    const { data: signedUrlData } = await adminClient.storage
      .from("certificates")
      .createSignedUrl(pdfPath, 60 * 60 * 24 * 365); // 1 year

    // Create certificate record
    const { data: certificate, error: certError } = await adminClient
      .from("certificates")
      .insert({
        certificate_id: certificateId,
        user_id: user.id,
        investment_id: investment.id,
        status,
        issue_date: issueDate,
        investor_name: investorName,
        investor_id_masked: investorIdMasked,
        spv_name: `${investment.property_name} SPV Ltd`,
        property_name: investment.property_name,
        property_location: "Dubai, UAE",
        listing_id: investment.property_id,
        investment_amount: investment.amount_invested,
        units_purchased: investment.token_amount,
        unit_price: investment.price_per_token,
        ownership_percentage: investment.ownership_percentage,
        subscription_date: investment.created_at,
        platform_fee: 0,
        verification_code: verificationCode,
        verification_url: verificationUrl,
        pdf_url: signedUrlData?.signedUrl,
        pdf_path: pdfPath,
      })
      .select()
      .single();

    if (certError) {
      console.error("Certificate insert error:", certError);
      return new Response(
        JSON.stringify({ error: "Failed to create certificate record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Certificate generated successfully: ${certificateId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        certificate,
        message: "Certificate generated successfully" 
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