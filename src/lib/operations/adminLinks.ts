const OPS_CANONICAL_ADMIN_BASE_URL = "https://onecompany.global";

type OpsAdminLinkEnvironment = {
  NODE_ENV?: string;
  OPS_ADMIN_BASE_URL?: string;
};

export function resolveOpsAdminBaseUrl(environment: OpsAdminLinkEnvironment = process.env) {
  // Vercel preview deployments also run with NODE_ENV=production. Telegram
  // links must still point at the stable, authenticated company domain.
  if (environment.NODE_ENV === "production") {
    return OPS_CANONICAL_ADMIN_BASE_URL;
  }

  return (
    String(environment.OPS_ADMIN_BASE_URL ?? "")
      .trim()
      .replace(/\/+$/, "") || OPS_CANONICAL_ADMIN_BASE_URL
  );
}

export function opsAdminLink(path: string, environment: OpsAdminLinkEnvironment = process.env) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveOpsAdminBaseUrl(environment)}${normalizedPath}`;
}
