import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// VPS Configuration - uses environment variables only
const VPS_ENDPOINT = Deno.env.get("VPS_ENDPOINT") || "";
const VPS_API_KEY = Deno.env.get("VPS_API_KEY") || "";
const VPS_TIMEOUT = 5000;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Optional: Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const token = authHeader.replace("Bearer ", "");
      const { error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        console.log("Auth check failed, but continuing for health check");
      }
    }

    // Check VPS health
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VPS_TIMEOUT);

    try {
      const response = await fetch(`${VPS_ENDPOINT}/health`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${VPS_API_KEY}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        
        return new Response(
          JSON.stringify({
            status: "online",
            timestamp: new Date().toISOString(),
            vpsData: data,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        console.log(`VPS returned status: ${response.status}`);
        return new Response(
          JSON.stringify({
            status: "offline",
            reason: `VPS returned ${response.status}`,
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200, // Return 200 so client can handle gracefully
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown error";
      console.error("VPS health check failed:", errorMessage);
      
      return new Response(
        JSON.stringify({
          status: "offline",
          reason: errorMessage.includes("abort") ? "timeout" : errorMessage,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200, // Return 200 so client can handle gracefully
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        reason: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
