import { assertEquals } from "jsr:@std/assert@1";
import {
  buildUploadParameters,
  createCloudinarySignature,
  createPrivateDownloadUrl,
  getHouseholdIdFromPublicId,
  isUuid,
  parseHouseholdId,
} from "../_shared/cloudinary.ts";

Deno.test("upload parameters lock the asset to an authenticated household folder", () => {
  const householdId = "a0000000-0000-4000-8000-000000000001";
  const parameters = buildUploadParameters(
    householdId,
    "b0000000-0000-4000-8000-000000000002",
    1_800_000_000,
  );
  assertEquals(parameters.folder, `warrantyvault/${householdId}`);
  assertEquals(parameters.asset_folder, parameters.folder);
  assertEquals(parameters.public_id_prefix, parameters.folder);
  assertEquals(parameters.type, "authenticated");
  assertEquals(parameters.allowed_formats, "jpg,png,pdf");
  assertEquals(parameters.overwrite, "false");
});

Deno.test("signature sorts parameters and appends the Cloudinary secret", async () => {
  const signature = await createCloudinarySignature(
    { timestamp: "1234567890", public_id: "receipt-1" },
    "secret",
  );
  assertEquals(signature, "7fb05eae478d6205917b2a4f1e0ae7656c476d10");
});

Deno.test("household IDs and receipt public IDs are strictly checked", () => {
  const householdId = "a0000000-0000-4000-8000-000000000001";
  const publicId =
    `warrantyvault/${householdId}/b0000000-0000-4000-8000-000000000002`;
  assertEquals(isUuid(householdId), true);
  assertEquals(parseHouseholdId(householdId), householdId);
  assertEquals(getHouseholdIdFromPublicId(publicId), householdId);
  assertEquals(parseHouseholdId("../other"), null);
  assertEquals(
    getHouseholdIdFromPublicId(`warrantyvault/${householdId}/../asset`),
    null,
  );
});

Deno.test("temporary download URLs carry a signed authenticated request", async () => {
  const url = new URL(
    await createPrivateDownloadUrl({
      apiKey: "test-key",
      apiSecret: "test-secret",
      cloudName: "test-cloud",
      expiresAt: 1_800_000_600,
      format: "pdf",
      publicId: "warrantyvault/household/receipt",
      resourceType: "image",
      timestamp: 1_800_000_000,
    }),
  );
  assertEquals(url.pathname, "/v1_1/test-cloud/image/download");
  assertEquals(url.searchParams.get("type"), "authenticated");
  assertEquals(url.searchParams.get("expires_at"), "1800000600");
  assertEquals(
    url.searchParams.get("public_id"),
    "warrantyvault/household/receipt",
  );
  assertEquals(url.searchParams.get("api_key"), "test-key");
  assertEquals(
    url.searchParams.get("signature"),
    "27119fa7b3ccc5f9316e54d323612af04fc5fcaa",
  );
});
