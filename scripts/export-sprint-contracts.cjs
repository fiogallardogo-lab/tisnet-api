require('reflect-metadata');
const fs = require('fs');
const { NestFactory } = require('@nestjs/core');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const { AppModule } = require('../dist/app.module');
function type(s) {
  if (!s) return 'unknown';
  let t;
  if (s.$ref) t = s.$ref.split('/').pop();
  else if (s.enum) t = s.enum.map((v) => JSON.stringify(v)).join(' | ');
  else if (s.allOf) t = s.allOf.map(type).join(' & ');
  else if (s.oneOf || s.anyOf) t = (s.oneOf || s.anyOf).map(type).join(' | ');
  else if (s.type === 'array') t = 'Array<' + type(s.items) + '>';
  else if (s.type === 'integer' || s.type === 'number') t = 'number';
  else if (s.type === 'boolean') t = 'boolean';
  else if (s.type === 'string') t = 'string';
  else if (s.properties)
    t =
      '{' +
      Object.entries(s.properties)
        .map(
          ([k, v]) =>
            JSON.stringify(k) +
            (s.required?.includes(k) ? '' : '?') +
            ': ' +
            type(v) +
            ';',
        )
        .join('\n') +
      '}';
  else t = 'unknown';
  return s.nullable ? '(' + t + ') | null' : t;
}
(async () => {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    rawBody: true,
  });
  try {
    app.setGlobalPrefix('api/v1');
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('TISNET Sprint único')
        .setVersion('2026-10-01')
        .addBearerAuth()
        .build(),
    );
    fs.writeFileSync(
      'docs/sprint-unico/openapi.json',
      JSON.stringify(doc, null, 2) + '\n',
    );
    const types =
      '// Generated from the registered Nest OpenAPI. JSON dates are strings.\nexport interface ApiSuccess<T>{success:true;message:string;data:T}\nexport interface ApiError{success:false;message:string|string[];error:string}\n' +
      Object.entries(doc.components.schemas)
        .map(([name, s]) => 'export type ' + name + ' = ' + type(s) + ';')
        .join('\n');
    fs.writeFileSync('docs/sprint-unico/contracts.ts', types);
    console.log(
      Object.keys(doc.paths).length +
        ' registered paths; ' +
        Object.keys(doc.components.schemas).length +
        ' schemas',
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
