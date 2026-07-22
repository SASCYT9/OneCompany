import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../../src/lib/hashPassword";

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function required(key: string) {
  const value = String(process.env[key] ?? "").trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function assertLocalDatabaseUrl(value: string) {
  const url = new URL(value);
  const databaseName = url.pathname.replace(/^\/+/, "");
  if (
    !LOCAL_DATABASE_HOSTS.has(url.hostname) ||
    url.port !== "56432" ||
    databaseName !== "onecompany_ops_lab"
  ) {
    throw new Error(
      "Local Lab seed refused: DATABASE_URL must target onecompany_ops_lab on 127.0.0.1:56432"
    );
  }
}

async function main() {
  const databaseUrl = required("DATABASE_URL");
  assertLocalDatabaseUrl(databaseUrl);

  const email = required("ADMIN_EMAIL").toLowerCase();
  const name = String(process.env.ADMIN_NAME ?? "Local Lab Owner").trim() || "Local Lab Owner";
  const password = required("OPS_LOCAL_ADMIN_PASSWORD");
  if (password.length < 14) {
    throw new Error("OPS_LOCAL_ADMIN_PASSWORD must contain at least 14 characters");
  }

  const telegramUserId = BigInt(required("OPS_LOCAL_TELEGRAM_USER_ID"));
  if (telegramUserId <= 0n) {
    throw new Error("OPS_LOCAL_TELEGRAM_USER_ID must be a positive integer");
  }

  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const role = await tx.adminRole.upsert({
        where: { key: "owner" },
        create: {
          key: "owner",
          name: "Owner",
          permissions: ["*"],
        },
        update: {
          name: "Owner",
          permissions: ["*"],
        },
      });

      const user = await tx.adminUser.upsert({
        where: { email },
        create: {
          email,
          name,
          isActive: true,
          passwordHash: hashPassword(password),
        },
        update: {
          name,
          isActive: true,
          passwordHash: hashPassword(password),
        },
      });

      await tx.adminUserRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id,
          },
        },
        create: {
          userId: user.id,
          roleId: role.id,
        },
        update: {},
      });

      await tx.opsMemberProfile.upsert({
        where: { adminUserId: user.id },
        create: {
          adminUserId: user.id,
          telegramUserId,
          telegramEnabled: true,
          timezone: "Europe/Kyiv",
        },
        update: {
          telegramUserId,
          telegramEnabled: true,
          timezone: "Europe/Kyiv",
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          actorName: user.name,
          scope: "local_lab",
          action: "local_lab.owner.seeded",
          entityType: "admin_user",
          entityId: user.id,
          metadata: {
            telegramLinked: true,
            productionDataTouched: false,
          },
        },
      });

      return {
        userId: user.id,
        email: user.email,
        role: role.key,
      };
    });

    console.log(
      JSON.stringify(
        {
          seeded: true,
          ...result,
          telegramLinked: true,
          database: "local onecompany_ops_lab",
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown Local Lab seed error";
  console.error(`Local Lab seed failed: ${message}`);
  process.exitCode = 1;
});
