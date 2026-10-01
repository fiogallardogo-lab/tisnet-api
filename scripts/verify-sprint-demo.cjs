// Local demo verification against the running API. No secret appears in committed evidence.
const fs = require('fs'),
  assert = require('assert/strict'),
  crypto = require('crypto');
(async () => {
  const base = process.env.DEMO_API_ORIGIN || 'http://127.0.0.1:13318';
  if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
    throw Error('Local demo only');
  const demo = JSON.parse(
    fs.readFileSync('output/sprint-demo-credentials.json', 'utf8'),
  );
  const tokens = {},
    evidence = [];
  const clean = (x) =>
    Array.isArray(x)
      ? x.map(clean)
      : x && typeof x === 'object'
        ? Object.fromEntries(
            Object.entries(x).map(([k, v]) => [
              k,
              /password|Token/i.test(k) ? '[REDACTED]' : clean(v),
            ]),
          )
        : x;
  async function call(method, path, role, body, status = 200) {
    const headers = {
      Origin: 'http://localhost:5173',
      ...(role ? { Authorization: 'Bearer ' + tokens[role] } : {}),
    };
    let input;
    if (body instanceof FormData) input = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      input = JSON.stringify(body);
    }
    const r = await fetch(base + path, {
      method,
      headers,
      body: input,
      signal: AbortSignal.timeout(15000),
    });
    let result;
    if (r.headers.get('content-type')?.includes('application/pdf')) {
      const b = Buffer.from(await r.arrayBuffer());
      result = {
        bytes: b.length,
        sha256: crypto.createHash('sha256').update(b).digest('hex'),
        contentDisposition: r.headers.get('content-disposition'),
      };
    } else result = await r.json();
    evidence.push({
      method,
      url: base + path,
      role: role || 'PUBLIC',
      request:
        body instanceof FormData
          ? { file: 'mock-document.pdf' }
          : clean(body ?? null),
      http: r.status,
      response: clean(result),
    });
    assert.equal(
      r.status,
      status,
      method + ' ' + path + ' ' + JSON.stringify(result),
    );
    return result.data;
  }
  for (const a of demo.accounts) {
    const result = await call('POST', '/api/v1/auth/login', null, {
      email: a.email,
      password: a.password,
    });
    tokens[a.role] = result.accessToken;
    await call('GET', '/api/v1/auth/me', a.role);
  }
  for (const [role, path] of Object.entries({
    CLIENT: 'client',
    DEVELOPER: 'developer',
    PRODUCT_OWNER: 'po',
    ADMIN: 'admin',
    SUPER_ADMIN: 'superadmin',
  }))
    await call('GET', '/api/v1/dashboard/' + path, role);
  const p = demo.ids.projectId,
    dev = demo.accounts.find((a) => a.role === 'DEVELOPER').id;
  const task = await call(
    'POST',
    `/api/v1/projects/${p}/tasks`,
    'PRODUCT_OWNER',
    { title: 'Smoke task', assigneeId: dev },
    201,
  );
  await call(
    'GET',
    `/api/v1/projects/${p}/tasks?limit=5&status=TODO`,
    'DEVELOPER',
  );
  await call('PATCH', `/api/v1/projects/${p}/tasks/${task.id}`, 'DEVELOPER', {
    status: 'IN_PROGRESS',
  });
  await call(
    'DELETE',
    `/api/v1/projects/${p}/tasks/${task.id}`,
    'PRODUCT_OWNER',
  );
  const resource = await call(
    'POST',
    `/api/v1/projects/${p}/resources`,
    'DEVELOPER',
    { name: 'Smoke reference', url: 'https://example.test/reference' },
    201,
  );
  await call('GET', `/api/v1/projects/${p}/resources`, 'CLIENT');
  await call(
    'PATCH',
    `/api/v1/projects/${p}/resources/${resource.id}`,
    'DEVELOPER',
    { name: 'Updated' },
  );
  await call(
    'DELETE',
    `/api/v1/projects/${p}/resources/${resource.id}`,
    'DEVELOPER',
  );
  await call(
    'POST',
    `/api/v1/projects/${p}/work-logs`,
    'DEVELOPER',
    { date: '2026-09-28', minutes: 10, summary: 'Smoke verification' },
    201,
  );
  await call('GET', `/api/v1/projects/${p}/work-logs`, 'PRODUCT_OWNER');
  const pdf = fs.readFileSync('docs/frontend-a/mock-document.pdf');
  const form = () => {
    const f = new FormData();
    f.append(
      'file',
      new Blob([pdf], { type: 'application/pdf' }),
      'mock-document.pdf',
    );
    return f;
  };
  const cv = await call(
    'POST',
    '/api/v1/users/me/cv',
    'DEVELOPER',
    form(),
    201,
  );
  await call('GET', cv.url, 'DEVELOPER');
  const file = await call(
    'POST',
    `/api/v1/projects/${p}/files`,
    'DEVELOPER',
    form(),
    201,
  );
  await call('GET', file.url, 'CLIENT');
  await call('GET', '/api/v1/workspace/meetings', 'DEVELOPER');
  for (const route of ['categories', 'technologies', 'technology-categories'])
    await call('GET', '/api/v1/public/' + route);
  await call('GET', '/api/v1/health');
  await call('GET', '/api/v1/dashboard/admin', 'DEVELOPER', undefined, 403);
  const pre = await fetch(base + '/api/v1/dashboard/developer', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  assert.equal(pre.status, 204);
  assert.equal(
    pre.headers.get('access-control-allow-origin'),
    'http://localhost:5173',
  );
  evidence.push({
    method: 'OPTIONS',
    url: base + '/api/v1/dashboard/developer',
    request: { origin: 'http://localhost:5173' },
    http: pre.status,
    responseHeaders: Object.fromEntries(pre.headers),
  });
  for (const path of ['/api/docs', '/api/docs-json']) {
    const r = await fetch(base + path);
    assert.equal(r.status, 200);
    evidence.push({
      method: 'GET',
      url: base + path,
      http: r.status,
      contentType: r.headers.get('content-type'),
    });
  }
  fs.writeFileSync(
    'docs/sprint-unico/evidence-local.json',
    JSON.stringify(
      {
        environment: 'LOCAL_ONLY_NOT_STAGING',
        createdAt: new Date().toISOString(),
        ids: demo.ids,
        evidence,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Verified ' +
      evidence.length +
      ' real local HTTP requests; redacted evidence saved.',
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
