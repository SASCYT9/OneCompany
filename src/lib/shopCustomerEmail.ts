/**
 * Customer email helpers shared by the admin UI and its API routes.
 *
 * The email is the storefront login. Contacts imported from the old Airtable
 * CRM without an address got a fake `…@crm.onecompany.local` one; nobody can
 * sign in or receive mail with it, so it is treated as "no email yet".
 */

export const CRM_PLACEHOLDER_EMAIL_DOMAIN = "@crm.onecompany.local";

export function normalizeShopCustomerEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isPlaceholderShopCustomerEmail(email: string | null | undefined) {
  return normalizeShopCustomerEmail(email).endsWith(CRM_PLACEHOLDER_EMAIL_DOMAIN);
}

/** A real, deliverable-looking address (placeholders are rejected). */
export function isUsableShopCustomerEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !isPlaceholderShopCustomerEmail(email);
}
