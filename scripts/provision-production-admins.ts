import crypto from "node:crypto";

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/hashPassword";

const prisma = new PrismaClient();

const TARGETS = [
  { email: "o.tsompel@onecompany.global", name: "Olexandr Tsompel", roleKey: "owner" },
  {
    email: "olexandr.ign@onecompany.global",
    name: "Olexandr Ignatochkin",
    roleKey: "owner",
  },
  { email: "ivan.pob@onecompany.global", name: "Ivan Poberezhets", roleKey: "owner" },
  { email: "igor@onecompany.global", name: "Igor Semynozhenko", roleKey: "superadmin" },
  { email: "moto@onecompany.global", name: "Denis Gubanov", roleKey: "task_member" },
  {
    email: "k.snegirev@onecompany.global",
    name: "Konstantin Snegirev",
    roleKey: "task_member",
  },
  { email: "sergey@onecompany.global", name: "Sergey Sergey", roleKey: "task_member" },
] as const;

const ACTOR_EMAIL = "sashatsompel@gmail.com";

function temporaryPassword() {
  return `Oc-${crypto.randomBytes(12).toString("base64url")}!7a`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const onlyEmail = process.argv
    .find((argument) => argument.startsWith("--only="))
    ?.slice("--only=".length)
    .trim()
    .toLowerCase();
  const selectedTargets = onlyEmail
    ? TARGETS.filter(({ email }) => email === onlyEmail)
    : [...TARGETS];
  if (!selectedTargets.length) throw new Error(`Unknown --only target: ${onlyEmail}`);
  const emails = selectedTargets.map(({ email }) => email);
  const requiredRoleKeys = Array.from(new Set(selectedTargets.map(({ roleKey }) => roleKey)));
  const [roles, existingUsers, actor] = await Promise.all([
    prisma.adminRole.findMany({
      where: { key: { in: requiredRoleKeys } },
      select: { id: true, key: true },
    }),
    prisma.adminUser.findMany({
      where: { email: { in: emails } },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        roles: { select: { role: { select: { key: true } } } },
      },
    }),
    prisma.adminUser.findUnique({
      where: { email: ACTOR_EMAIL },
      select: { id: true, email: true, name: true, isActive: true },
    }),
  ]);

  if (!actor?.isActive) throw new Error(`Active audit actor ${ACTOR_EMAIL} was not found`);
  const roleByKey = new Map(roles.map((role) => [role.key, role]));
  if (requiredRoleKeys.some((roleKey) => !roleByKey.has(roleKey))) {
    throw new Error("One or more required roles are missing");
  }

  const existingByEmail = new Map(existingUsers.map((user) => [user.email, user]));
  const plan = selectedTargets.map((target) => {
    const existing = existingByEmail.get(target.email);
    return {
      ...target,
      action: existing ? "update" : "create",
      currentRoles: existing?.roles.map(({ role }) => role.key).sort() ?? [],
      currentActive: existing?.isActive ?? null,
    };
  });

  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", actor: ACTOR_EMAIL, plan }, null, 2));
    return;
  }

  const newPasswords = new Map(
    plan
      .filter(({ action }) => action === "create")
      .map(({ email }) => [email, temporaryPassword()])
  );

  await prisma.$transaction(async (tx) => {
    for (const target of selectedTargets) {
      const role = roleByKey.get(target.roleKey)!;
      const existing = existingByEmail.get(target.email);
      const password = newPasswords.get(target.email);
      const user = existing
        ? await tx.adminUser.update({
            where: { id: existing.id },
            data: {
              name: target.name,
              isActive: true,
              roles: {
                deleteMany: {},
                create: { role: { connect: { id: role.id } } },
              },
            },
            select: { id: true },
          })
        : await tx.adminUser.create({
            data: {
              email: target.email,
              name: target.name,
              isActive: true,
              passwordHash: hashPassword(password!),
              roles: { create: { role: { connect: { id: role.id } } } },
            },
            select: { id: true },
          });

      await tx.adminAuditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          actorName: actor.name,
          scope: "admin",
          action: existing ? "admin.user.access_update" : "admin.user.create",
          entityType: "admin.user",
          entityId: user.id,
          metadata: {
            source: "production_access_provisioning",
            email: target.email,
            roleKey: target.roleKey,
            previousRoles: existing?.roles.map(({ role: previousRole }) => previousRole.key) ?? [],
            activated: existing ? !existing.isActive : true,
            temporaryPasswordIssued: Boolean(password),
          },
        },
      });
    }
  });

  console.log(
    JSON.stringify(
      {
        mode: "applied",
        users: selectedTargets.map((target) => ({
          email: target.email,
          name: target.name,
          roleKey: target.roleKey,
          created: newPasswords.has(target.email),
          temporaryPassword: newPasswords.get(target.email) ?? null,
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Admin provisioning failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
