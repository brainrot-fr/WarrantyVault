import { createServiceClient } from "../_shared/auth.ts";
import { sendBrevoEmail } from "../_shared/brevo.ts";
import {
  buildReminderEmail,
  getReminderExpiryDates,
  getTodayInTimezone,
  groupReminderDigests,
  limitReminderDigests,
  matchesCronSecret,
  parseEmailLimit,
  type ReminderDigest,
  type ReminderItem,
  type ReminderMember,
  selectReminderTargets,
} from "./reminder-core.ts";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const pageSize = 1000;
const householdBatchSize = 100;
const emailConcurrency = 10;

interface ReminderCounts {
  sent_emails: number;
  failed_emails: number;
  deduplicated_emails: number;
  sent_items: number;
  rolled_back_items: number;
  cleanup_failures: number;
  log_timestamp_failures: number;
}

interface DigestResult {
  sent_emails: number;
  failed_emails: number;
  deduplicated_emails: number;
  sent_items: number;
  rolled_back_items: number;
  cleanup_failures: number;
  log_timestamp_failures: number;
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: jsonHeaders });
}

function getRequiredEnvironment(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function validateAppUrl(value: string) {
  const url = new URL(value);
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

async function loadDueItems(
  client: ReturnType<typeof createServiceClient>,
  expiryDates: string[],
) {
  const items: ReminderItem[] = [];
  for (let offset = 0;; offset += pageSize) {
    const { data, error } = await client
      .from("items")
      .select("id, household_id, name, expiry_date")
      .in("expiry_date", expiryDates)
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const item of data) {
      if (item.expiry_date !== null) {
        items.push({ ...item, expiry_date: item.expiry_date });
      }
    }
    if (data.length < pageSize) return items;
  }
}

async function loadHouseholdMembers(
  client: ReturnType<typeof createServiceClient>,
  householdIds: string[],
) {
  const members: ReminderMember[] = [];
  for (
    let start = 0;
    start < householdIds.length;
    start += householdBatchSize
  ) {
    const householdBatch = householdIds.slice(
      start,
      start + householdBatchSize,
    );
    for (let offset = 0;; offset += pageSize) {
      const { data, error } = await client
        .from("household_members")
        .select(
          "household_id, user_id, profiles!inner(email, display_name, email_reminders)",
        )
        .in("household_id", householdBatch)
        .order("household_id")
        .order("user_id")
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      members.push(...data);
      if (data.length < pageSize) break;
    }
  }
  return members;
}

async function sendDigest(
  client: ReturnType<typeof createServiceClient>,
  digest: ReminderDigest,
  appUrl: string,
  reminderDate: string,
): Promise<DigestResult> {
  let claimedRows: Array<{ id: string; item_id: string }>;
  try {
    const { data, error } = await client
      .from("reminder_log")
      .upsert(
        digest.items.map((item) => ({
          item_id: item.item_id,
          user_id: digest.user_id,
          reminder_date: reminderDate,
          days_before: item.days_before,
        })),
        {
          onConflict: "item_id,user_id,reminder_date",
          ignoreDuplicates: true,
        },
      )
      .select("id, item_id");
    if (error) throw error;
    claimedRows = data ?? [];
  } catch (error) {
    console.error("Could not claim reminder log rows for a digest.", error);
    return {
      sent_emails: 0,
      failed_emails: 1,
      deduplicated_emails: 0,
      sent_items: 0,
      rolled_back_items: 0,
      cleanup_failures: 0,
      log_timestamp_failures: 0,
    };
  }

  const claimed = claimedRows;
  if (claimed.length === 0) {
    return {
      sent_emails: 0,
      failed_emails: 0,
      deduplicated_emails: 1,
      sent_items: 0,
      rolled_back_items: 0,
      cleanup_failures: 0,
      log_timestamp_failures: 0,
    };
  }

  const claimedIds = claimed.map((row) => row.id);
  const claimedItemIds = new Set(claimed.map((row) => row.item_id));
  const digestItems = digest.items.filter((item) =>
    claimedItemIds.has(item.item_id)
  );

  try {
    await sendBrevoEmail({
      ...buildReminderEmail({ ...digest, items: digestItems }, appUrl),
      to: [{
        email: digest.email,
        ...(digest.display_name ? { name: digest.display_name } : {}),
      }],
    });
  } catch (error) {
    console.error(
      `Could not send warranty reminder digest to ${digest.email}.`,
      error,
    );
    let cleanupError: unknown = null;
    try {
      const { error } = await client
        .from("reminder_log")
        .delete()
        .in("id", claimedIds);
      cleanupError = error;
    } catch (error) {
      cleanupError = error;
    }
    if (cleanupError) {
      console.error(
        "Could not release reminder log rows after a failed email.",
        cleanupError,
      );
    }
    return {
      sent_emails: 0,
      failed_emails: 1,
      deduplicated_emails: 0,
      sent_items: 0,
      rolled_back_items: cleanupError ? 0 : claimed.length,
      cleanup_failures: cleanupError ? 1 : 0,
      log_timestamp_failures: 0,
    };
  }

  let timestampError: unknown = null;
  try {
    const { error } = await client
      .from("reminder_log")
      .update({ sent_at: new Date().toISOString() })
      .in("id", claimedIds);
    timestampError = error;
  } catch (error) {
    timestampError = error;
  }
  if (timestampError) {
    console.error(
      "The digest was sent, but its log timestamp could not be updated.",
      timestampError,
    );
  }
  return {
    sent_emails: 1,
    failed_emails: 0,
    deduplicated_emails: 0,
    sent_items: claimed.length,
    rolled_back_items: 0,
    cleanup_failures: 0,
    log_timestamp_failures: timestampError ? 1 : 0,
  };
}

function addCounts(target: ReminderCounts, result: DigestResult) {
  for (const key of Object.keys(target) as Array<keyof ReminderCounts>) {
    target[key] += result[key];
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST to run warranty reminders." }, 405);
  }

  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret) {
    console.error("CRON_SECRET is not configured.");
    return jsonResponse({ error: "Reminder service is not configured." }, 500);
  }
  if (
    !matchesCronSecret(request.headers.get("x-cron-secret"), expectedSecret)
  ) {
    return jsonResponse({ error: "The cron secret is invalid." }, 401);
  }

  try {
    const timeZone = getRequiredEnvironment("APP_TIMEZONE");
    const appUrl = validateAppUrl(getRequiredEnvironment("APP_URL"));
    const emailLimit = parseEmailLimit(Deno.env.get("MAX_EMAILS_PER_RUN"));
    const today = getTodayInTimezone(timeZone);
    const expiryDates = getReminderExpiryDates(today);
    const client = createServiceClient();
    const items = await loadDueItems(client, Object.values(expiryDates));
    const householdIds = [...new Set(items.map((item) => item.household_id))];
    const members = householdIds.length
      ? await loadHouseholdMembers(client, householdIds)
      : [];
    const targets = selectReminderTargets(items, members, today);
    const digests = groupReminderDigests(targets);
    const { selected: selectedDigests, skipped } = limitReminderDigests(
      digests,
      emailLimit,
    );
    const counts: ReminderCounts = {
      sent_emails: 0,
      failed_emails: 0,
      deduplicated_emails: 0,
      sent_items: 0,
      rolled_back_items: 0,
      cleanup_failures: 0,
      log_timestamp_failures: 0,
    };

    for (
      let start = 0;
      start < selectedDigests.length;
      start += emailConcurrency
    ) {
      const batch = selectedDigests.slice(start, start + emailConcurrency);
      const results = await Promise.all(
        batch.map((digest) => sendDigest(client, digest, appUrl, today)),
      );
      for (const result of results) addCounts(counts, result);
    }

    return jsonResponse({
      ok: true,
      today,
      eligible_emails: digests.length,
      skipped_emails: skipped,
      ...counts,
    }, 200);
  } catch (error) {
    console.error("Could not run warranty reminders.", error);
    return jsonResponse({
      error: error instanceof Error
        ? error.message
        : "Could not run warranty reminders.",
    }, 500);
  }
});
