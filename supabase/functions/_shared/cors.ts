import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2/cors";

const requestHeaders = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-retry-count",
  "traceparent",
  "tracestate",
  "baggage",
].join(", ");

export function getCorsHeaders(request: Request) {
  const { "Access-Control-Allow-Origin": _defaultOrigin, ...headers } =
    supabaseCorsHeaders;
  const origin = request.headers.get("origin");
  const allowedOrigins = Deno.env.get("ALLOWED_ORIGINS")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];

  if (origin && !allowedOrigins.includes(origin)) {
    return null;
  }

  return {
    ...headers,
    "Access-Control-Allow-Origin": origin ?? "null",
    "Access-Control-Allow-Headers": requestHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
