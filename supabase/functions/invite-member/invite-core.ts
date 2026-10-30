export interface InviteRequest {
  household_id: string;
  email: string;
}

export interface InviteEmailContent {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export function parseInviteRequest(value: unknown): InviteRequest | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const body = value as Record<string, unknown>;
  if (
    typeof body.household_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(body.household_id) ||
    typeof body.email !== "string"
  ) {
    return null;
  }

  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }

  return { household_id: body.household_id, email };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

export function buildInviteEmail(
  email: string,
  householdName: string,
  inviterName: string,
  appUrl: string,
): InviteEmailContent {
  const safeEmail = escapeHtml(email);
  const safeHouseholdName = escapeHtml(householdName);
  const safeInviterName = escapeHtml(inviterName);
  const appBaseUrl = new URL(appUrl);
  if (
    (appBaseUrl.protocol !== "https:" && appBaseUrl.protocol !== "http:") ||
    appBaseUrl.username ||
    appBaseUrl.password ||
    appBaseUrl.pathname !== "/" ||
    appBaseUrl.search ||
    appBaseUrl.hash
  ) {
    throw new Error(
      "APP_URL must be an HTTP or HTTPS origin without credentials or a path.",
    );
  }
  const inviteUrl = new URL("/invites", appBaseUrl).toString();
  const safeInviteUrl = escapeHtml(inviteUrl);
  const subjectHouseholdName = householdName.replace(/[\r\n\t]+/g, " ").trim()
    .slice(0, 80);
  const subject =
    `You're invited to join ${subjectHouseholdName} on WarrantyVault`;
  const textContent =
    `${inviterName} invited you to join ${householdName} on WarrantyVault. Sign in with ${email} and accept the invitation here: ${inviteUrl}`;
  const htmlContent = [
    "<!doctype html><html><body>",
    `<p>${safeInviterName} invited you to join <strong>${safeHouseholdName}</strong> on WarrantyVault.</p>`,
    `<p>This invitation is for ${safeEmail}. Sign in with that verified email address to accept it.</p>`,
    `<p><a href="${safeInviteUrl}">Review invitation</a></p>`,
    "<p>If you were not expecting this invitation, you can ignore this email.</p>",
    "</body></html>",
  ].join("");

  return { subject, htmlContent, textContent };
}
