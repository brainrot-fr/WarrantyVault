export type ReminderOffset = 7 | 30;

export interface ReminderItem {
  id: string;
  household_id: string;
  name: string;
  expiry_date: string;
}

export interface ReminderMember {
  household_id: string;
  user_id: string;
  profiles: {
    display_name: string | null;
    email: string | null;
    email_reminders: boolean;
  } | null;
}

export interface ReminderTarget {
  user_id: string;
  email: string;
  display_name: string | null;
  item_id: string;
  name: string;
  expiry_date: string;
  days_before: ReminderOffset;
}

export interface ReminderDigest {
  user_id: string;
  email: string;
  display_name: string | null;
  items: ReminderTarget[];
}

export interface ReminderEmail {
  subject: string;
  htmlContent: string;
  textContent: string;
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Expected a date in YYYY-MM-DD format.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Expected a valid date in YYYY-MM-DD format.");
  }
  return date;
}

export function getReminderExpiryDates(
  today: string,
): Record<ReminderOffset, string> {
  const dates = {} as Record<ReminderOffset, string>;
  for (const daysBefore of [30, 7] as const) {
    const expiry = parseDateOnly(today);
    expiry.setUTCDate(expiry.getUTCDate() + daysBefore);
    dates[daysBefore] = expiry.toISOString().slice(0, 10);
  }
  return dates;
}

export function getTodayInTimezone(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");
  if (!year || !month || !day) {
    throw new Error("Could not determine today in APP_TIMEZONE.");
  }
  return `${year}-${month}-${day}`;
}

export function selectReminderTargets(
  items: ReminderItem[],
  members: ReminderMember[],
  today: string,
) {
  const expiryDates = getReminderExpiryDates(today);
  const expiryOffsets = new Map<string, ReminderOffset>([
    [expiryDates[30], 30],
    [expiryDates[7], 7],
  ]);
  const membersByHousehold = new Map<string, ReminderMember[]>();
  for (const member of members) {
    const householdMembers = membersByHousehold.get(member.household_id) ?? [];
    householdMembers.push(member);
    membersByHousehold.set(member.household_id, householdMembers);
  }

  const targets: ReminderTarget[] = [];
  for (const item of items) {
    const daysBefore = expiryOffsets.get(item.expiry_date);
    if (!daysBefore) continue;
    for (const member of membersByHousehold.get(item.household_id) ?? []) {
      const profile = member.profiles;
      const email = profile?.email?.trim();
      if (!profile?.email_reminders || !email) continue;
      targets.push({
        user_id: member.user_id,
        email,
        display_name: profile.display_name,
        item_id: item.id,
        name: item.name,
        expiry_date: item.expiry_date,
        days_before: daysBefore,
      });
    }
  }
  return targets.sort((left, right) =>
    left.user_id.localeCompare(right.user_id) ||
    left.days_before - right.days_before ||
    left.item_id.localeCompare(right.item_id)
  );
}

export function groupReminderDigests(
  targets: ReminderTarget[],
): ReminderDigest[] {
  const grouped = new Map<string, ReminderDigest>();
  for (const target of targets) {
    let digest = grouped.get(target.user_id);
    if (!digest) {
      digest = {
        user_id: target.user_id,
        email: target.email,
        display_name: target.display_name,
        items: [],
      };
      grouped.set(target.user_id, digest);
    }
    digest.items.push(target);
  }
  return [...grouped.values()].sort((left, right) =>
    left.user_id.localeCompare(right.user_id)
  );
}

export function limitReminderDigests(
  digests: ReminderDigest[],
  maxEmails: number,
) {
  const selected = digests.slice(0, maxEmails);
  return {
    selected,
    skipped: digests.length - selected.length,
  };
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

function getAppOrigin(appUrl: string) {
  const url = new URL(appUrl);
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "APP_URL must be an HTTP or HTTPS origin without credentials or a path.",
    );
  }
  return url.origin;
}

export function buildReminderEmail(
  digest: ReminderDigest,
  appUrl: string,
): ReminderEmail {
  const origin = getAppOrigin(appUrl);
  const count = digest.items.length;
  const subject = count === 1
    ? "1 warranty expiring soon"
    : `${count} warranties expiring soon`;
  const htmlItems = digest.items.map((item) => {
    const link = new URL(`/items/${encodeURIComponent(item.item_id)}`, origin)
      .toString();
    return `<li><a href="${escapeHtml(link)}">${
      escapeHtml(item.name)
    }</a> — expires ${
      escapeHtml(item.expiry_date)
    }, ${item.days_before} days left</li>`;
  });
  const textItems = digest.items.map((item) => {
    const link = new URL(`/items/${encodeURIComponent(item.item_id)}`, origin)
      .toString();
    return `${item.name} — expires ${item.expiry_date}, ${item.days_before} days left: ${link}`;
  });
  const settingsUrl = new URL("/settings", origin).toString();
  return {
    subject,
    htmlContent: [
      "<!doctype html><html><body>",
      "<p>These household warranties are coming up:</p>",
      `<ul>${htmlItems.join("")}</ul>`,
      `<p><a href="${
        escapeHtml(settingsUrl)
      }">Manage email reminders in Settings</a></p>`,
      "</body></html>",
    ].join(""),
    textContent: [
      "These household warranties are coming up:",
      ...textItems,
      `Manage email reminders in Settings: ${settingsUrl}`,
    ].join("\n"),
  };
}

export function matchesCronSecret(supplied: string | null, expected: string) {
  if (!supplied) return false;
  const encoder = new TextEncoder();
  const suppliedBytes = encoder.encode(supplied);
  const expectedBytes = encoder.encode(expected);
  if (suppliedBytes.length !== expectedBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= suppliedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

export function parseEmailLimit(value: string | undefined) {
  if (value === undefined || value.trim() === "") return 250;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("MAX_EMAILS_PER_RUN must be a positive whole number.");
  }
  return limit;
}
