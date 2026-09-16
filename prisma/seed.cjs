const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function upsertUser({ name, email, password, roleId }) {
  if (!email || !password || password.startsWith('change_me_')) {
    throw new Error(
      'Define credenciales de desarrollo válidas en las variables SEED_*',
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return prisma.user.update({
      where: { email },
      data: { name, roleId, isActive: true },
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: { name, email, passwordHash, roleId, isActive: true },
  });
}

async function main() {
  const roles = {};
  for (const name of [
    'CLIENT',
    'DEVELOPER',
    'PRODUCT_OWNER',
    'ADMIN',
    'SUPER_ADMIN',
  ]) {
    roles[name] = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await upsertUser({
    name: 'Administrador TISNET',
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    roleId: roles.SUPER_ADMIN.id,
  });

  await upsertUser({
    name: 'Developer TISNET',
    email: process.env.SEED_DEVELOPER_EMAIL,
    password: process.env.SEED_DEVELOPER_PASSWORD,
    roleId: roles.DEVELOPER.id,
  });

  console.log('Roles y usuarios de desarrollo creados correctamente.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
