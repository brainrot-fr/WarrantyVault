import { createCallerClient } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createPrivateDownloadUrl } from "../_shared/cloudinary.ts";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      { error: "Use POST to request a receipt URL." },
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
  if (
    typeof body !== "object" ||
    body === null ||
    !("item_id" in body) ||
    typeof body.item_id !== "string" ||
    !uuidPattern.test(body.item_id)
  ) {
    return jsonResponse({ error: "Enter a valid item ID." }, 400, cors);
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Sign in to view this receipt." }, 401, cors);
  }

  let callerClient: ReturnType<typeof createCallerClient>;
  try {
    callerClient = createCallerClient(authorization);
  } catch (error) {
    console.error("Cloudinary URL auth configuration failed.", error);
    return jsonResponse(
      { error: "Receipt access is not configured." },
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

  const { data: item, error: itemError } = await callerClient
    .from("items")
    .select("receipt_public_id, receipt_resource_type, receipt_format")
    .eq("id", body.item_id)
    .maybeSingle();
  if (itemError) {
    console.error("Could not read the receipt item.", itemError);
    return jsonResponse({ error: "Could not load this receipt." }, 500, cors);
  }
  if (!item) {
    return jsonResponse(
      { error: "This item was not found or is not accessible." },
      404,
      cors,
    );
  }
  if (
    !item.receipt_public_id || !item.receipt_format ||
    !item.receipt_resource_type
  ) {
    return jsonResponse(
      { error: "This item does not have a saved receipt." },
      404,
      cors,
    );
  }
  if (
    item.receipt_resource_type !== "image" ||
    !["jpg", "png", "pdf"].includes(item.receipt_format)
  ) {
    return jsonResponse(
      { error: "This receipt has unsupported storage metadata." },
      422,
      cors,
    );
  }

  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) {
    return jsonResponse(
      { error: "Receipt access is not configured." },
      500,
      cors,
    );
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
  try {
    const url = await createPrivateDownloadUrl({
      apiKey,
      apiSecret,
      cloudName,
      expiresAt,
      format: item.receipt_format,
      publicId: item.receipt_public_id,
      resourceType: item.receipt_resource_type,
      timestamp: Math.floor(Date.now() / 1000),
    });
    return jsonResponse(
      {
        url,
        expires_at: new Date(expiresAt * 1000).toISOString(),
        disposition: "attachment",
      },
      200,
      cors,
    );
  } catch (error) {
    console.error("Could not create an expiring Cloudinary URL.", error);
    return jsonResponse(
      { error: "Could not create a temporary receipt link." },
      502,
      cors,
    );
  }
});
