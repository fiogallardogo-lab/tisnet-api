// Fresh databases ONLY. Never reconciles an existing database or erases data.
const { PrismaClient } = require('@prisma/client');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const run = (args) => {
  const r = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', ...args],
    { stdio: 'inherit', env: process.env },
  );
  if (r.status !== 0) throw Error('Prisma command failed');
};
(async () => {
  if (process.env.ALLOW_EMPTY_DB_BASELINE !== 'true')
    throw Error(
      'Set ALLOW_EMPTY_DB_BASELINE=true for a confirmed empty database',
    );
  const url = new URL(process.env.DATABASE_URL);
  const name = url.pathname.slice(1);
  const generated = spawnSync(
    process.execPath,
    [
      'node_modules/prisma/build/index.js',
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--script',
    ],
    { encoding: 'utf8', env: process.env },
  );
  if (
    generated.status !== 0 ||
    generated.stdout.trim().replaceAll('\r\n', '\n') !==
      fs
        .readFileSync('prisma/fresh-baseline.sql', 'utf8')
        .trim()
        .replaceAll('\r\n', '\n')
  )
    throw Error('Baseline does not match schema; regenerate and review it');
  const db = new PrismaClient();
  try {
    const tables =
      await db.$queryRaw`SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA=${name}`;
    if (tables.length) throw Error('Refusing: database is not empty');
  } finally {
    await db.$disconnect();
  }
  run([
    'db',
    'execute',
    '--file',
    'prisma/fresh-baseline.sql',
    '--schema',
    'prisma/schema.prisma',
  ]);
  for (const migration of fs
    .readdirSync('prisma/migrations')
    .filter((x) => fs.existsSync('prisma/migrations/' + x + '/migration.sql'))
    .sort())
    run(['migrate', 'resolve', '--applied', migration]);
  run(['migrate', 'status']);
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
