export interface UploadParameters {
  [key: string]: string;
  allowed_formats: string;
  asset_folder: string;
  folder: string;
  overwrite: string;
  public_id: string;
  public_id_prefix: string;
  timestamp: string;
  type: string;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

export function parseHouseholdId(value: unknown): string | null {
  if (typeof value !== "string" || !isUuid(value)) return null;
  return value;
}

export function buildUploadParameters(
  householdId: string,
  publicId: string,
  timestamp: number,
): UploadParameters {
  const folder = `warrantyvault/${householdId}`;
  return {
    allowed_formats: "jpg,png,pdf",
    asset_folder: folder,
    folder,
    overwrite: "false",
    public_id: publicId,
    public_id_prefix: folder,
    timestamp: String(timestamp),
    type: "authenticated",
  };
}

export function getHouseholdIdFromPublicId(publicId: unknown): string | null {
  if (typeof publicId !== "string") return null;
  const match =
    /^warrantyvault\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .exec(publicId);
  return match?.[1] ?? null;
}

export async function createCloudinarySignature(
  parameters: Record<string, string>,
  apiSecret: string,
) {
  const base = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${parameters[key]}`)
    .join("&");
  const bytes = new TextEncoder().encode(`${base}${apiSecret}`);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  )
    .join("");
}

export async function createPrivateDownloadUrl(options: {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
  expiresAt: number;
  format: string;
  publicId: string;
  resourceType: string;
  timestamp: number;
}) {
  const parameters = {
    expires_at: String(options.expiresAt),
    format: options.format,
    public_id: options.publicId,
    timestamp: String(options.timestamp),
    type: "authenticated",
  };
  const signature = await createCloudinarySignature(
    parameters,
    options.apiSecret,
  );
  const url = new URL(
    `https://api.cloudinary.com/v1_1/${
      encodeURIComponent(options.cloudName)
    }/${options.resourceType}/download`,
  );
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("signature", signature);
  url.searchParams.set("api_key", options.apiKey);
  return url.toString();
}
