import { OpsError } from "@/lib/operations/errors";

function parseBoolean(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

export function isOperationsUiEnabled(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.NODE_ENV !== "production") {
    return environment.OPS_UI_ENABLED !== "false";
  }
  return parseBoolean(environment.OPS_UI_ENABLED);
}

export function isOpsAutomationsEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return parseBoolean(environment.OPS_AUTOMATIONS_ENABLED);
}

export function assertOperationsEnabled() {
  if (!isOperationsUiEnabled()) {
    throw new OpsError("OPS_DISABLED", 404, "Operations workspace is not enabled");
  }
}

export function assertOpsAutomationsEnabled() {
  if (!isOpsAutomationsEnabled()) {
    throw new OpsError(
      "OPS_AUTOMATIONS_DISABLED",
      409,
      "Operations helpers are disabled until the canary gate is enabled"
    );
  }
}
