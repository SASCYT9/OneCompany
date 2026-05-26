const { execSync } = require("child_process");
const value =
  "prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19GUk9IZnFicjVpV25WaFFPM3hzcDQiLCJhcGlfa2V5IjoiMDFLU0pLMDA4WEowMVdKVkoxVEhRVlIzUzQiLCJ0ZW5hbnRfaWQiOiJlZTNiNzVhNjg3N2JiMDM2ODUwNThlOTJkM2QxZWU4N2RjYjI0NWJjMmQ5ZTdkZWIyMWI2NGU5OGVmOTk2ODA1IiwiaW50ZXJuYWxfc2VjcmV0IjoiZDM5ZDI3M2UtMTJjMi00M2EwLWIxZDItZjE4YTZiMWM3MTc0In0.s1NcZG8CY1LWLFBzfaB64pqwV3AbEnhUDjlZK1ozWvs";

try {
  console.log("Setting Vercel DATABASE_URL environment variable...");
  const output = execSync(
    `npx vercel env add DATABASE_URL production --value "${value}" --yes --force`,
    { stdio: "pipe" }
  );
  console.log("Success:", output.toString().trim());

  console.log("Triggering Vercel production redeploy to apply changes...");
  // Use '--yes' to skip any confirmation prompts
  const deployOutput = execSync(`npx vercel --prod --yes`, { stdio: "pipe" });
  console.log("Redeploy complete!");
  console.log("Deployment Details:", deployOutput.toString().trim());
} catch (err) {
  console.error("Operation failed:", err.stderr ? err.stderr.toString() : err.message);
}
