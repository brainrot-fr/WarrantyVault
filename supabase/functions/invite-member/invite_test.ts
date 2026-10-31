import {
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "jsr:@std/assert@1";
import { buildInviteEmail, parseInviteRequest } from "./invite-core.ts";

Deno.test("invite request validates the household ID and normalizes email", () => {
  assertEquals(
    parseInviteRequest({
      household_id: "10000000-0000-4000-8000-000000000001",
      email: "  MEMBER@Example.com ",
    }),
    {
      household_id: "10000000-0000-4000-8000-000000000001",
      email: "member@example.com",
    },
  );
  assertEquals(
    parseInviteRequest({
      household_id: "not-a-uuid",
      email: "member@example.com",
    }),
    null,
  );
  assertEquals(
    parseInviteRequest({
      household_id: "10000000-0000-4000-8000-000000000001",
      email: "not-an-email",
    }),
    null,
  );
});

Deno.test("invite email includes the email-only inbox route and escapes user content", () => {
  const email = buildInviteEmail(
    "person@example.com",
    "<Family & Home>",
    '"Member"',
    "https://warranty.example",
  );

  assertMatch(email.subject, /^You're invited to join/);
  assertStringIncludes(email.htmlContent, "&lt;Family &amp; Home&gt;");
  assertStringIncludes(email.htmlContent, "&quot;Member&quot;");
  assertStringIncludes(email.htmlContent, "https://warranty.example/invites");
  assertStringIncludes(email.textContent, "https://warranty.example/invites");
  assertEquals(email.htmlContent.includes("token"), false);
});

Deno.test("invite email accepts a hostname APP_URL and uses HTTPS", () => {
  const email = buildInviteEmail(
    "person@example.com",
    "Home",
    "Member",
    "warrantyvault1729.vercel.app",
  );
  assertStringIncludes(email.htmlContent, "https://warrantyvault1729.vercel.app/invites");
});

Deno.test("invite email rejects non-web app URLs", () => {
  let rejected = false;
  try {
    buildInviteEmail(
      "person@example.com",
      "Home",
      "Member",
      "javascript:alert(1)",
    );
  } catch {
    rejected = true;
  }
  assertEquals(rejected, true);
});

Deno.test("invite email subject cannot contain header line breaks", () => {
  const email = buildInviteEmail(
    "person@example.com",
    "Home\r\nBcc: other@example.com",
    "Member",
    "https://warranty.example",
  );
  assertEquals(email.subject.includes("\r"), false);
  assertEquals(email.subject.includes("\n"), false);
});
