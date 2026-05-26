const { PrismaClient } = require("@prisma/client");
const { withAccelerate } = require("@prisma/extension-accelerate");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19GUk9IZnFicjVpV25WaFFPM3hzcDQiLCJhcGlfa2V5IjoiMDFLU0pLMDA4WEowMVdKVkoxVEhRVlIzUzQiLCJ0ZW5hbnRfaWQiOiJlZTNiNzVhNjg3N2JiMDM2ODUwNThlOTJkM2QxZWU4N2RjYjI0NWJjMmQ5ZTdkZWIyMWI2NGU5OGVmOTk2ODA1IiwiaW50ZXJuYWxfc2VjcmV0IjoiZDM5ZDI3M2UtMTJjMi00M2EwLWIxZDItZjE4YTZiMWM3MTc0In0.s1NcZG8CY1LWLFBzfaB64pqwV3AbEnhUDjlZK1ozWvs",
    },
  },
}).$extends(withAccelerate());

async function fix() {
  try {
    const res = await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE pid <> pg_backend_pid()
        AND usename = current_user;
    `);
    console.log("Killed all backend sessions for current user via Accelerate!", res);
  } catch (e) {
    console.log("Error terminating", e.message);
  }
}
fix();
