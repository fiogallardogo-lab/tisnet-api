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

  const developer = await upsertUser({
    name: 'Developer de prueba TISNET',
    email: process.env.SEED_DEVELOPER_EMAIL,
    password: process.env.SEED_DEVELOPER_PASSWORD,
    roleId: roles.DEVELOPER.id,
  });

  await prisma.developerProfile.upsert({
    where: { userId: developer.id },
    update: {
      specialty: 'Desarrollo de software y arquitectura web',
      experienceYears: 3,
    },
    create: {
      userId: developer.id,
      specialty: 'Desarrollo de software y arquitectura web',
      experienceYears: 3,
    },
  });

  // Meeting.advisorProfile apunta a AdminProfile. En desarrollo, este perfil
  // adicional permite elegir al developer semilla como asesor técnico sin
  // cambiar su rol DEVELOPER ni alterar el modelo productivo.
  await prisma.adminProfile.upsert({
    where: { userId: developer.id },
    update: {
      executiveTitle: 'Developer · Asesor técnico',
      specialty: 'Desarrollo de software y arquitectura web',
      isPublicAdvisor: true,
    },
    create: {
      userId: developer.id,
      executiveTitle: 'Developer · Asesor técnico',
      specialty: 'Desarrollo de software y arquitectura web',
      isPublicAdvisor: true,
    },
  });

  console.log(
    'Roles, usuarios y asesor técnico de desarrollo creados correctamente.',
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
