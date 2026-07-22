import { createHash, createHmac } from "node:crypto";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_PATTERN = /(?<!\w)(?:\+?\d[\s().-]*){9,15}(?!\w)/g;
const VIN_PATTERN = /(?<![A-Z0-9])(?:[A-HJ-NPR-Z0-9][ -]*){16}[A-HJ-NPR-Z0-9](?![A-Z0-9])/giu;
const MIN_OWNER_HMAC_SECRET_BYTES = 32;
const DEVELOPMENT_OWNER_HMAC_SECRET = "development-one-ai-owner-hmac-secret-32-bytes";

export type ShopAiOwnerHmacEnvironment = Partial<
  Record<
    "SHOP_AI_OWNER_HMAC_SECRET" | "NEXTAUTH_SECRET" | "ADMIN_SESSION_SECRET" | "NODE_ENV",
    string
  >
>;

export type ShopAiRedactionResult = {
  text: string;
  redacted: Array<"email" | "phone" | "vin">;
};

export function redactShopAiText(value: string, maxLength = 800): ShopAiRedactionResult {
  const redacted = new Set<ShopAiRedactionResult["redacted"][number]>();
  const text = String(value ?? "")
    .replace(EMAIL_PATTERN, () => {
      redacted.add("email");
      return "[email]";
    })
    .replace(VIN_PATTERN, () => {
      redacted.add("vin");
      return "[vin]";
    })
    .replace(PHONE_PATTERN, () => {
      redacted.add("phone");
      return "[phone]";
    })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return { text, redacted: Array.from(redacted).sort() };
}

export function redactShopAiContextValue(value: unknown, maxLength: number) {
  const withoutMarkup = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return redactShopAiText(withoutMarkup, maxLength).text;
}

export function buildShopAiQuerySignature(value: string) {
  const normalized = redactShopAiText(value)
    .text.toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return createHash("sha256").update(normalized).digest("hex");
}

export function resolveShopAiOwnerHmacSecret(
  environment: ShopAiOwnerHmacEnvironment = process.env
) {
  for (const candidate of [
    environment.SHOP_AI_OWNER_HMAC_SECRET,
    environment.NEXTAUTH_SECRET,
    environment.ADMIN_SESSION_SECRET,
  ]) {
    const secret = candidate?.trim() ?? "";
    if (Buffer.byteLength(secret, "utf8") >= MIN_OWNER_HMAC_SECRET_BYTES) {
      return secret;
    }
  }

  if (environment.NODE_ENV === "production") {
    throw new Error(
      "SHOP_AI_OWNER_HMAC_SECRET or another stable 32-byte server secret is required in production"
    );
  }

  return DEVELOPMENT_OWNER_HMAC_SECRET;
}

/**
 * Builds the private, stable key used for conversation ownership and rate limits.
 *
 * Identity values must not pass through the query PII redactor: an IPv4 address
 * resembles a phone number to the deliberately broad phone detector and would
 * otherwise collapse unrelated guests onto the same key.
 */
export function buildShopAiOwnerSignature(
  input: { customerId?: string | null; ip: string },
  secret = resolveShopAiOwnerHmacSecret()
) {
  const customerId = input.customerId?.trim() || null;
  const ip = input.ip.trim().toLocaleLowerCase("en-US") || "unknown";
  const identity = customerId
    ? { version: 2, kind: "customer", customerId, ip }
    : { version: 2, kind: "guest", ip };

  return createHmac("sha256", secret)
    .update("one-ai-owner:v2\0", "utf8")
    .update(JSON.stringify(identity), "utf8")
    .digest("hex");
}
