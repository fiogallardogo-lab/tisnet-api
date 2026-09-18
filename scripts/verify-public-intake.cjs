const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const quoteCodes = [],
  teamCodes = [];
const base = 'http://localhost:3000/api/v1/public';
const cv = readFileSync(
  require('node:path').join(__dirname, 'fixtures', 'intake-cv.pdf'),
);
const photo = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=',
  'base64',
);
const contact = {
  fullName: 'Prueba integración',
  email: 'quote-smoke@example.test',
  phone: '999999999',
};
async function postQuote(body, expected = 201) {
  const response = await fetch(`${base}/project-quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (response.status === 201 && result.data?.code)
    quoteCodes.push(result.data.code);
  assert.equal(response.status, expected, JSON.stringify(result));
  return result.data;
}
function application(role, email, dni) {
  const form = new FormData();
  const fields = {
    requestedRole: role,
    fullName: 'Persona de Prueba',
    age: '25',
    district: 'Lima',
    email,
    phone: '999999999',
    dni,
    career: 'Ingeniería',
    university: 'Universidad de Prueba',
    experienceYears: '3',
    programmingLanguages: 'TypeScript, Node.js',
    specialty: 'FULL_STACK',
    consent: 'true',
  };
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  form.set('cv', new Blob([cv], { type: 'application/pdf' }), 'cv.pdf');
  form.set('photo', new Blob([photo], { type: 'image/png' }), 'photo.png');
  return form;
}
async function apply(form, expected = 201) {
  const response = await fetch(`${base}/team-applications`, {
    method: 'POST',
    body: form,
  });
  const result = await response.json();
  if (response.status === 201 && result.data?.code)
    teamCodes.push(result.data.code);
  assert.equal(response.status, expected, JSON.stringify(result));
  return result.data;
}
(async () => {
  try {
    const usersBefore = await prisma.user.count();
    for (const [deliveryMode, amountMinor] of [
      ['NORMAL', 400000],
      ['URGENT', 520000],
      ['FLEXIBLE', 360000],
    ]) {
      const result = await postQuote({
        solutionType: 'ECOMMERCE',
        deliveryMode,
        catalogVersion: 'SP-01-v2',
        options: [{ code: 'SEO_ADVANCED' }, { code: 'ADVANCED_ANALYTICS' }],
        contact,
        amountMinor: 1,
      });
      assert.equal(result.amountMinor, amountMinor);
      assert.equal(result.pricingVersion, 'SP-01-v2');
      const saved = await prisma.publicQuote.findUniqueOrThrow({
        where: { code: result.code },
      });
      assert.equal(saved.amountMinor, amountMinor);
      assert.equal(saved.snapshot.lines.length, 4);
    }
    const landing = await postQuote({
      solutionType: 'LANDING_PAGE',
      options: [],
      contact,
    });
    assert.equal(landing.amountMinor, 85000);
    const pending = await postQuote({
      solutionType: 'MOBILE_APP',
      options: [],
      contact,
    });
    assert.equal(pending.pricingStatus, 'PENDING_RULES');
    assert.equal(pending.amountMinor, null);
    await postQuote(
      {
        solutionType: 'ECOMMERCE',
        options: [{ code: 'SEO_ADVANCED' }, { code: 'SEO_ADVANCED' }],
        contact,
      },
      400,
    );
    await postQuote(
      {
        solutionType: 'ECOMMERCE',
        options: [{ code: 'UNSUPPORTED' }],
        contact,
      },
      400,
    );
    await postQuote(
      { solutionType: 'ECOMMERCE', options: [], contact: null },
      400,
    );
    for (const requestedRole of ['DEVELOPER', 'PRODUCT_OWNER']) {
      const email = `smoke-${randomUUID()}@example.test`;
      let dni;
      do {
        dni = String(10000000 + Math.floor(Math.random() * 89999999));
      } while (await prisma.teamApplication.findUnique({ where: { dni } }));
      const result = await apply(application(requestedRole, email, dni));
      const saved = await prisma.teamApplication.findUniqueOrThrow({
        where: { code: result.code },
      });
      assert.equal(saved.requestedRole, requestedRole);
      assert.equal(saved.status, 'PENDING_REVIEW');
      assert.equal(saved.profile.programmingLanguages, 'TypeScript, Node.js');
      assert.equal(saved.profile.age, 25);
      assert.deepEqual(Buffer.from(saved.cv), cv);
      assert.deepEqual(Buffer.from(saved.photo), photo);
      await apply(application(requestedRole, email, dni), 409);
    }
    const forged = application(
      'DEVELOPER',
      `bad-${randomUUID()}@example.test`,
      '00000000',
    );
    forged.set(
      'cv',
      new Blob(['forged'], { type: 'application/pdf' }),
      'cv.pdf',
    );
    await apply(forged, 400);
    const invalidRole = application(
      'ADMIN',
      `bad-${randomUUID()}@example.test`,
      '00000000',
    );
    await apply(invalidRole, 400);
    assert.equal(await prisma.user.count(), usersBefore);
    console.log(
      'PASS: HTTP quotes, server recalculation, MySQL snapshots, both team roles, private file bytes, duplicate and invalid input handling; no accounts or privileges created.',
    );
  } finally {
    await prisma.publicQuote.deleteMany({
      where: { code: { in: quoteCodes } },
    });
    await prisma.teamApplication.deleteMany({
      where: { code: { in: teamCodes } },
    });
    await prisma.$disconnect();
    console.log('Synthetic integration records removed.');
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
