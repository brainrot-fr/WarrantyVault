import { createCallerClient, createRollbackClient } from "../_shared/auth.ts";
import { sendBrevoEmail } from "../_shared/brevo.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { buildInviteEmail, parseInviteRequest } from "./invite-core.ts";

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
      { error: "Use POST to send a household invitation." },
      405,
      cors,
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse(
      { error: "The request body must be valid JSON." },
      400,
      cors,
    );
  }

  const input = parseInviteRequest(requestBody);
  if (!input) {
    return jsonResponse(
      { error: "Enter a valid household ID and email address." },
      400,
      cors,
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse(
      { error: "Sign in before sending a household invitation." },
      401,
      cors,
    );
  }

  let callerClient: ReturnType<typeof createCallerClient>;
  try {
    callerClient = createCallerClient(authorization);
  } catch (error) {
    console.error("Invite function auth configuration failed.", error);
    return jsonResponse(
      { error: "Invitation service is not configured." },
      500,
      cors,
    );
  }

  const { data: userData, error: userError } = await callerClient.auth
    .getUser();
  const user = userData.user;
  if (userError || !user) {
    return jsonResponse(
      { error: "Your session is invalid. Sign in again and retry." },
      401,
      cors,
    );
  }

  const { data: household, error: householdError } = await callerClient
    .from("households")
    .select("name")
    .eq("id", input.household_id)
    .maybeSingle();
  if (householdError) {
    console.error(
      "Could not validate invite household membership.",
      householdError,
    );
    return jsonResponse(
      { error: "Could not verify access to this household." },
      403,
      cors,
    );
  }
  if (!household) {
    return jsonResponse(
      { error: "This household was not found or you are not a member." },
      404,
      cors,
    );
  }

  const { data: profile, error: profileError } = await callerClient
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error(
      "Could not load the invitation sender profile.",
      profileError,
    );
    return jsonResponse(
      { error: "Could not prepare the invitation email." },
      500,
      cors,
    );
  }

  const { data: currentInvite, error: lookupError } = await callerClient
    .from("household_invites")
    .select("id, expires_at")
    .eq("household_id", input.household_id)
    .eq("email", input.email)
    .eq("status", "pending")
    .maybeSingle();
  if (lookupError) {
    console.error(
      "Could not check for a pending household invitation.",
      lookupError,
    );
    return jsonResponse(
      { error: "Could not prepare the household invitation." },
      500,
      cors,
    );
  }

  let inviteId = currentInvite?.id;
  let createdInvite = false;
  if (currentInvite && Date.parse(currentInvite.expires_at) <= Date.now()) {
    try {
      const adminClient = createRollbackClient();
      const { error } = await adminClient
        .from("household_invites")
        .delete()
        .eq("id", currentInvite.id)
        .eq("household_id", input.household_id)
        .eq("email", input.email)
        .eq("status", "pending")
        .lte("expires_at", new Date().toISOString());
      if (error) {
        throw error;
      }
      inviteId = undefined;
    } catch (error) {
      console.error(
        "Could not replace the expired household invitation.",
        error,
      );
      return jsonResponse(
        { error: "Could not renew the expired household invitation." },
        500,
        cors,
      );
    }
  }

  if (!inviteId) {
    const { data: insertedInvite, error: insertError } = await callerClient
      .from("household_invites")
      .insert({
        household_id: input.household_id,
        email: input.email,
        invited_by: user.id,
      })
      .select("id")
      .single();

    if (insertError?.code === "23505") {
      const { data: racedInvite, error: racedLookupError } = await callerClient
        .from("household_invites")
        .select("id")
        .eq("household_id", input.household_id)
        .eq("email", input.email)
        .eq("status", "pending")
        .maybeSingle();
      if (racedLookupError || !racedInvite) {
        console.error(
          "A concurrent invitation could not be reloaded.",
          racedLookupError ?? insertError,
        );
        return jsonResponse(
          { error: "Could not prepare the household invitation." },
          500,
          cors,
        );
      }
      inviteId = racedInvite.id;
    } else if (insertError || !insertedInvite) {
      console.error("Could not create the household invitation.", insertError);
      return jsonResponse(
        { error: "Could not create the household invitation." },
        500,
        cors,
      );
    } else {
      inviteId = insertedInvite.id;
      createdInvite = true;
    }
  }

  const appUrl = Deno.env.get("APP_URL");
  if (!appUrl) {
    return await rollbackAndRespond(
      input.household_id,
      input.email,
      inviteId,
      user.id,
      createdInvite,
      cors,
      new Error("APP_URL is not configured."),
    );
  }

  try {
    const email = buildInviteEmail(
      input.email,
      household.name,
      profile?.display_name || user.email || "A household member",
      appUrl,
    );
    await sendBrevoEmail({
      ...email,
      to: [{ email: input.email }],
    });
  } catch (error) {
    return await rollbackAndRespond(
      input.household_id,
      input.email,
      inviteId,
      user.id,
      createdInvite,
      cors,
      error,
    );
  }

  return jsonResponse({ ok: true, invite_id: inviteId }, 200, cors);
});

async function rollbackAndRespond(
  householdId: string,
  email: string,
  inviteId: string,
  inviterId: string,
  createdInvite: boolean,
  cors: Record<string, string>,
  cause: unknown,
) {
  console.error("Could not send the household invitation email.", cause);

  if (createdInvite) {
    try {
      const adminClient = createRollbackClient();
      const { error } = await adminClient
        .from("household_invites")
        .delete()
        .eq("id", inviteId)
        .eq("household_id", householdId)
        .eq("email", email)
        .eq("invited_by", inviterId)
        .eq("status", "pending");
      if (error) {
        throw error;
      }
    } catch (rollbackError) {
      console.error(
        "Could not roll back the unsent household invitation.",
        rollbackError,
      );
      return jsonResponse(
        {
          error:
            "The invitation email failed and the new invitation could not be removed. Contact support.",
        },
        500,
        cors,
      );
    }
  }

  return jsonResponse(
    {
      error:
        "Could not send the invitation email. Check the email service configuration and retry.",
    },
    502,
    cors,
  );
}
