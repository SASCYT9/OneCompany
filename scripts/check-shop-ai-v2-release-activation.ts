import {
  evaluateShopAiV2ReleaseActivationGuard,
  readShopAiV2ReleaseActivationGuardInput,
} from "../src/lib/shopAiV2ReleaseActivationGuard";

const result = evaluateShopAiV2ReleaseActivationGuard(
  readShopAiV2ReleaseActivationGuardInput(process.env)
);

if (!result.guardRequired) {
  console.log(
    `One AI V2 release guard: not required (${result.production ? "production flags are inactive" : "non-production deployment"}).`
  );
} else if (result.ok) {
  console.log(
    `One AI V2 release guard: verified gate marker for commit ${result.deployedCommitSha}, catalog ${result.markerCatalogFingerprint}, expires ${result.markerPayload?.expiresAt}.`
  );
} else {
  console.error("ONE AI V2 RELEASE GUARD FAILED");
  for (const failure of result.failures) {
    console.error(`  - [${failure.code}] ${failure.message}`);
  }
  process.exitCode = 1;
}
