interface BrevoRecipient {
  email: string;
  name?: string;
}

interface BrevoEmailContent {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent: string;
}

export async function sendBrevoEmail(message: BrevoEmailContent) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured.");
  }

  const senderEmail = Deno.env.get("MAIL_FROM_EMAIL");
  const senderName = Deno.env.get("MAIL_FROM_NAME");
  if (!senderEmail || !senderName) {
    throw new Error("MAIL_FROM_EMAIL and MAIL_FROM_NAME must be configured.");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...message,
      sender: { email: senderEmail, name: senderName },
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    const detail = responseBody.slice(0, 500).replace(/\s+/g, " ").trim();
    console.error("Brevo rejected the transactional email.", {
      status: response.status,
      detail,
    });
    throw new Error(
      `Brevo rejected the transactional email with status ${response.status}.`,
    );
  }
}
