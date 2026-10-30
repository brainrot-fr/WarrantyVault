import { createCallerClient } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createCloudinarySignature,
  getHouseholdIdFromPublicId,
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
    return jsonResponse({ error: "Use POST to delete a receipt." }, 405, cors);
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
  if (
    typeof body !== "object" ||
    body === null ||
    !("public_id" in body) ||
    !("resource_type" in body) ||
    typeof body.public_id !== "string" ||
    body.resource_type !== "image"
  ) {
    return jsonResponse(
      { error: "Enter a valid receipt public ID and resource type." },
      400,
      cors,
    );
  }
  const householdId = getHouseholdIdFromPublicId(body.public_id);
  if (!householdId) {
    return jsonResponse(
      { error: "This receipt does not belong to a WarrantyVault household." },
      400,
      cors,
    );
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse(
      { error: "Sign in before deleting a receipt." },
      401,
      cors,
    );
  }

  let callerClient: ReturnType<typeof createCallerClient>;
  try {
    callerClient = createCallerClient(authorization);
  } catch (error) {
    console.error("Receipt deletion auth configuration failed.", error);
    return jsonResponse(
      { error: "Receipt deletion is not configured." },
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
    console.error(
      "Could not verify receipt deletion household access.",
      householdError,
    );
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
      { error: "Receipt deletion is not configured." },
      500,
      cors,
    );
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await createCloudinarySignature(
    { public_id: body.public_id, timestamp },
    apiSecret,
  );
  const form = new FormData();
  form.set("public_id", body.public_id);
  form.set("timestamp", timestamp);
  form.set("api_key", apiKey);
  form.set("signature", signature);

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${
        encodeURIComponent(cloudName)
      }/image/destroy`,
      { method: "POST", body: form },
    );
  } catch (error) {
    console.error("Cloudinary receipt deletion request failed.", error);
    return jsonResponse(
      { error: "Cloudinary could not be reached. Retry deleting the receipt." },
      502,
      cors,
    );
  }
  if (!response.ok) {
    console.error("Cloudinary rejected receipt deletion.", {
      status: response.status,
    });
    return jsonResponse(
      { error: "Cloudinary could not delete the receipt." },
      502,
      cors,
    );
  }
  const result: unknown = await response.json();
  if (
    typeof result !== "object" ||
    result === null ||
    !("result" in result) ||
    (result.result !== "ok" && result.result !== "not found")
  ) {
    console.error("Cloudinary returned an unexpected receipt deletion result.");
    return jsonResponse(
      { error: "Cloudinary returned an unexpected deletion result." },
      502,
      cors,
    );
  }
  return jsonResponse({ deleted: result.result === "ok" }, 200, cors);
});
