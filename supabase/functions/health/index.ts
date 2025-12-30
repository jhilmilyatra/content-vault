// Health endpoint for cold-start elimination
// Ping every 5 minutes to keep functions warm

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  const startTime = performance.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Simple health check - no DB calls to keep it fast
  const response = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    region: Deno.env.get("DENO_REGION") || "unknown",
    latencyMs: Math.round(performance.now() - startTime),
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store",
    },
  });
});

