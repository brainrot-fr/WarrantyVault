import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  buildReminderEmail,
  getReminderExpiryDates,
  getTodayInTimezone,
  groupReminderDigests,
  limitReminderDigests,
  matchesCronSecret,
  parseEmailLimit,
  type ReminderItem,
  type ReminderMember,
  selectReminderTargets,
} from "./reminder-core.ts";

Deno.test("reminder dates use calendar-day offsets and the configured timezone", () => {
  assertEquals(getReminderExpiryDates("2026-05-01"), {
    7: "2026-05-08",
    30: "2026-05-31",
  });
  const instant = new Date("2026-03-08T01:00:00.000Z");
  assertEquals(getTodayInTimezone("UTC", instant), "2026-03-08");
  assertEquals(
    getTodayInTimezone("America/Los_Angeles", instant),
    "2026-03-07",
  );
});

Deno.test("selection includes only exact 7/30-day items and eligible household emails", () => {
  const items: ReminderItem[] = [
    {
      id: "due-30",
      household_id: "home",
      name: "Toaster",
      expiry_date: "2026-05-31",
    },
    {
      id: "due-7",
      household_id: "home",
      name: "Kettle",
      expiry_date: "2026-05-08",
    },
    {
      id: "not-due",
      household_id: "home",
      name: "Lamp",
      expiry_date: "2026-05-30",
    },
    {
      id: "other-home",
      household_id: "other",
      name: "Radio",
      expiry_date: "2026-05-08",
    },
  ];
  const members: ReminderMember[] = [
    {
      household_id: "home",
      user_id: "user-1",
      profiles: {
        email: "one@example.com",
        display_name: "One",
        email_reminders: true,
      },
    },
    {
      household_id: "home",
      user_id: "user-2",
      profiles: {
        email: "two@example.com",
        display_name: null,
        email_reminders: false,
      },
    },
    {
      household_id: "home",
      user_id: "user-3",
      profiles: { email: null, display_name: null, email_reminders: true },
    },
    {
      household_id: "other",
      user_id: "user-4",
      profiles: {
        email: "four@example.com",
        display_name: null,
        email_reminders: true,
      },
    },
  ];

  const targets = selectReminderTargets(items, members, "2026-05-01");
  assertEquals(
    targets.map(({ user_id, item_id, days_before }) => [
      user_id,
      item_id,
      days_before,
    ]),
    [
      ["user-1", "due-7", 7],
      ["user-1", "due-30", 30],
      ["user-4", "other-home", 7],
    ],
  );
});

Deno.test("digest grouping produces one recipient entry with all due items", () => {
  const targets = selectReminderTargets(
    [
      {
        id: "a",
        household_id: "home",
        name: "Toaster",
        expiry_date: "2026-05-31",
      },
      {
        id: "b",
        household_id: "home",
        name: "Kettle",
        expiry_date: "2026-05-08",
      },
    ],
    [{
      household_id: "home",
      user_id: "user-1",
      profiles: {
        email: "one@example.com",
        display_name: "One",
        email_reminders: true,
      },
    }],
    "2026-05-01",
  );
  const digests = groupReminderDigests(targets);
  assertEquals(digests.length, 1);
  assertEquals(digests[0].items.length, 2);
  assertEquals(limitReminderDigests(digests, 1), {
    selected: digests,
    skipped: 0,
  });
  assertEquals(limitReminderDigests([...digests, ...digests], 1).skipped, 1);
});

Deno.test("digest content links each item, shows expiry and days left, and escapes HTML", () => {
  const [digest] = groupReminderDigests(selectReminderTargets(
    [{
      id: "item-id",
      household_id: "home",
      name: "<Coffee & tea>",
      expiry_date: "2026-05-08",
    }],
    [{
      household_id: "home",
      user_id: "user-1",
      profiles: {
        email: "one@example.com",
        display_name: null,
        email_reminders: true,
      },
    }],
    "2026-05-01",
  ));
  const email = buildReminderEmail(digest, "https://warranty.example");
  assertEquals(email.subject, "1 warranty expiring soon");
  assertStringIncludes(email.htmlContent, "&lt;Coffee &amp; tea&gt;");
  assertStringIncludes(
    email.htmlContent,
    "https://warranty.example/items/item-id",
  );
  assertStringIncludes(email.htmlContent, "2026-05-08, 7 days left");
  assertStringIncludes(email.htmlContent, "https://warranty.example/settings");
});

Deno.test("cron-secret comparison and email limits reject invalid values", () => {
  assertEquals(matchesCronSecret("same-secret", "same-secret"), true);
  assertEquals(matchesCronSecret("same-secrex", "same-secret"), false);
  assertEquals(matchesCronSecret(null, "same-secret"), false);
  assertEquals(parseEmailLimit(undefined), 250);
  assertEquals(parseEmailLimit("17"), 17);
  let rejected = false;
  try {
    parseEmailLimit("0");
  } catch {
    rejected = true;
  }
  assertEquals(rejected, true);
});
