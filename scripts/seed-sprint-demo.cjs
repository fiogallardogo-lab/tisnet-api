// Explicit demo/test seed. Creates unique fixtures; never changes existing passwords.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { randomBytes } = require('crypto');
const fs = require('fs');
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  if (
    process.env.SEED_SPRINT_DEMO !== 'true' ||
    process.env.NODE_ENV === 'production' ||
    !/(test|staging)/i.test(url.pathname)
  )
    throw Error(
      'Requires explicit SEED_SPRINT_DEMO=true and test/staging database',
    );
  const db = new PrismaClient();
  try {
    const suffix = Date.now().toString(36),
      accounts = [];
    for (const role of [
      'CLIENT',
      'DEVELOPER',
      'PRODUCT_OWNER',
      'ADMIN',
      'SUPER_ADMIN',
    ]) {
      const password = randomBytes(24).toString('base64url'),
        email = 'demo-' + role.toLowerCase() + '-' + suffix + '@example.test';
      const r = await db.role.upsert({
        where: { name: role },
        create: { name: role },
        update: {},
      });
      const u = await db.user.create({
        data: {
          name: 'DEMO ' + role,
          email,
          roleId: r.id,
          passwordHash: await bcrypt.hash(password, 12),
        },
      });
      accounts.push({ role, id: u.id, email, password });
    }
    const ids = Object.fromEntries(accounts.map((a) => [a.role, a.id]));
    const client = accounts.find((a) => a.role === 'CLIENT');
    const data = await db.$transaction(
      async (tx) => {
        const category = await tx.category.create({
          data: { name: 'DEMO ' + suffix },
        });
        const prospect = await tx.prospect.create({
          data: {
            name: 'DEMO Client',
            email: client.email,
            userId: ids.CLIENT,
            source: 'MANUAL',
          },
        });
        const code =
          'Q-' +
          randomBytes(8)
            .toString('hex')
            .slice(0, 8)
            .toUpperCase()
            .replace(/[01]/g, 'A');
        const quote = await tx.quote.create({
          data: {
            publicCode: code,
            contactName: 'DEMO Client',
            contactEmail: client.email,
            contactPhone: '999999999',
            solutionType: 'WEB_APP',
            prospectId: prospect.id,
            activeVersion: 1,
            amountMinor: 30000,
            currency: 'PEN',
            pricingStatus: 'CALCULATED',
            versions: {
              create: {
                version: 1,
                clientUserId: ids.CLIENT,
                authorId: ids.ADMIN,
                amountMinor: 30000,
                currency: 'PEN',
                acceptedAt: new Date(),
                acceptedByUserId: ids.CLIENT,
                scope: {
                  description: 'DEMO ONLY - fictitious commercial values',
                },
                schedules: {
                  create: [
                    {
                      sequence: 1,
                      percentageBasisPoints: 5000,
                      amountMinor: 15000,
                      dueDate: new Date('2026-12-01'),
                      milestone: 'Anticipo',
                    },
                    {
                      sequence: 2,
                      percentageBasisPoints: 5000,
                      amountMinor: 15000,
                      dueDate: new Date('2026-12-15'),
                      milestone: 'Entrega final',
                    },
                  ],
                },
              },
            },
          },
          include: { versions: { include: { schedules: true } } },
        });
        const schedules = quote.versions[0].schedules.sort(
          (a, b) => a.sequence - b.sequence,
        );
        await tx.payment.create({
          data: {
            scheduleId: schedules[0].id,
            externalEventId: 'DEMO-NOT-REAL-' + suffix,
            amountMinor: 15000,
            currency: 'PEN',
            status: 'CONFIRMED',
          },
        });
        const project = await tx.project.create({
          data: {
            name: 'DEMO Sprint único ' + suffix,
            slug: 'demo-sprint-' + suffix,
            shortDescription: 'Datos ficticios para integración local',
            description:
              'DEMO: pagos y acuerdos sintéticos. No representa una operación real.',
            categoryId: category.id,
            status: 'IN_DEVELOPMENT',
            quoteId: quote.id,
            clientUserId: ids.CLIENT,
            productOwnerId: ids.PRODUCT_OWNER,
            members: {
              create: ['CLIENT', 'DEVELOPER', 'PRODUCT_OWNER'].map((role) => ({
                userId: ids[role],
                memberRole: role,
              })),
            },
          },
        });
        const milestone = await tx.projectMilestone.create({
          data: {
            projectId: project.id,
            paymentScheduleId: schedules[1].id,
            title: 'Entrega final',
            dueDate: new Date('2026-12-15'),
            sequence: 1,
          },
        });
        const deliverable = await tx.projectDeliverable.create({
          data: {
            projectId: project.id,
            milestoneId: milestone.id,
            title: 'Entrega final',
            description: 'Demo de entregable',
            milestoneOrder: 1,
            dueDate: new Date('2026-12-15'),
          },
        });
        const meeting = await tx.meeting.create({
          data: {
            prospectId: prospect.id,
            quoteId: quote.id,
            status: 'SCHEDULED',
            scheduledAt: new Date('2026-12-01T15:00:00Z'),
            endsAt: new Date('2026-12-01T16:00:00Z'),
          },
        });
        await tx.kickoff.create({
          data: {
            projectId: project.id,
            meetingId: meeting.id,
            actorId: ids.ADMIN,
            heldAt: new Date('2026-12-01T15:00:00Z'),
          },
        });
        const task = await tx.workTask.create({
          data: {
            projectId: project.id,
            createdById: ids.PRODUCT_OWNER,
            assigneeId: ids.DEVELOPER,
            title: 'Implementar entrega demo',
            description: 'Trabajo de prueba',
            dueDate: new Date('2026-12-10'),
          },
        });
        await tx.workResource.create({
          data: {
            projectId: project.id,
            createdById: ids.PRODUCT_OWNER,
            name: 'Repositorio de referencia',
            url: 'https://example.test/demo',
          },
        });
        await tx.auditEvent.create({
          data: {
            actorId: ids.SUPER_ADMIN,
            action: 'DEMO_FIXTURES_CREATED',
            entityType: 'PROJECT',
            entityId: String(project.id),
            metadata: { synthetic: true },
          },
        });
        return {
          projectId: project.id,
          quoteId: quote.id,
          quoteCode: code,
          versionId: quote.versions[0].id,
          meetingId: meeting.id,
          milestoneId: milestone.id,
          deliverableId: deliverable.id,
          taskId: task.id,
        };
      },
      { timeout: 15000 },
    );
    fs.mkdirSync('output', { recursive: true });
    fs.writeFileSync(
      'output/sprint-demo-credentials.json',
      JSON.stringify(
        {
          environment:
            url.hostname === '127.0.0.1' ? 'LOCAL_ONLY' : 'OPERATOR_CONFIGURED',
          createdAt: new Date().toISOString(),
          accounts,
          ids: data,
        },
        null,
        2,
      ),
    );
    console.log(
      'Demo fixtures created. Credentials and IDs saved to ignored output/sprint-demo-credentials.json (not printed).',
    );
  } finally {
    await db.$disconnect();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
