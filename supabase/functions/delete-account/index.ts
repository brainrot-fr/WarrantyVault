import { createCallerClient, createServiceClient } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createCloudinarySignature } from "../_shared/cloudinary.ts";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function response(body: Record<string, unknown>, status: number, cors: Record<string, string>) {
  return Response.json(body, { status, headers: { ...cors, ...jsonHeaders } });
}

async function deleteCloudinaryReceipt(
  publicId: string,
  resourceType: string,
) {
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) return false;

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await createCloudinarySignature({ public_id: publicId, timestamp }, apiSecret);
  const form = new FormData();
  form.set("public_id", publicId);
  form.set("timestamp", timestamp);
  form.set("api_key", apiKey);
  form.set("signature", signature);
  const cloudinaryResourceType = resourceType === "raw" ? "raw" : "image";
  const result = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${cloudinaryResourceType}/destroy`,
    { method: "POST", body: form },
  );
  if (!result.ok) return false;
  const body = await result.json();
  return body.result === "ok" || body.result === "not found";
}

Deno.serve(async (request) => {
  const cors = getCorsHeaders(request);
  if (!cors) return new Response("Origin not allowed.", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return response({ error: "Use POST to delete your account." }, 405, cors);

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return response({ error: "Sign in before deleting your account." }, 401, cors);
  }

  const caller = createCallerClient(authorization);
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return response({ error: "Your session is invalid. Sign in again." }, 401, cors);
  }
  const userId = userData.user.id;

  const admin = createServiceClient();
  const { data: ownedHouseholds, error: householdError } = await admin
    .from("households")
    .select("id, household_members(user_id)")
    .eq("created_by", userId);
  if (householdError) {
    console.error("Could not inspect account households.", householdError);
    return response({ error: "We could not check your families. Please try again." }, 500, cors);
  }
  const sharedHousehold = ownedHouseholds?.find((household) =>
    household.household_members.some((member) => member.user_id !== userId)
  );
  if (sharedHousehold) {
    return response({
      error: "Transfer ownership or remove other members before deleting your account.",
    }, 409, cors);
  }

  const householdIds = ownedHouseholds?.map((household) => household.id) ?? [];
  if (householdIds.length > 0) {
    const { data: items } = await admin
      .from("items")
      .select("receipt_public_id, receipt_resource_type")
      .in("household_id", householdIds);
    for (const item of items ?? []) {
      if (item.receipt_public_id) {
        await deleteCloudinaryReceipt(
          item.receipt_public_id,
          item.receipt_resource_type ?? "image",
        ).catch((error) => console.error("Receipt cleanup failed.", error));
      }
    }
    const { error: deleteHouseholdsError } = await admin.from("households").delete().in("id", householdIds);
    if (deleteHouseholdsError) {
      console.error("Could not delete account households.", deleteHouseholdsError);
      return response({ error: "We could not delete your families. Please try again." }, 500, cors);
    }
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    console.error("Could not delete auth account.", deleteUserError);
    return response({ error: "We could not delete your account. Please try again." }, 500, cors);
  }
  return response({ deleted: true }, 200, cors);
});
