import { createCallerClient } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  buildUploadParameters,
  createCloudinarySignature,
  parseHouseholdId,
} from "../_shared/cloudinary.ts";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  cors: Record<string, string>,
) {
  return Response.json(body, { status, headers: { ...cors, ...jsonHeaders } });
}

Deno.serve(async (request) => {
  const cors = getCorsHeaders(request);
  if (!cors) {
    return Response.json({ error: "This origin is not allowed." }, {
      status: 403,
    });
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Use POST to request an upload signature." },
      405,
      cors,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { error: "The request body must be valid JSON." },
      400,
      cors,
    );
  }
  if (typeof body !== "object" || body === null || !("household_id" in body)) {
    return jsonResponse({ error: "Enter a valid household ID." }, 400, cors);
  }
  const householdId = parseHouseholdId(body.household_id);
  if (!householdId) {
    return jsonResponse({ error: "Enter a valid household ID." }, 400, cors);
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse(
      { error: "Sign in before uploading a receipt." },
      401,
      cors,
    );
  }

  let callerClient: ReturnType<typeof createCallerClient>;
  try {
    callerClient = createCallerClient(authorization);
  } catch (error) {
    console.error("Cloudinary signing auth configuration failed.", error);
    return jsonResponse(
      { error: "Receipt storage is not configured." },
      500,
      cors,
    );
  }

  const { data: userData, error: userError } = await callerClient.auth
    .getUser();
  if (userError || !userData.user) {
    return jsonResponse(
      { error: "Your session is invalid. Sign in again and retry." },
      401,
      cors,
    );
  }
  const { data: household, error: householdError } = await callerClient
    .from("households")
    .select("id")
    .eq("id", householdId)
    .maybeSingle();
  if (householdError) {
    console.error("Could not verify receipt household access.", householdError);
    return jsonResponse(
      { error: "Could not verify household access." },
      403,
      cors,
    );
  }
  if (!household) {
    return jsonResponse(
      { error: "This household was not found or is not accessible." },
      404,
      cors,
    );
  }

  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) {
    return jsonResponse(
      { error: "Receipt storage is not configured." },
      500,
      cors,
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = crypto.randomUUID();
  const parameters = buildUploadParameters(householdId, publicId, timestamp);
  const signature = await createCloudinarySignature(parameters, apiSecret);
  return jsonResponse(
    {
      api_key: apiKey,
      cloud_name: cloudName,
      parameters,
      signature,
      upload_url: `https://api.cloudinary.com/v1_1/${
        encodeURIComponent(cloudName)
      }/image/upload`,
    },
    200,
    cors,
  );
});
