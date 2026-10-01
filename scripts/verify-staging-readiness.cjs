// Read-only remote verification. Token/password values are never written to evidence.
const fs = require('fs');
(async () => {
  const base = process.env.STAGING_API_ORIGIN,
    origin = process.env.FRONTEND_ORIGIN,
    expected = process.env.EXPECTED_COMMIT;
  if (!base || !origin || !expected)
    throw Error('Set STAGING_API_ORIGIN, FRONTEND_ORIGIN and EXPECTED_COMMIT');
  const u = new URL(base);
  if (
    u.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(u.hostname)
  )
    throw Error('HTTPS required for remote staging');
  const evidence = [];
  async function check(path, init = {}, expectedStatus = 200) {
    const r = await fetch(new URL(path, u), {
      ...init,
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 500);
    }
    evidence.push({
      method: init.method || 'GET',
      url: new URL(path, u).href,
      http: r.status,
      response: body,
      headers: Object.fromEntries(r.headers),
    });
    if (r.status !== expectedStatus)
      throw Error(path + ' unexpected HTTP ' + r.status);
    return { r, body };
  }
  try {
    const health = await check('/api/v1/health');
    if (
      health.body.data?.status !== 'UP' ||
      health.body.data?.database?.status !== 'CONNECTED'
    )
      throw Error('Database is not ready');
    if (health.body.data?.commit !== expected)
      throw Error('Deployed commit mismatch');
    await check('/api/docs');
    await check('/api/docs-json');
    const preflight = await check(
      '/api/v1/dashboard/developer',
      {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,content-type',
        },
      },
      204,
    );
    if (preflight.r.headers.get('access-control-allow-origin') !== origin)
      throw Error('CORS origin mismatch');
    const routes = {
      CLIENT: 'client',
      DEVELOPER: 'developer',
      PRODUCT_OWNER: 'po',
      ADMIN: 'admin',
      SUPER_ADMIN: 'superadmin',
    };
    for (const [role, route] of Object.entries(routes)) {
      const token = process.env['STAGING_TOKEN_' + role];
      if (!token) throw Error('Missing secure token for ' + role);
      const result = await check('/api/v1/dashboard/' + route, {
        headers: { Authorization: 'Bearer ' + token, Origin: origin },
      });
      if (
        !result.r.headers
          .get('access-control-expose-headers')
          ?.toLowerCase()
          .includes('content-disposition')
      )
        throw Error('Content-Disposition not exposed');
    }
    console.log(
      'Read-only checks passed. Mutations/files/real provider delivery require separate acceptance evidence.',
    );
  } finally {
    fs.mkdirSync('output', { recursive: true });
    fs.writeFileSync(
      'output/staging-readiness-evidence.json',
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          expectedCommit: expected,
          evidence,
        },
        null,
        2,
      ),
    );
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
