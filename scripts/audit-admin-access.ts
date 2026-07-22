import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [users, roles] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        lastLoginAt: true,
        roles: {
          select: {
            role: {
              select: {
                key: true,
                name: true,
                permissions: true,
              },
            },
          },
        },
        opsProfile: {
          select: {
            telegramUserId: true,
            telegramEnabled: true,
          },
        },
      },
    }),
    prisma.adminRole.findMany({
      orderBy: { key: "asc" },
      select: {
        key: true,
        name: true,
        permissions: true,
        _count: { select: { users: true } },
      },
    }),
  ]);

  console.log(
    JSON.stringify(
      { users, roles },
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Admin access audit failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
