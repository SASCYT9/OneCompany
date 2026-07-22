export function isOpsLocalDemoMode(
  env: { NODE_ENV?: string; OPS_LOCAL_DEMO_MODE?: string } = process.env
) {
  return env.NODE_ENV !== "production" && env.OPS_LOCAL_DEMO_MODE === "true";
}
